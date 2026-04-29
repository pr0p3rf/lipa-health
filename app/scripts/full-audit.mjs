import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.production.local") });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = "eceac8c9-7f1a-4447-8ba8-9be5ec07dcee";

const { data: ap } = await sb
  .from("action_plans")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

const { data: results } = await sb
  .from("biomarker_results")
  .select("biomarker, value, unit, ref_low, ref_high")
  .eq("user_id", userId)
  .eq("test_date", ap.test_date);

const { data: analyses } = await sb
  .from("user_analyses")
  .select("biomarker_name, status, flag, summary, what_to_do")
  .eq("user_id", userId);

const oor = (results ?? []).filter(r => {
  if (r.ref_low !== null && r.value < r.ref_low) return true;
  if (r.ref_high !== null && r.value > r.ref_high) return true;
  return false;
}).map(r => ({ name: r.biomarker, value: r.value, unit: r.unit, low: r.ref_low, high: r.ref_high }));

console.log("===== ACTION PLAN #" + ap.id + " AUDIT =====\n");
console.log("test_date:", ap.test_date);
console.log("created_at:", ap.created_at);
console.log("\n----- OVERALL SUMMARY (" + ap.overall_summary.length + " chars) -----");
console.log(ap.overall_summary);
console.log("\n----- DOMAINS (" + ap.domains.length + ") -----");
for (const d of ap.domains) {
  console.log("\n### " + d.domain.toUpperCase() + " (" + (d.recommendations?.length ?? 0) + " recs)");
  for (const r of (d.recommendations ?? [])) {
    console.log("  • " + r.text);
    console.log("    markers:", JSON.stringify(r.markers_addressed));
    console.log("    research:", r.research_basis);
    console.log("    cited_studies:", r.cited_studies);
    console.log("    retest:", r.retest_timeline);
    if (r.details) {
      console.log("    details:");
      for (const k of Object.keys(r.details)) {
        if (r.details[k]) console.log("      " + k + ": " + r.details[k]);
      }
    }
  }
}
console.log("\n----- OUT-OF-RANGE MARKERS (" + oor.length + ") -----");
for (const r of oor) {
  console.log("  " + r.name + ": " + r.value + " " + (r.unit ?? "") + " [ref " + r.low + "-" + r.high + "]");
}
console.log("\n----- USER_ANALYSES SUMMARY -----");
console.log("Total:", analyses?.length);
const byStatus = {};
for (const a of (analyses ?? [])) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
console.log("By status:", byStatus);
