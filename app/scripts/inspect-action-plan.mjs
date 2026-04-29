import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.production.local") });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = "eceac8c9-7f1a-4447-8ba8-9be5ec07dcee";

const { data: aps } = await sb.from("action_plans").select("*").eq("user_id", userId).order("created_at", { ascending: false });
const { data: fails } = await sb.from("summary_failures").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
const { data: unmatched } = await sb.from("unmatched_biomarkers").select("biomarker_name, count(*)").eq("user_id", userId).limit(10);

console.log(JSON.stringify({
  action_plans: (aps ?? []).map(a => ({
    id: a.id,
    test_date: a.test_date,
    created_at: a.created_at,
    overall_summary_chars: a.overall_summary?.length ?? 0,
    overall_summary_preview: (a.overall_summary || "").slice(0, 280),
    domains_count: Array.isArray(a.domains) ? a.domains.length : 0,
    first_domain_preview: Array.isArray(a.domains) && a.domains[0] ? {
      domain: a.domains[0].domain,
      recommendation_count: a.domains[0].recommendations?.length,
      first_rec: a.domains[0].recommendations?.[0]
    } : null,
  })),
  summary_failures: fails,
  unmatched_count_for_user: (unmatched ?? []).length,
}, null, 2));
