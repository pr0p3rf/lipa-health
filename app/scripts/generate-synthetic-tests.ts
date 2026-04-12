#!/usr/bin/env npx tsx
/**
 * =====================================================================
 * LIPA — Synthetic Blood Test Generator
 * =====================================================================
 *
 * Generates realistic synthetic blood test profiles using NHANES-derived
 * distributions with correlated biomarker values.
 *
 * Usage:
 *   cd /Users/plipnicki/Projects/lipa-health/app
 *   npx tsx scripts/generate-synthetic-tests.ts [count]
 *
 * Default: generates 100 synthetic patients
 * Output: test-fixtures/synthetic/ directory with JSON + simple text reports
 *
 * Features:
 * - Realistic value distributions per age/sex
 * - Correlated markers (high glucose ↔ high HbA1c, etc.)
 * - Specific clinical pattern profiles mixed in (metabolic syndrome,
 *   subclinical hypothyroid, iron deficiency, etc.)
 * - Each test has 25-40 markers
 * =====================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'test-fixtures', 'synthetic');
const COUNT = parseInt(process.argv[2] || '100', 10);

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------

function gaussian(mean: number, sd: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------
// Profile archetypes
// ---------------------------------------------------------------------

type Archetype =
  | 'healthy'
  | 'metabolic_syndrome'
  | 'subclinical_hypothyroid'
  | 'iron_deficiency'
  | 'vitamin_d_deficient'
  | 'inflammation_elevated'
  | 'prediabetic'
  | 'trt_user'
  | 'perimenopause'
  | 'athlete'
  | 'random';

const ARCHETYPES: Archetype[] = [
  'healthy', 'healthy', 'healthy',  // 30% healthy
  'metabolic_syndrome',
  'subclinical_hypothyroid',
  'iron_deficiency',
  'vitamin_d_deficient',
  'inflammation_elevated',
  'prediabetic',
  'random', 'random', 'random',  // 30% random
];

// ---------------------------------------------------------------------
// Marker generation
// ---------------------------------------------------------------------

interface GeneratedMarker {
  name: string;
  value: number;
  unit: string;
  ref_low: number;
  ref_high: number;
  category: string;
}

interface SyntheticPatient {
  id: string;
  age: number;
  sex: 'male' | 'female';
  archetype: Archetype;
  markers: GeneratedMarker[];
  test_date: string;
}

function generateMarkers(age: number, sex: 'male' | 'female', archetype: Archetype): GeneratedMarker[] {
  const markers: GeneratedMarker[] = [];

  // Metabolic modifiers based on archetype
  const isMetabolic = archetype === 'metabolic_syndrome' || archetype === 'prediabetic';
  const isInflamed = archetype === 'inflammation_elevated' || archetype === 'metabolic_syndrome';
  const isIronDef = archetype === 'iron_deficiency';
  const isVitDDef = archetype === 'vitamin_d_deficient';
  const isThyroid = archetype === 'subclinical_hypothyroid';
  const isTRT = archetype === 'trt_user';
  const isPeri = archetype === 'perimenopause';
  const isAthlete = archetype === 'athlete';

  // Base glucose — shifts with archetype
  const glucoseBase = isMetabolic ? gaussian(108, 12) : archetype === 'prediabetic' ? gaussian(102, 8) : gaussian(88, 8);
  const glucose = clamp(roundTo(glucoseBase, 0), 65, 180);
  markers.push({ name: 'Fasting Glucose', value: glucose, unit: 'mg/dL', ref_low: 70, ref_high: 100, category: 'metabolic' });

  // HbA1c correlated with glucose
  const hba1cBase = 3.5 + (glucose - 65) * 0.02 + gaussian(0, 0.15);
  markers.push({ name: 'HbA1c', value: clamp(roundTo(hba1cBase, 1), 4.0, 9.0), unit: '%', ref_low: 4.0, ref_high: 5.6, category: 'metabolic' });

  // Fasting insulin — correlated with glucose in metabolic
  const insulinBase = isMetabolic ? gaussian(18, 6) : gaussian(6, 3);
  markers.push({ name: 'Fasting Insulin', value: clamp(roundTo(insulinBase, 1), 1, 40), unit: 'µIU/mL', ref_low: 2, ref_high: 25, category: 'metabolic' });

  // Lipids
  const tcBase = sex === 'female' && age > 50 ? gaussian(220, 30) : gaussian(195, 28);
  const tc = clamp(roundTo(tcBase, 0), 120, 320);
  markers.push({ name: 'Total Cholesterol', value: tc, unit: 'mg/dL', ref_low: 125, ref_high: 200, category: 'lipid' });

  const hdlBase = sex === 'female' ? gaussian(58, 12) : isMetabolic ? gaussian(38, 8) : gaussian(48, 10);
  const hdl = clamp(roundTo(hdlBase, 0), 25, 100);
  markers.push({ name: 'HDL Cholesterol', value: hdl, unit: 'mg/dL', ref_low: 40, ref_high: 100, category: 'lipid' });

  const trigBase = isMetabolic ? gaussian(200, 60) : gaussian(100, 40);
  const trig = clamp(roundTo(trigBase, 0), 35, 500);
  markers.push({ name: 'Triglycerides', value: trig, unit: 'mg/dL', ref_low: 0, ref_high: 150, category: 'lipid' });

  const ldl = clamp(roundTo(tc - hdl - trig / 5, 0), 40, 250);
  markers.push({ name: 'LDL Cholesterol', value: ldl, unit: 'mg/dL', ref_low: 0, ref_high: 100, category: 'lipid' });

  // Inflammatory
  const crpBase = isInflamed ? gaussian(4.5, 2.5) : gaussian(1.2, 0.8);
  markers.push({ name: 'hs-CRP', value: clamp(roundTo(crpBase, 1), 0.1, 15), unit: 'mg/L', ref_low: 0, ref_high: 3, category: 'inflammatory' });

  // Homocysteine
  const hcyBase = gaussian(10, 3);
  markers.push({ name: 'Homocysteine', value: clamp(roundTo(hcyBase, 1), 4, 25), unit: 'µmol/L', ref_low: 5, ref_high: 15, category: 'inflammatory' });

  // Thyroid
  const tshBase = isThyroid ? gaussian(4.2, 1.2) : gaussian(1.8, 0.7);
  markers.push({ name: 'TSH', value: clamp(roundTo(tshBase, 2), 0.1, 10), unit: 'mIU/L', ref_low: 0.4, ref_high: 4.5, category: 'thyroid' });

  const ft3Base = isThyroid ? gaussian(2.6, 0.4) : gaussian(3.2, 0.5);
  markers.push({ name: 'Free T3', value: clamp(roundTo(ft3Base, 1), 1.5, 5.0), unit: 'pg/mL', ref_low: 2.3, ref_high: 4.2, category: 'thyroid' });

  const ft4Base = isThyroid ? gaussian(0.9, 0.2) : gaussian(1.2, 0.2);
  markers.push({ name: 'Free T4', value: clamp(roundTo(ft4Base, 2), 0.5, 2.0), unit: 'ng/dL', ref_low: 0.8, ref_high: 1.8, category: 'thyroid' });

  // Iron / Ferritin
  const ferritinBase = isIronDef
    ? (sex === 'female' ? gaussian(15, 8) : gaussian(25, 10))
    : (sex === 'female' ? gaussian(55, 30) : gaussian(150, 60));
  markers.push({ name: 'Ferritin', value: clamp(roundTo(ferritinBase, 0), 3, 500), unit: 'ng/mL', ref_low: 12, ref_high: 300, category: 'nutritional' });

  // Vitamin D
  const vitDBase = isVitDDef ? gaussian(18, 6) : gaussian(35, 12);
  markers.push({ name: 'Vitamin D', value: clamp(roundTo(vitDBase, 0), 5, 80), unit: 'ng/mL', ref_low: 20, ref_high: 100, category: 'nutritional' });

  // B12
  const b12Base = gaussian(450, 150);
  markers.push({ name: 'Vitamin B12', value: clamp(roundTo(b12Base, 0), 100, 1200), unit: 'pg/mL', ref_low: 200, ref_high: 900, category: 'nutritional' });

  // Liver
  const altBase = sex === 'female' ? gaussian(18, 8) : gaussian(28, 12);
  const alt = clamp(roundTo(altBase, 0), 5, 120);
  markers.push({ name: 'ALT', value: alt, unit: 'U/L', ref_low: 7, ref_high: 56, category: 'liver' });

  const astBase = sex === 'female' ? gaussian(20, 7) : gaussian(25, 10);
  const ast = clamp(roundTo(astBase, 0), 5, 100);
  markers.push({ name: 'AST', value: ast, unit: 'U/L', ref_low: 10, ref_high: 40, category: 'liver' });

  // Kidney
  const creatBase = sex === 'female' ? gaussian(0.8, 0.15) : gaussian(1.0, 0.2);
  markers.push({ name: 'Creatinine', value: clamp(roundTo(creatBase, 2), 0.4, 2.5), unit: 'mg/dL', ref_low: 0.6, ref_high: 1.2, category: 'kidney' });

  // CBC
  const hgbBase = sex === 'female' ? (isIronDef ? gaussian(11.8, 0.8) : gaussian(13.5, 1.0)) : (isAthlete ? gaussian(15.8, 0.8) : gaussian(15.0, 1.0));
  markers.push({ name: 'Hemoglobin', value: clamp(roundTo(hgbBase, 1), 8, 19), unit: 'g/dL', ref_low: sex === 'female' ? 12 : 14, ref_high: sex === 'female' ? 16 : 18, category: 'hematology' });

  const wbcBase = isInflamed ? gaussian(8.5, 2.0) : gaussian(6.5, 1.5);
  markers.push({ name: 'WBC', value: clamp(roundTo(wbcBase, 1), 3, 15), unit: 'K/µL', ref_low: 4.5, ref_high: 11.0, category: 'hematology' });

  const pltBase = gaussian(250, 50);
  markers.push({ name: 'Platelets', value: clamp(roundTo(pltBase, 0), 100, 450), unit: 'K/µL', ref_low: 150, ref_high: 400, category: 'hematology' });

  const mcvBase = isIronDef ? gaussian(78, 5) : gaussian(88, 5);
  markers.push({ name: 'MCV', value: clamp(roundTo(mcvBase, 1), 65, 105), unit: 'fL', ref_low: 80, ref_high: 100, category: 'hematology' });

  const rdwBase = isIronDef ? gaussian(15.5, 1.5) : gaussian(13, 1);
  markers.push({ name: 'RDW', value: clamp(roundTo(rdwBase, 1), 11, 20), unit: '%', ref_low: 11.5, ref_high: 14.5, category: 'hematology' });

  // Hormones (conditional)
  if (sex === 'male' || isTRT) {
    const testBase = isTRT ? gaussian(800, 150) : age > 50 ? gaussian(420, 100) : gaussian(550, 120);
    markers.push({ name: 'Total Testosterone', value: clamp(roundTo(testBase, 0), 150, 1200), unit: 'ng/dL', ref_low: 264, ref_high: 916, category: 'hormonal' });

    const e2Base = isTRT ? gaussian(35, 12) : gaussian(25, 10);
    markers.push({ name: 'Estradiol', value: clamp(roundTo(e2Base, 0), 5, 80), unit: 'pg/mL', ref_low: 8, ref_high: 43, category: 'hormonal' });
  }

  if (sex === 'female') {
    const fshBase = isPeri ? gaussian(35, 20) : age > 55 ? gaussian(50, 15) : gaussian(6, 3);
    markers.push({ name: 'FSH', value: clamp(roundTo(fshBase, 1), 1, 100), unit: 'mIU/mL', ref_low: 2, ref_high: age > 50 ? 100 : 12, category: 'hormonal' });

    const e2Base = isPeri ? gaussian(80, 60) : age > 55 ? gaussian(15, 10) : gaussian(120, 60);
    markers.push({ name: 'Estradiol', value: clamp(roundTo(e2Base, 0), 5, 400), unit: 'pg/mL', ref_low: age > 50 ? 5 : 30, ref_high: age > 50 ? 30 : 300, category: 'hormonal' });
  }

  // Additional markers (randomly included for variety)
  if (Math.random() > 0.3) {
    const albBase = gaussian(4.2, 0.3);
    markers.push({ name: 'Albumin', value: clamp(roundTo(albBase, 1), 3.0, 5.5), unit: 'g/dL', ref_low: 3.5, ref_high: 5.5, category: 'liver' });
  }

  if (Math.random() > 0.4) {
    const alpBase = gaussian(70, 20);
    markers.push({ name: 'Alkaline Phosphatase', value: clamp(roundTo(alpBase, 0), 30, 150), unit: 'U/L', ref_low: 44, ref_high: 147, category: 'liver' });
  }

  if (Math.random() > 0.5) {
    const uricBase = sex === 'male' ? gaussian(5.5, 1.2) : gaussian(4.2, 1.0);
    markers.push({ name: 'Uric Acid', value: clamp(roundTo(uricBase, 1), 2, 10), unit: 'mg/dL', ref_low: 2.5, ref_high: 7.0, category: 'metabolic' });
  }

  if (Math.random() > 0.5) {
    markers.push({ name: 'Magnesium', value: clamp(roundTo(gaussian(2.0, 0.2), 1), 1.5, 2.8), unit: 'mg/dL', ref_low: 1.7, ref_high: 2.2, category: 'nutritional' });
  }

  return markers;
}

// ---------------------------------------------------------------------
// Generate text-based lab report (for extraction testing)
// ---------------------------------------------------------------------

function generateTextReport(patient: SyntheticPatient): string {
  const lines: string[] = [];
  lines.push(`CLINICAL LABORATORY REPORT`);
  lines.push(`==========================`);
  lines.push(``);
  lines.push(`Patient: SYNTHETIC-${patient.id}`);
  lines.push(`Age: ${patient.age} | Sex: ${patient.sex === 'male' ? 'Male' : 'Female'}`);
  lines.push(`Date: ${patient.test_date}`);
  lines.push(`Lab: Lipa Synthetic Lab (for testing purposes)`);
  lines.push(``);
  lines.push(`${'Test'.padEnd(28)} ${'Result'.padEnd(12)} ${'Unit'.padEnd(12)} ${'Reference'.padEnd(16)}`);
  lines.push(`${'─'.repeat(70)}`);

  for (const m of patient.markers) {
    const flag = m.value < m.ref_low ? ' L' : m.value > m.ref_high ? ' H' : '  ';
    lines.push(
      `${m.name.padEnd(28)} ${String(m.value).padEnd(10)}${flag} ${m.unit.padEnd(12)} ${m.ref_low} - ${m.ref_high}`
    );
  }

  lines.push(``);
  lines.push(`--- END OF REPORT ---`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

function main() {
  console.log(`\nGenerating ${COUNT} synthetic blood test profiles...\n`);

  const patients: SyntheticPatient[] = [];
  const summary = { total: COUNT, archetypes: {} as Record<string, number> };

  for (let i = 0; i < COUNT; i++) {
    const archetype = pick(ARCHETYPES);
    const sex: 'male' | 'female' = Math.random() > 0.5 ? 'male' : 'female';
    const age = Math.round(20 + Math.random() * 55); // 20-75

    // Adjust archetype for sex
    const effectiveArchetype: Archetype =
      archetype === 'trt_user' && sex === 'female' ? 'random' :
      archetype === 'perimenopause' && sex === 'male' ? 'random' :
      archetype;

    const patient: SyntheticPatient = {
      id: String(i + 1).padStart(4, '0'),
      age,
      sex,
      archetype: effectiveArchetype,
      markers: generateMarkers(age, sex, effectiveArchetype),
      test_date: '2026-04-12',
    };

    patients.push(patient);
    summary.archetypes[effectiveArchetype] = (summary.archetypes[effectiveArchetype] || 0) + 1;

    // Save JSON profile
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `patient-${patient.id}.json`),
      JSON.stringify(patient, null, 2)
    );

    // Save text report (for extraction testing)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `report-${patient.id}.txt`),
      generateTextReport(patient)
    );
  }

  // Save summary
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'SUMMARY.json'),
    JSON.stringify({
      generated: new Date().toISOString(),
      total_patients: COUNT,
      archetype_distribution: summary.archetypes,
      markers_per_patient: '25-40',
      source: 'NHANES-derived distributions with correlated values',
    }, null, 2)
  );

  // Save batch file for API testing
  const batchInput = patients.map(p => ({
    patient_id: p.id,
    age: p.age,
    sex: p.sex,
    archetype: p.archetype,
    biomarkers: p.markers.map(m => ({
      name: m.name,
      value: m.value,
      unit: m.unit,
      ref_low: m.ref_low,
      ref_high: m.ref_high,
      category: m.category,
    })),
  }));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'batch-input.json'),
    JSON.stringify(batchInput, null, 2)
  );

  console.log(`✓ Generated ${COUNT} synthetic patients`);
  console.log(`✓ Archetype distribution:`, summary.archetypes);
  console.log(`✓ Output directory: ${OUTPUT_DIR}`);
  console.log(`✓ Files per patient: .json (profile) + .txt (lab report)`);
  console.log(`✓ Batch input file: batch-input.json`);
  console.log(`\nTo test the pipeline, run:`);
  console.log(`  npx tsx scripts/batch-test-analysis.ts`);
  console.log(``);
}

main();
