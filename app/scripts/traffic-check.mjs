import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.production.local") });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

async function count(table, since) {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true }).gte("created_at", since);
  if (error) return `err: ${error.message}`;
  return count;
}

const out = {
  uploads_last_24h: await count("uploads", since24h),
  uploads_last_7d: await count("uploads", since7d),
  biomarker_results_last_24h: await count("biomarker_results", since24h),
  biomarker_results_last_7d: await count("biomarker_results", since7d),
  user_analyses_last_24h: await count("user_analyses", since24h),
  action_plans_last_24h: await count("action_plans", since24h),
  action_plans_last_7d: await count("action_plans", since7d),
  newsletter_signups_last_24h: await count("newsletter_subscribers", since24h),
  newsletter_signups_last_7d: await count("newsletter_subscribers", since7d),
  summary_failures_last_24h: await count("summary_failures", since24h),
  unmatched_biomarkers_last_24h: await count("unmatched_biomarkers", since24h),
};

console.log(JSON.stringify(out, null, 2));

const { data: lastUploads } = await sb
  .from("uploads")
  .select("user_id, status, created_at")
  .order("created_at", { ascending: false })
  .limit(5);
console.log("\n--- last 5 uploads ---");
console.log(JSON.stringify(lastUploads, null, 2));

const { data: lastAP } = await sb
  .from("action_plans")
  .select("user_id, test_date, created_at")
  .order("created_at", { ascending: false })
  .limit(5);
console.log("\n--- last 5 action_plans ---");
console.log(JSON.stringify(lastAP, null, 2));
