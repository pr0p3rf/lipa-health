#!/usr/bin/env npx tsx
/**
 * =====================================================================
 * LIPA — Batch Analysis Testing
 * =====================================================================
 *
 * Runs synthetic blood test profiles through the analysis pipeline
 * and produces a quality report.
 *
 * Prerequisites:
 *   1. Run generate-synthetic-tests.ts first
 *   2. Ensure .env.local has all API keys
 *   3. Ensure PubMed ingestion has run (studies in corpus)
 *
 * Usage:
 *   cd /Users/plipnicki/Projects/lipa-health/app
 *   npx tsx scripts/batch-test-analysis.ts [count]
 *
 * Default: tests first 10 synthetic patients (adjust for cost)
 * Each patient costs ~$1.75 in API calls (Sonnet + Opus)
 * =====================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env vars BEFORE any other imports that use them
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { analyzeBiomarker, generateActionPlan } from '../src/lib/living-research';
import { runAllCalculations } from '../src/lib/risk-calculations';
import { detectPatterns } from '../src/lib/pattern-detection';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BATCH_DIR = path.resolve(process.cwd(), 'test-fixtures', 'synthetic');
const RESULTS_DIR = path.resolve(process.cwd(), 'test-fixtures', 'results');
const COUNT = parseInt(process.argv[2] || '10', 10);

fs.mkdirSync(RESULTS_DIR, { recursive: true });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface QualityScore {
  patient_id: string;
  archetype: string;
  markers_analyzed: number;
  markers_with_citations: number;
  avg_citation_count: number;
  patterns_detected: string[];
  risk_calcs_computed: number;
  action_plan_domains: number;
  action_plan_items: number;
  total_time_ms: number;
  errors: string[];
}

async function testPatient(patientFile: string): Promise<QualityScore> {
  const data = JSON.parse(fs.readFileSync(patientFile, 'utf8'));
  const score: QualityScore = {
    patient_id: data.id,
    archetype: data.archetype,
    markers_analyzed: 0,
    markers_with_citations: 0,
    avg_citation_count: 0,
    patterns_detected: [],
    risk_calcs_computed: 0,
    action_plan_domains: 0,
    action_plan_items: 0,
    total_time_ms: 0,
    errors: [],
  };

  const start = Date.now();

  try {
    // Run per-biomarker analysis
    const analyses: any[] = [];
    for (const marker of data.markers) {
      try {
        const analysis = await analyzeBiomarker(supabase, anthropic, {
          name: marker.name,
          value: marker.value,
          unit: marker.unit,
          ref_low: marker.ref_low,
          ref_high: marker.ref_high,
          category: marker.category,
          user_id: 'synthetic-test',
          test_date: data.test_date,
        });
        analyses.push(analysis);
        score.markers_analyzed++;
        if (analysis.citation_count > 0) score.markers_with_citations++;
      } catch (err: any) {
        score.errors.push(`${marker.name}: ${err.message}`);
      }
    }

    // Citation stats
    const citCounts = analyses.map((a: any) => a.citation_count || 0);
    score.avg_citation_count = citCounts.length > 0
      ? Math.round((citCounts.reduce((a: number, b: number) => a + b, 0) / citCounts.length) * 10) / 10
      : 0;

    // Risk calculations
    const biomarkerValues = data.markers.map((m: any) => ({
      name: m.name,
      value: m.value,
      unit: m.unit,
    }));
    const calcs = runAllCalculations(biomarkerValues, {
      age: data.age,
      sex: data.sex,
    });
    score.risk_calcs_computed = calcs.length;

    // Pattern detection
    const patterns = detectPatterns(data.markers.map((m: any) => ({
      name: m.name,
      value: m.value,
      unit: m.unit,
      status: 'normal', // simplified — real pipeline computes status
    })));
    score.patterns_detected = patterns.map((p: any) => p.id);

    // Action plan
    try {
      const panelForPlan = analyses.map((a: any) => ({
        name: a.biomarker_name || a.canonical_name,
        value: 0,
        unit: null,
        status: a.status,
        flag: a.flag,
        summary: a.summary,
        what_research_shows: a.what_research_shows,
        suggested_exploration: a.suggested_exploration,
        category: 'other',
      }));

      const plan = await generateActionPlan(anthropic, panelForPlan, calcs.map(c => ({
        name: c.name,
        value: c.value,
        interpretation: c.interpretation,
        interpretation_label: c.interpretation_label,
        summary: c.summary,
      })));

      score.action_plan_domains = plan.domains.length;
      score.action_plan_items = plan.domains.reduce((sum: number, d: any) => sum + (d.recommendations?.length || 0), 0);
    } catch (err: any) {
      score.errors.push(`Action plan: ${err.message}`);
    }

  } catch (err: any) {
    score.errors.push(`Pipeline: ${err.message}`);
  }

  score.total_time_ms = Date.now() - start;
  return score;
}

async function main() {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`LIPA BATCH ANALYSIS TEST`);
  console.log(`═══════════════════════════════════════`);
  console.log(`Testing ${COUNT} synthetic patients...\n`);

  // Find patient files
  const files = fs.readdirSync(BATCH_DIR)
    .filter(f => f.startsWith('patient-') && f.endsWith('.json'))
    .sort()
    .slice(0, COUNT);

  if (files.length === 0) {
    console.error('No synthetic patients found. Run generate-synthetic-tests.ts first.');
    process.exit(1);
  }

  const scores: QualityScore[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] Testing ${file}...`);

    const score = await testPatient(path.join(BATCH_DIR, file));
    scores.push(score);

    console.log(
      `  → ${score.markers_analyzed} markers, ${score.markers_with_citations} with citations (avg ${score.avg_citation_count}), ` +
      `${score.risk_calcs_computed} calcs, ${score.patterns_detected.length} patterns, ` +
      `${score.action_plan_domains} plan domains (${score.action_plan_items} items), ` +
      `${score.total_time_ms}ms` +
      (score.errors.length > 0 ? ` [${score.errors.length} errors]` : '')
    );
  }

  // Compute aggregate stats
  const totalMarkers = scores.reduce((s, q) => s + q.markers_analyzed, 0);
  const totalWithCitations = scores.reduce((s, q) => s + q.markers_with_citations, 0);
  const avgCitations = scores.reduce((s, q) => s + q.avg_citation_count, 0) / scores.length;
  const avgTime = Math.round(scores.reduce((s, q) => s + q.total_time_ms, 0) / scores.length);
  const totalErrors = scores.reduce((s, q) => s + q.errors.length, 0);
  const patternsFound = scores.filter(q => q.patterns_detected.length > 0).length;
  const plansGenerated = scores.filter(q => q.action_plan_domains > 0).length;

  const report = {
    run_date: new Date().toISOString(),
    patients_tested: scores.length,
    total_markers_analyzed: totalMarkers,
    citation_rate: `${Math.round((totalWithCitations / totalMarkers) * 100)}%`,
    avg_citations_per_marker: Math.round(avgCitations * 10) / 10,
    avg_time_per_patient_ms: avgTime,
    patients_with_patterns: `${patternsFound}/${scores.length}`,
    patients_with_action_plans: `${plansGenerated}/${scores.length}`,
    total_errors: totalErrors,
    scores,
  };

  // Save report
  const reportPath = path.join(RESULTS_DIR, `batch-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n═══════════════════════════════════════`);
  console.log(`RESULTS`);
  console.log(`═══════════════════════════════════════`);
  console.log(`Patients tested:        ${scores.length}`);
  console.log(`Markers analyzed:       ${totalMarkers}`);
  console.log(`Citation rate:          ${report.citation_rate}`);
  console.log(`Avg citations/marker:   ${report.avg_citations_per_marker}`);
  console.log(`Avg time/patient:       ${avgTime}ms`);
  console.log(`Patients with patterns: ${report.patients_with_patterns}`);
  console.log(`Patients with plans:    ${report.patients_with_action_plans}`);
  console.log(`Total errors:           ${totalErrors}`);
  console.log(`\nFull report: ${reportPath}`);
  console.log(`═══════════════════════════════════════\n`);
}

main().catch(console.error);
