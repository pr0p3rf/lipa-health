import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Lazy OpenAI for embeddings
let _openai: any = null;
function getOpenAI() {
  if (!_openai) {
    const OpenAI = require("openai").default;
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return _openai;
}

const DEFAULT_SYSTEM_PROMPT = `You are Lipa's health assistant. You help people understand their blood test results in plain English.

You have access to:
1. The user's complete blood test panel with values, ranges, and analysis
2. Their risk calculations (cardiovascular risk, insulin resistance, etc.)
3. Their personalized action plan
4. Retrieved peer-reviewed research studies relevant to their question

YOUR VOICE:
- Talk like a smart, warm friend who knows a lot about health
- Plain English. Short sentences. No jargon.
- Be specific to THEIR values: "Your iron at 38 is low" not "iron deficiency is common"
- Be honest but not alarming
- When citing research, do it naturally: "A 2024 study found..." not "Smith et al. (2024) demonstrated..."

RULES:
1. NEVER diagnose or prescribe. You are educational, not medical.
2. When they ask "should I take X?" say "Research has looked at..." or "Some people discuss with their doctor..."
3. Reference their specific biomarker values when relevant
4. If they ask about something not in their panel, still help but note you don't have that data
5. If retrieved studies are provided, use them to ground your answer
6. Keep responses concise — 2-4 short paragraphs max. Don't write essays.
7. End with a gentle reminder to discuss with their healthcare provider when the question is about treatment decisions.

You are NOT a doctor. You are a research-grounded assistant that helps people understand their biology.`;

export async function POST(request: NextRequest) {
  try {
    const { message, userId, history } = await request.json();

    if (!message || !userId) {
      return new Response(JSON.stringify({ error: "message and userId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Store the user's message (table may not exist yet)
    try {
      await supabase.from("chat_messages").insert({
        user_id: userId,
        role: "user",
        content: message,
      });
    } catch {}

    // Load admin instructions (if table exists)
    let adminInstructions = "";
    try {
      const { data: setting } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "chat_system_instructions")
        .maybeSingle();
      if (setting?.value) adminInstructions = "\n\nADMIN GUIDELINES:\n" + setting.value;
    } catch {}

    // Load conversation history from DB (last 20 messages)
    let dbHistory: { role: string; content: string }[] = [];
    try {
      const { data: storedMessages } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (storedMessages) {
        dbHistory = storedMessages.reverse();
      }
    } catch {
      // Table might not exist yet — fall back to client history
      if (history && Array.isArray(history)) {
        dbHistory = history.slice(-10);
      }
    }

    // Fetch user's latest test data
    const [resultsRes, analysesRes, plansRes, profileRes] = await Promise.all([
      supabase
        .from("biomarker_results")
        .select("biomarker, value, unit, ref_low, ref_high, category, test_date")
        .eq("user_id", userId)
        .order("test_date", { ascending: false })
        .limit(50),
      supabase
        .from("user_analyses")
        .select("biomarker_name, status, flag, summary, what_it_means, what_research_shows, suggested_exploration")
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .limit(50),
      supabase
        .from("action_plans")
        .select("overall_summary, domains")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("age, sex")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    // Build context from user's data
    const results = resultsRes.data || [];
    const analyses = analysesRes.data || [];
    const actionPlan = plansRes.data;
    const profile = profileRes.data;

    let userContext = "## USER'S BLOOD TEST RESULTS\n\n";

    if (profile) {
      userContext += `Age: ${profile.age || "unknown"}, Sex: ${profile.sex || "unknown"}\n\n`;
    }

    if (results.length > 0) {
      userContext += "| Biomarker | Value | Unit | Ref Range | Status |\n|---|---|---|---|---|\n";
      for (const r of results) {
        const analysis = analyses.find(
          (a) => a.biomarker_name?.toLowerCase() === r.biomarker?.toLowerCase()
        );
        userContext += `| ${r.biomarker} | ${r.value} | ${r.unit || ""} | ${r.ref_low || ""}–${r.ref_high || ""} | ${analysis?.status || "unknown"} |\n`;
      }
      userContext += "\n";
    }

    // Add key analyses
    const flagged = analyses.filter((a) => a.status === "borderline" || a.status === "out_of_range");
    if (flagged.length > 0) {
      userContext += "## KEY FINDINGS\n\n";
      for (const a of flagged) {
        userContext += `**${a.biomarker_name}** (${a.status}): ${a.summary}\n${a.what_it_means}\n\n`;
      }
    }

    // Add action plan summary
    if (actionPlan) {
      userContext += `## ACTION PLAN SUMMARY\n\n${actionPlan.overall_summary}\n\n`;
      if (actionPlan.domains) {
        for (const d of actionPlan.domains as any[]) {
          if (d.recommendations?.length > 0) {
            userContext += `**${d.domain}:** ${d.recommendations.map((r: any) => r.text).join("; ")}\n`;
          }
        }
        userContext += "\n";
      }
    }

    // RAG: retrieve relevant studies for this question
    let studyContext = "";
    try {
      const openai = getOpenAI();
      const embeddingRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: message,
        dimensions: 1536,
      });
      const queryEmbedding = embeddingRes.data[0].embedding;

      const { data: studies } = await supabase.rpc("match_studies", {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 5,
      });

      if (studies && studies.length > 0) {
        studyContext = "\n## RELEVANT RESEARCH STUDIES\n\n";
        for (const s of studies) {
          studyContext += `- **${s.title}** (${s.authors?.[0]?.split(" ").pop() || "Unknown"} et al., ${s.publication_year || "n.d."}) — ${s.journal || ""}. `;
          if (s.abstract) {
            studyContext += s.abstract.slice(0, 300) + "...\n";
          }
          studyContext += "\n";
        }
      }
    } catch (err) {
      console.error("[chat] RAG retrieval failed:", err);
    }

    // Build conversation messages — use DB history, skip the last user message (we add it with context)
    const messages: any[] = [];
    const historyToUse = dbHistory.slice(0, -1); // exclude the message we just inserted
    for (const h of historyToUse) {
      messages.push({ role: h.role, content: h.content });
    }

    // Add current message with context (only first message gets full context to save tokens)
    const isFirstMessage = historyToUse.length === 0;
    const augmentedMessage = isFirstMessage
      ? `${message}\n\n---\n\n${userContext}${studyContext}`
      : `${message}${studyContext ? "\n\n---\n\nRELEVANT STUDIES:\n" + studyContext : ""}`;
    messages.push({ role: "user" as const, content: augmentedMessage });

    // Stream response
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: DEFAULT_SYSTEM_PROMPT + adminInstructions,
      messages,
    });

    // Collect full response for storage
    let fullResponse = "";

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullResponse += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
          }

          // Store assistant response
          if (fullResponse) {
            try {
              await supabase.from("chat_messages").insert({
                user_id: userId,
                role: "assistant",
                content: fullResponse,
              });
            } catch {}
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[chat] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// GET endpoint to load chat history
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ messages: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(50);

    return new Response(JSON.stringify({ messages: data || [] }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ messages: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
