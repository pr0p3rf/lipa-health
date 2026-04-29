import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.production.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("missing env"); process.exit(1); }

const sb = createClient(url, key);

const targetEmail = process.argv[2] ?? "plipnicki@gmail.com";

let userId = null;
let page = 1;
while (!userId) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error("listUsers:", error); process.exit(1); }
  if (!data.users.length) break;
  const hit = data.users.find(u => (u.email ?? "").toLowerCase() === targetEmail.toLowerCase());
  if (hit) userId = hit.id;
  else page += 1;
  if (page > 25) break;
}

if (!userId) {
  console.log(JSON.stringify({ targetEmail, userId: null, panels: [] }, null, 2));
  process.exit(0);
}

const { data: rows, error } = await sb
  .from("biomarker_results")
  .select("test_date, biomarker")
  .eq("user_id", userId);
if (error) { console.error("biomarker_results:", error); process.exit(1); }

const byDate = new Map();
for (const r of rows ?? []) {
  if (!byDate.has(r.test_date)) byDate.set(r.test_date, 0);
  byDate.set(r.test_date, byDate.get(r.test_date) + 1);
}
const panels = [...byDate.entries()]
  .map(([date, count]) => ({ test_date: date, marker_count: count }))
  .sort((a, b) => b.test_date.localeCompare(a.test_date));

const { data: aps } = await sb
  .from("action_plans")
  .select("test_date, overall_summary, domains")
  .eq("user_id", userId);

const apByDate = new Map((aps ?? []).map(a => [a.test_date, a]));
for (const p of panels) {
  const ap = apByDate.get(p.test_date);
  p.has_action_plan = !!ap;
  p.action_plan_summary_chars = ap?.overall_summary?.length ?? 0;
  p.action_plan_domains = Array.isArray(ap?.domains) ? ap.domains.length : 0;
}

console.log(JSON.stringify({ targetEmail, userId, panels }, null, 2));
