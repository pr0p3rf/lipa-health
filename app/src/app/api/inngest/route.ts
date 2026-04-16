import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { analyzePanel } from "@/inngest/functions/analyze-panel";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzePanel],
});
