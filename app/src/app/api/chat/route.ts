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

const DEFAULT_SYSTEM_PROMPT = `You are Ask Lipa — a health research assistant that knows this person's actual blood test results, their history, their patterns, and their personalized protocol. You are NOT ChatGPT or a generic AI.

You have access to:
1. Their complete blood test panel with values, ranges, status, and deep analysis for every marker
2. Their cross-marker patterns — connections between markers that tell a bigger story
3. Their personalized action plan with specific supplements, doses, timing
4. Their test HISTORY — multiple tests over time showing how markers have changed
5. Retrieved peer-reviewed research studies relevant to their question

WHAT MAKES YOU DIFFERENT FROM CHATGPT:
- You know THEIR specific values. Always reference them: "Your ferritin at 8 ng/mL is critically low" not "low ferritin is common"
- You know their PATTERNS: "Your low iron + low ferritin + low transferrin saturation together point to iron deficiency anemia"
- You know their HISTORY: "Your TSH has risen from 3.2 to 5.8 over three years — that's a clear trend toward hypothyroidism"
- You know their PROTOCOL: "Based on your specific results, the analysis recommended 25mg iron bisglycinate with 500mg vitamin C"
- You cite REAL research with numbers, not vague claims

YOUR VOICE:
- Talk like a brilliant friend who happens to be a health researcher
- Plain English. Short sentences. No jargon.
- Be specific and confident about THEIR data
- Be honest but not alarming
- Cite research naturally: "A 2024 study of 160,000 people found..." not academic format

RULES:
1. NEVER diagnose or prescribe. Frame as: "Research shows..." or "Your analysis suggests..."
2. ALWAYS reference their specific values and history when relevant
3. If they ask about their protocol, reference what their analysis recommended — don't make up new advice
4. If they have multiple tests, reference trends: "Looking at your history..."
5. If retrieved studies are provided, use them to ground your answer
6. Keep responses concise — 2-4 short paragraphs. Be dense with insight, not verbose.
7. End treatment-related answers with a gentle reminder to discuss with their healthcare provider.

You are NOT a generic chatbot. You are their personal health research assistant with their full biology loaded.`;

export async function POST(request: NextRequest) {
  try {
    const { message, userId, history } = await request.json();

    if (!message || !userId) {
      return new Response(JSON.stringify({ error: "message and userId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check user tier for message limits
    const { data: subData } = await supabase
      .from("user_subscriptions")
      .select("tier")
      .eq("user_id", userId)
      .maybeSingle();
    const tier = subData?.tier || "free";
    const isFree = tier === "free";

    // Count existing user messages for free tier limit
    if (isFree) {
      try {
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("role", "user");
        if ((count || 0) >= 3) {
          return new Response(JSON.stringify({
            error: "limit_reached",
            message: "You've used your 3 free Ask Lipa questions. Upgrade to Lipa One (€39) for 7 days of Ask Lipa, or Lipa Life (€89/year) for unlimited access."
          }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {}
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

    // Fetch ALL user data — results, analyses, plans, patterns, history
    const [resultsRes, analysesRes, plansRes, profileRes] = await Promise.all([
      supabase
        .from("biomarker_results")
        .select("biomarker, value, unit, ref_low, ref_high, category, test_date")
        .eq("user_id", userId)
        .order("test_date", { ascending: false }),
      supabase
        .from("user_analyses")
        .select("biomarker_name, status, flag, summary, what_it_means, what_research_shows, what_to_do, related_patterns, citation_count, test_date:biomarker_result_id(test_date)")
        .eq("user_id", userId),
      supabase
        .from("action_plans")
        .select("overall_summary, domains, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("age, sex")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const results = resultsRes.data || [];
    const analyses = analysesRes.data || [];
    const actionPlans = plansRes.data || [];
    const actionPlan = actionPlans[0] || null;
    const profile = profileRes.data;

    // Build comprehensive context
    let userContext = "## USER PROFILE\n\n";
    if (profile) {
      userContext += `Age: ${profile.age || "unknown"}, Sex: ${profile.sex || "unknown"}\n\n`;
    }

    // Group results by test date for history
    const testDates = [...new Set(results.map(r => r.test_date))].sort((a, b) => b.localeCompare(a));
    userContext += `## TEST HISTORY (${testDates.length} test${testDates.length !== 1 ? "s" : ""})\n\n`;

    if (testDates.length > 1) {
      userContext += "This user has multiple blood tests over time:\n";
      for (const date of testDates) {
        const dateResults = results.filter(r => r.test_date === date);
        userContext += `- ${date}: ${dateResults.length} markers\n`;
      }
      userContext += "\n";

      // Show trends for key markers that appear in multiple dates
      const markersByName = new Map<string, Array<{ date: string; value: number; unit: string }>>();
      for (const r of results) {
        if (!markersByName.has(r.biomarker)) markersByName.set(r.biomarker, []);
        markersByName.get(r.biomarker)!.push({ date: r.test_date, value: r.value, unit: r.unit || "" });
      }

      const trending: string[] = [];
      for (const [name, vals] of markersByName) {
        if (vals.length >= 2) {
          const sorted = vals.sort((a, b) => a.date.localeCompare(b.date));
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const change = last.value - first.value;
          const pctChange = first.value !== 0 ? Math.round((change / first.value) * 100) : 0;
          if (Math.abs(pctChange) > 5) {
            trending.push(`${name}: ${first.value} (${first.date}) → ${last.value} (${last.date}) [${pctChange > 0 ? "+" : ""}${pctChange}%]`);
          }
        }
      }

      if (trending.length > 0) {
        userContext += "## TRENDS (markers that changed significantly over time)\n\n";
        for (const t of trending.slice(0, 20)) {
          userContext += `- ${t}\n`;
        }
        userContext += "\n";
      }
    }

    // Latest test results
    const latestDate = testDates[0];
    const latestResults = results.filter(r => r.test_date === latestDate);

    userContext += `## LATEST TEST (${latestDate}, ${latestResults.length} markers)\n\n`;
    userContext += "| Biomarker | Value | Unit | Ref Range | Status |\n|---|---|---|---|---|\n";
    for (const r of latestResults) {
      const analysis = analyses.find(
        (a) => a.biomarker_name?.toLowerCase() === r.biomarker?.toLowerCase()
      );
      userContext += `| ${r.biomarker} | ${r.value} | ${r.unit || ""} | ${r.ref_low || ""}–${r.ref_high || ""} | ${analysis?.status || "unknown"} |\n`;
    }
    userContext += "\n";

    // Key findings with full detail
    const flagged = analyses.filter((a) => a.status === "borderline" || a.status === "out_of_range");
    if (flagged.length > 0) {
      userContext += "## KEY FINDINGS (markers needing attention)\n\n";
      for (const a of flagged) {
        userContext += `### ${a.biomarker_name} (${a.status})\n`;
        userContext += `${a.summary}\n`;
        userContext += `**Root cause:** ${a.what_it_means}\n`;
        if (a.what_to_do) userContext += `**Protocol:** ${a.what_to_do}\n`;
        if (a.related_patterns) userContext += `**Connected patterns:** ${a.related_patterns}\n`;
        userContext += `**Research:** ${a.what_research_shows}\n`;
        userContext += `Citations: ${a.citation_count} studies\n\n`;
      }
    }

    // Cross-marker patterns (from action plan)
    if (actionPlan) {
      userContext += `## EXECUTIVE SUMMARY\n\n${actionPlan.overall_summary}\n\n`;

      // Full action plan with details
      userContext += "## PERSONALIZED ACTION PLAN\n\n";
      if (actionPlan.domains) {
        for (const d of actionPlan.domains as any[]) {
          if (d.recommendations?.length > 0) {
            userContext += `### ${d.domain}\n`;
            for (const rec of d.recommendations) {
              userContext += `- **${rec.text}**\n`;
              if (rec.research_basis) userContext += `  Research: ${rec.research_basis}\n`;
              if (rec.details?.dosage_range) userContext += `  Dosage: ${rec.details.dosage_range}\n`;
              if (rec.details?.timing) userContext += `  Timing: ${rec.details.timing}\n`;
              if (rec.details?.best_form) userContext += `  Form: ${rec.details.best_form}\n`;
            }
            userContext += "\n";
          }
        }
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
      system: DEFAULT_SYSTEM_PROMPT + adminInstructions + (isFree ? "\n\nIMPORTANT — FREE TIER RESTRICTION: This user is on the free plan. You may answer their questions about individual markers, explain what values mean, and give general health context. But do NOT provide their full action plan, complete supplement protocol, all recommendations, or comprehensive analysis. If they ask for their 'full protocol', 'complete plan', 'all recommendations', or similar, respond warmly: 'I can help with individual questions about your markers. Your full personalized protocol — with specific doses, timing, and cited research for each recommendation — is available with your full analysis.' Keep answers helpful but brief for free users — give them enough to see the value, not enough to replace the paid analysis." : ""),
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
