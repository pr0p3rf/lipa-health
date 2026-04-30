// One-shot fix for the link-preview-renders-apostrophe-as-&#39 bug:
// replace ASCII apostrophes (') in <title> and <meta> tags with curly
// right single quotation marks (’, U+2019). Identical visual rendering;
// safe across all link-preview parsers (Telegram, WhatsApp, iMessage,
// FB, X) that mis-handle the ASCII apostrophe.
//
// Body content untouched — only title + meta-tag attribute values are
// modified.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/plipnicki/Projects/lipa-health";
const FILES = [
  "hashimoto.html",
  "pcos.html",
  "perimenopause.html",
  "trt.html",
  "glp-1.html",
  "peptides.html",
  "cardiovascular.html",
  "pre-diabetes.html",
  "iron-deficiency.html",
  "long-covid.html",
  "fertility.html",
];

const CURLY = "’";

function fixLine(line) {
  // Only fix lines that contain <title> or <meta ... content="..."> or <meta ... name=...>
  const isTitle = /<title>.*<\/title>/.test(line);
  const isMeta = /<meta\s/.test(line);
  if (!isTitle && !isMeta) return line;

  // Replace ASCII apostrophe with curly. Skip apostrophes inside attribute
  // names like translate="no" (no apostrophes there), and skip the apostrophes
  // that delimit attribute values if any (none of these files use single-quoted
  // attribute values; they all use double quotes). So a global replace is safe
  // on these specific lines.
  return line.replace(/'/g, CURLY);
}

let totalChanged = 0;
for (const f of FILES) {
  const path = join(ROOT, f);
  const before = readFileSync(path, "utf8");
  const after = before
    .split("\n")
    .map(fixLine)
    .join("\n");
  if (after === before) {
    console.log(`= ${f} (no change)`);
    continue;
  }
  writeFileSync(path, after, "utf8");
  const beforeCount = (before.match(/'/g) || []).length;
  const afterCount = (after.match(/'/g) || []).length;
  const replaced = beforeCount - afterCount;
  totalChanged += replaced;
  console.log(`✓ ${f} — replaced ${replaced} apostrophes in title/meta`);
}
console.log(`\nTotal: ${totalChanged} apostrophes converted to U+2019`);
