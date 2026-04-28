import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { analyzePanel } from "@/inngest/functions/analyze-panel";

// Inngest steps call back to this endpoint — each step needs enough time
// for RAG retrieval + Claude API call. Default 60s is too short.
export const maxDuration = 300; // 5 minutes (Vercel Pro) or 60s (Hobby — will be capped)

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzePanel],
});
