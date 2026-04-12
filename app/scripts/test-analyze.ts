/**
 * =====================================================================
 * LIPA — Test Harness for Blood Test Analysis
 * =====================================================================
 *
 * Runs a folder of blood test PDFs/images through the analyze API
 * and reports extraction accuracy + analysis quality.
 *
 * Usage:
 *   1. Drop test PDFs into /app/scripts/test-fixtures/
 *   2. Run: npx tsx scripts/test-analyze.ts
 *   3. Review the report output
 *
 * Test fixtures to include:
 *   - Your own real blood tests (anonymize names first)
 *   - Sample lab reports from Thriva, Medichecks, Randox, etc.
 *   - Non-English lab reports (Polish, German, Dutch, Spanish)
 *   - Partial panels (only 5-10 markers)
 *   - Advanced panels (100+ markers)
 *   - Image (phone photo) versions
 *   - PDF scans vs native PDFs
 * =====================================================================
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { analyzeBiomarker } from "../src/lib/living-research";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const FIXTURES_DIR = path.resolve(process.cwd(), "scripts/test-fixtures");
const RESULTS_DIR = path.resolve(process.cwd(), "scripts/test-results");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EXTRACTION_PROMPT = `You are a medical laboratory results parser. Analyze this blood test document and extract ALL biomarker results.

For each biomarker found, return a JSON array with objects containing:
- "name": the biomarker name (standardized English name)
- "value": the numeric value (number only, no units)
- "unit": the unit of measurement
- "ref_low": lower bound of the lab reference range (number or null)
- "ref_high": upper bound of the lab reference range (number or null)
- "category": one of: metabolic, hormonal, inflammatory, cardiac, liver, kidney, thyroid, hematology, nutrient, lipid, other

Return ONLY the JSON array, no other text.`;

interface TestResult {
  file: string;
  success: boolean;
  extracted_count: number;
  extraction_time_ms: number;
  biomarkers: Array<{
    name: string;
    value: number;
    unit: string | null;
    ref_low: number | null;
    ref_high: number | null;
    category: string;
  }>;
  analyses: Array<{
    biomarker: string;
    status: string;
    citation_count: number;
    summary: string;
    analysis_time_ms: number;
  }>;
  total_time_ms: number;
  errors: string[];
}

async function extractBiomarkers(fileBuffer: Buffer, fileName: string): Promise<any[]> {
  const ext = path.extname(fileName).toLowerCase();
  const isPdf = ext === ".pdf";
  const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext);

  if (!isPdf && !isImage) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  const base64 = fileBuffer.toString("base64");
  const mediaType = isPdf
    ? "application/pdf"
    : ext === ".png"
    ? "image/png"
    : ext === ".gif"
    ? "image/gif"
    : ext === ".webp"
    ? "image/webp"
    : "image/jpeg";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: isPdf ? "document" : "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          } as any,
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("No JSON array in response");
  }

  return JSON.parse(jsonMatch[0]);
}

async function testFile(filePath: string): Promise<TestResult> {
  const fileName = path.basename(filePath);
  const result: TestResult = {
    file: fileName,
    success: false,
    extracted_count: 0,
    extraction_time_ms: 0,
    biomarkers: [],
    analyses: [],
    total_time_ms: 0,
    errors: [],
  };

  const overallStart = Date.now();

  try {
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`\n📄 Testing: ${fileName}`);
    console.log(`   Size: ${(fileBuffer.length / 1024).toFixed(1)} KB`);

    // Step 1: Extraction
    console.log("   Step 1: Extracting biomarkers...");
    const extractStart = Date.now();
    const biomarkers = await extractBiomarkers(fileBuffer, fileName);
    result.extraction_time_ms = Date.now() - extractStart;
    result.biomarkers = biomarkers;
    result.extracted_count = biomarkers.length;

    console.log(`   ✓ Extracted ${biomarkers.length} biomarkers in ${result.extraction_time_ms}ms`);

    if (biomarkers.length === 0) {
      result.errors.push("No biomarkers extracted");
      return result;
    }

    // Step 2: Living Research™ analysis for each biomarker
    console.log(`   Step 2: Running Living Research™ analysis on ${biomarkers.length} biomarkers...`);

    const TEST_USER_ID = "00000000-0000-0000-0000-000000000001"; // Test user UUID
    const testDate = new Date().toISOString().split("T")[0];

    // Analyze in parallel with concurrency limit
    const CONCURRENCY = 5;
    const analysisResults = [];

    for (let i = 0; i < biomarkers.length; i += CONCURRENCY) {
      const batch = biomarkers.slice(i, i + CONCURRENCY);
      const batchPromises = batch.map(async (b) => {
        const start = Date.now();
        try {
          const analysis = await analyzeBiomarker(supabase, anthropic, {
            name: b.name,
            value: b.value,
            unit: b.unit || null,
            ref_low: b.ref_low || null,
            ref_high: b.ref_high || null,
            category: b.category || "other",
            user_id: TEST_USER_ID,
            test_date: testDate,
          });

          return {
            biomarker: b.name,
            status: analysis.status,
            citation_count: analysis.citation_count,
            summary: analysis.summary,
            analysis_time_ms: Date.now() - start,
          };
        } catch (err: any) {
          result.errors.push(`Analysis failed for ${b.name}: ${err.message}`);
          return {
            biomarker: b.name,
            status: "error",
            citation_count: 0,
            summary: "Error",
            analysis_time_ms: Date.now() - start,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      analysisResults.push(...batchResults);
    }

    result.analyses = analysisResults;
    result.success = true;
    console.log(`   ✓ Generated ${analysisResults.length} analyses`);
  } catch (err: any) {
    result.errors.push(`Extraction failed: ${err.message}`);
    console.error(`   ❌ Error: ${err.message}`);
  }

  result.total_time_ms = Date.now() - overallStart;
  return result;
}

function printReport(results: TestResult[]) {
  console.log("\n" + "=".repeat(70));
  console.log("TEST REPORT");
  console.log("=".repeat(70));

  const successCount = results.filter((r) => r.success).length;
  const totalBiomarkers = results.reduce((sum, r) => sum + r.extracted_count, 0);
  const totalAnalyses = results.reduce((sum, r) => sum + r.analyses.length, 0);
  const totalCitations = results.reduce(
    (sum, r) => sum + r.analyses.reduce((s, a) => s + a.citation_count, 0),
    0
  );
  const avgExtractionTime =
    results.reduce((sum, r) => sum + r.extraction_time_ms, 0) / results.length;
  const avgTotalTime =
    results.reduce((sum, r) => sum + r.total_time_ms, 0) / results.length;

  console.log(`\n📊 Overall:`);
  console.log(`   Files tested: ${results.length}`);
  console.log(`   Successful: ${successCount}/${results.length}`);
  console.log(`   Total biomarkers extracted: ${totalBiomarkers}`);
  console.log(`   Total analyses generated: ${totalAnalyses}`);
  console.log(`   Total citations retrieved: ${totalCitations}`);
  console.log(`   Avg extraction time: ${Math.round(avgExtractionTime)}ms`);
  console.log(`   Avg total time: ${Math.round(avgTotalTime)}ms`);

  if (totalAnalyses > 0) {
    console.log(
      `   Avg citations per biomarker: ${(totalCitations / totalAnalyses).toFixed(1)}`
    );
  }

  console.log(`\n📄 Per-file results:\n`);
  for (const r of results) {
    const icon = r.success ? "✅" : "❌";
    console.log(`${icon} ${r.file}`);
    console.log(`   Extracted: ${r.extracted_count} biomarkers`);
    console.log(
      `   Analyses: ${r.analyses.length} (with ${r.analyses.reduce((s, a) => s + a.citation_count, 0)} citations)`
    );
    console.log(`   Time: ${(r.total_time_ms / 1000).toFixed(1)}s`);

    if (r.errors.length > 0) {
      console.log(`   Errors:`);
      r.errors.forEach((e) => console.log(`     - ${e}`));
    }

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    r.analyses.forEach((a) => {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    });
    if (Object.keys(statusCounts).length > 0) {
      console.log(`   Status:`, statusCounts);
    }

    // Show biomarkers with low citation count (quality warning)
    const lowCitation = r.analyses.filter((a) => a.citation_count < 3 && a.status !== "error");
    if (lowCitation.length > 0) {
      console.log(
        `   ⚠️ ${lowCitation.length} biomarker(s) with <3 citations (corpus may need more studies)`
      );
    }
    console.log();
  }
}

async function main() {
  // Ensure fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    console.log(`\n📁 Created fixtures directory: ${FIXTURES_DIR}`);
    console.log("\nDrop test blood test PDFs/images into this folder and re-run.");
    console.log("\nRecommended test fixtures:");
    console.log("  - your-own-real-test.pdf (anonymize first)");
    console.log("  - thriva-sample.pdf");
    console.log("  - medichecks-sample.pdf");
    console.log("  - nhs-standard.pdf");
    console.log("  - polish-lab-sample.pdf (non-English test)");
    console.log("  - german-lab-sample.pdf");
    console.log("  - partial-panel.pdf (only 5-10 markers)");
    console.log("  - comprehensive-panel.pdf (100+ markers)");
    console.log("  - photo-of-paper-results.jpg (image format)");
    return;
  }

  // Ensure results directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Find all test files
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => /\.(pdf|png|jpg|jpeg|gif|webp)$/i.test(f))
    .map((f) => path.join(FIXTURES_DIR, f));

  if (files.length === 0) {
    console.log(`\n⚠️ No test files found in ${FIXTURES_DIR}`);
    console.log("Drop PDFs/images into this folder and re-run.");
    return;
  }

  console.log(`\n🧪 Testing ${files.length} blood test file(s)...\n`);

  const results: TestResult[] = [];
  for (const file of files) {
    const result = await testFile(file);
    results.push(result);
  }

  printReport(results);

  // Save detailed results to file
  const reportPath = path.join(
    RESULTS_DIR,
    `test-${new Date().toISOString().split("T")[0]}-${Date.now()}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Detailed results saved to: ${reportPath}\n`);
}

main().catch(console.error);
