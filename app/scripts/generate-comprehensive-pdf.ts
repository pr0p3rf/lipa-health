/**
 * generate-comprehensive-pdf.ts
 *
 * Generates ONE hyper-realistic blood test PDF with 101 biomarkers,
 * simulating a premium executive health panel from Synlab.
 *
 * Usage:  npx tsx scripts/generate-comprehensive-pdf.ts
 * Output: test-fixtures/pdf/comprehensive-101-markers.pdf
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, RGB } from "pdf-lib";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ─── colours ────────────────────────────────────────────────────────────────
const BLACK = rgb(0, 0, 0);
const DARK_GREY = rgb(0.25, 0.25, 0.25);
const MID_GREY = rgb(0.5, 0.5, 0.5);
const LIGHT_GREY = rgb(0.85, 0.85, 0.85);
const TABLE_BG = rgb(0.95, 0.95, 0.97);
const WHITE = rgb(1, 1, 1);
const RED = rgb(0.8, 0.1, 0.1);
const BLUE = rgb(0.1, 0.2, 0.55);
const ACCENT = rgb(0.0, 0.45, 0.3); // Synlab-ish green
const HEADER_BG = rgb(0.0, 0.32, 0.22);
const BORDER_ACCENT = rgb(0.0, 0.55, 0.38);

// ─── types ──────────────────────────────────────────────────────────────────
interface Marker {
  name: string;
  result: string;
  unit: string;
  refRange: string;
  flag: "" | "H" | "L";
}

// ─── helpers ────────────────────────────────────────────────────────────────

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: RGB) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, color: RGB = LIGHT_GREY, thickness = 0.5) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: RGB = BLACK) {
  page.drawText(text, { x, y, font, size, color });
}

// Column layout
const COL = {
  name: 50,
  result: 310,
  unit: 390,
  ref: 450,
  flag: 540,
};

function drawTableHeader(page: PDFPage, y: number, fontBold: PDFFont): number {
  drawRect(page, 40, y - 4, 520, 18, HEADER_BG);
  const labels = ["Test Name", "Result", "Unit", "Reference Range", "Flag"];
  const cols = [COL.name, COL.result, COL.unit, COL.ref, COL.flag];
  for (let i = 0; i < labels.length; i++) {
    drawText(page, labels[i], cols[i], y, fontBold, 8, WHITE);
  }
  return y - 22;
}

function drawMarkerRow(page: PDFPage, y: number, m: Marker, font: PDFFont, fontBold: PDFFont, rowIndex: number): number {
  if (rowIndex % 2 === 0) {
    drawRect(page, 40, y - 4, 520, 16, TABLE_BG);
  }
  const flagColor = m.flag === "H" ? RED : m.flag === "L" ? BLUE : DARK_GREY;
  const resultFont = m.flag ? fontBold : font;

  drawText(page, m.name, COL.name, y, font, 8, DARK_GREY);
  drawText(page, m.result, COL.result, y, resultFont, 8, flagColor);
  drawText(page, m.unit, COL.unit, y, font, 7.5, MID_GREY);
  drawText(page, m.refRange, COL.ref, y, font, 7.5, MID_GREY);
  if (m.flag) {
    drawText(page, m.flag, COL.flag, y, fontBold, 9, flagColor);
  }
  return y - 16;
}

function drawSectionTitle(page: PDFPage, y: number, title: string, fontBold: PDFFont): number {
  drawLine(page, 40, y + 4, 560, y + 4, BORDER_ACCENT, 1);
  drawText(page, title.toUpperCase(), 50, y - 10, fontBold, 9, ACCENT);
  return y - 24;
}

// ─── Data ───────────────────────────────────────────────────────────────────

const sections: { title: string; markers: Marker[] }[] = [
  {
    title: "Hematology",
    markers: [
      { name: "Hemoglobin (HGB)", result: "14.8", unit: "g/dL", refRange: "13.5 – 17.5", flag: "" },
      { name: "Hematocrit (HCT)", result: "43.2", unit: "%", refRange: "40.0 – 54.0", flag: "" },
      { name: "Red Blood Cells (RBC)", result: "4.9", unit: "M/uL", refRange: "4.5 – 5.5", flag: "" },
      { name: "White Blood Cells (WBC)", result: "6.2", unit: "K/uL", refRange: "4.0 – 11.0", flag: "" },
      { name: "Platelets (PLT)", result: "245", unit: "K/uL", refRange: "150 – 400", flag: "" },
      { name: "MCV", result: "88", unit: "fL", refRange: "80 – 100", flag: "" },
      { name: "MCH", result: "30.2", unit: "pg", refRange: "27 – 33", flag: "" },
      { name: "MCHC", result: "34.3", unit: "g/dL", refRange: "32 – 36", flag: "" },
      { name: "RDW", result: "12.8", unit: "%", refRange: "11.5 – 14.5", flag: "" },
      { name: "Neutrophils", result: "58", unit: "%", refRange: "40 – 70", flag: "" },
      { name: "Lymphocytes", result: "32", unit: "%", refRange: "20 – 40", flag: "" },
      { name: "Monocytes", result: "6", unit: "%", refRange: "2 – 8", flag: "" },
      { name: "Eosinophils", result: "3", unit: "%", refRange: "1 – 4", flag: "" },
      { name: "Basophils", result: "0.5", unit: "%", refRange: "0 – 1", flag: "" },
      { name: "ESR", result: "8", unit: "mm/hr", refRange: "0 – 15", flag: "" },
    ],
  },
  {
    title: "Metabolic Panel",
    markers: [
      { name: "Fasting Glucose", result: "98", unit: "mg/dL", refRange: "70 – 100", flag: "" },
      { name: "HbA1c", result: "5.6", unit: "%", refRange: "4.0 – 5.6", flag: "" },
      { name: "Fasting Insulin", result: "9.2", unit: "uIU/mL", refRange: "2.0 – 25.0", flag: "" },
      { name: "C-Peptide", result: "2.1", unit: "ng/mL", refRange: "0.8 – 3.1", flag: "" },
      { name: "Uric Acid", result: "6.8", unit: "mg/dL", refRange: "3.5 – 7.2", flag: "" },
      { name: "Sodium", result: "141", unit: "mEq/L", refRange: "136 – 145", flag: "" },
      { name: "Potassium", result: "4.3", unit: "mEq/L", refRange: "3.5 – 5.0", flag: "" },
      { name: "Chloride", result: "102", unit: "mEq/L", refRange: "98 – 106", flag: "" },
      { name: "Calcium", result: "9.4", unit: "mg/dL", refRange: "8.5 – 10.5", flag: "" },
      { name: "Magnesium", result: "1.9", unit: "mg/dL", refRange: "1.7 – 2.2", flag: "" },
      { name: "Phosphorus", result: "3.5", unit: "mg/dL", refRange: "2.5 – 4.5", flag: "" },
      { name: "Bicarbonate", result: "24", unit: "mEq/L", refRange: "22 – 29", flag: "" },
    ],
  },
  {
    title: "Lipid Panel",
    markers: [
      { name: "Total Cholesterol", result: "228", unit: "mg/dL", refRange: "< 200", flag: "H" },
      { name: "HDL Cholesterol", result: "48", unit: "mg/dL", refRange: "40 – 60", flag: "" },
      { name: "LDL Cholesterol (calc.)", result: "152", unit: "mg/dL", refRange: "< 100", flag: "H" },
      { name: "Triglycerides", result: "142", unit: "mg/dL", refRange: "< 150", flag: "" },
      { name: "VLDL Cholesterol", result: "28", unit: "mg/dL", refRange: "5 – 40", flag: "" },
      { name: "Non-HDL Cholesterol", result: "180", unit: "mg/dL", refRange: "< 130", flag: "H" },
      { name: "Apolipoprotein B", result: "118", unit: "mg/dL", refRange: "< 100", flag: "H" },
      { name: "Lipoprotein(a)", result: "45", unit: "nmol/L", refRange: "< 75", flag: "" },
    ],
  },
  {
    title: "Liver Function",
    markers: [
      { name: "ALT (GPT)", result: "32", unit: "U/L", refRange: "7 – 56", flag: "" },
      { name: "AST (GOT)", result: "28", unit: "U/L", refRange: "10 – 40", flag: "" },
      { name: "GGT", result: "38", unit: "U/L", refRange: "9 – 48", flag: "" },
      { name: "Alkaline Phosphatase (ALP)", result: "72", unit: "U/L", refRange: "44 – 147", flag: "" },
      { name: "Total Bilirubin", result: "0.9", unit: "mg/dL", refRange: "0.1 – 1.2", flag: "" },
      { name: "Direct Bilirubin", result: "0.2", unit: "mg/dL", refRange: "0.0 – 0.3", flag: "" },
      { name: "Albumin", result: "4.3", unit: "g/dL", refRange: "3.4 – 5.4", flag: "" },
      { name: "Total Protein", result: "7.1", unit: "g/dL", refRange: "6.0 – 8.3", flag: "" },
    ],
  },
  {
    title: "Kidney Function",
    markers: [
      { name: "Creatinine", result: "1.02", unit: "mg/dL", refRange: "0.74 – 1.35", flag: "" },
      { name: "BUN (Blood Urea Nitrogen)", result: "16", unit: "mg/dL", refRange: "6 – 20", flag: "" },
      { name: "eGFR (CKD-EPI)", result: "92", unit: "mL/min/1.73m2", refRange: "> 60", flag: "" },
      { name: "Cystatin C", result: "0.88", unit: "mg/L", refRange: "0.53 – 0.95", flag: "" },
      { name: "Urine Albumin/Creatinine Ratio", result: "12", unit: "mg/g", refRange: "< 30", flag: "" },
      { name: "BUN/Creatinine Ratio", result: "15.7", unit: "", refRange: "10 – 20", flag: "" },
    ],
  },
  {
    title: "Thyroid Panel",
    markers: [
      { name: "TSH", result: "2.8", unit: "mIU/L", refRange: "0.4 – 4.0", flag: "" },
      { name: "Free T4 (FT4)", result: "1.2", unit: "ng/dL", refRange: "0.8 – 1.8", flag: "" },
      { name: "Free T3 (FT3)", result: "3.1", unit: "pg/mL", refRange: "2.3 – 4.2", flag: "" },
      { name: "Reverse T3 (rT3)", result: "18", unit: "ng/dL", refRange: "9 – 27", flag: "" },
      { name: "Anti-TPO Antibodies", result: "12", unit: "IU/mL", refRange: "< 34", flag: "" },
      { name: "Anti-Thyroglobulin Antibodies", result: "1.2", unit: "IU/mL", refRange: "< 4", flag: "" },
    ],
  },
  {
    title: "Hormones",
    markers: [
      { name: "Total Testosterone", result: "520", unit: "ng/dL", refRange: "300 – 1000", flag: "" },
      { name: "Free Testosterone", result: "12.5", unit: "pg/mL", refRange: "5 – 25", flag: "" },
      { name: "SHBG", result: "38", unit: "nmol/L", refRange: "18 – 54", flag: "" },
      { name: "Estradiol (E2)", result: "28", unit: "pg/mL", refRange: "10 – 40", flag: "" },
      { name: "DHEA-S", result: "280", unit: "ug/dL", refRange: "150 – 500", flag: "" },
      { name: "Cortisol (AM, 07:30)", result: "14.2", unit: "ug/dL", refRange: "6 – 23", flag: "" },
      { name: "IGF-1", result: "185", unit: "ng/mL", refRange: "100 – 300", flag: "" },
      { name: "Prolactin", result: "8.5", unit: "ng/mL", refRange: "4 – 15", flag: "" },
      { name: "LH", result: "5.2", unit: "mIU/mL", refRange: "1.5 – 9.3", flag: "" },
      { name: "FSH", result: "4.8", unit: "mIU/mL", refRange: "1.5 – 12.4", flag: "" },
      { name: "Progesterone", result: "0.8", unit: "ng/mL", refRange: "0.2 – 1.4", flag: "" },
      { name: "Growth Hormone (GH)", result: "0.5", unit: "ng/mL", refRange: "0.0 – 3.0", flag: "" },
    ],
  },
  {
    title: "Inflammatory Markers",
    markers: [
      { name: "hs-CRP", result: "2.8", unit: "mg/L", refRange: "< 1.0", flag: "H" },
      { name: "Homocysteine", result: "11.2", unit: "umol/L", refRange: "5 – 15", flag: "" },
      { name: "Fibrinogen", result: "310", unit: "mg/dL", refRange: "200 – 400", flag: "" },
      { name: "Interleukin-6 (IL-6)", result: "3.2", unit: "pg/mL", refRange: "< 7", flag: "" },
      { name: "TNF-alpha", result: "1.8", unit: "pg/mL", refRange: "< 8.1", flag: "" },
      { name: "Ferritin", result: "185", unit: "ng/mL", refRange: "30 – 400", flag: "" },
      { name: "Transferrin Saturation", result: "32", unit: "%", refRange: "20 – 50", flag: "" },
      { name: "Serum Iron", result: "95", unit: "ug/dL", refRange: "65 – 175", flag: "" },
    ],
  },
  {
    title: "Vitamins & Nutrients",
    markers: [
      { name: "Vitamin D (25-OH)", result: "32", unit: "ng/mL", refRange: "30 – 100", flag: "" },
      { name: "Vitamin B12", result: "420", unit: "pg/mL", refRange: "200 – 900", flag: "" },
      { name: "Folate (Folic Acid)", result: "12.5", unit: "ng/mL", refRange: "3 – 20", flag: "" },
      { name: "Vitamin B6 (Pyridoxine)", result: "8.2", unit: "ng/mL", refRange: "5 – 50", flag: "" },
      { name: "Vitamin A (Retinol)", result: "55", unit: "ug/dL", refRange: "30 – 80", flag: "" },
      { name: "Vitamin E (Alpha-Tocopherol)", result: "12.5", unit: "mg/L", refRange: "5.5 – 17", flag: "" },
      { name: "Zinc", result: "85", unit: "ug/dL", refRange: "60 – 120", flag: "" },
      { name: "Selenium", result: "120", unit: "ug/L", refRange: "70 – 150", flag: "" },
      { name: "Copper", result: "110", unit: "ug/dL", refRange: "70 – 155", flag: "" },
      { name: "Omega-3 Index", result: "4.2", unit: "%", refRange: "> 8 (optimal)", flag: "L" },
      { name: "Coenzyme Q10 (CoQ10)", result: "0.85", unit: "ug/mL", refRange: "0.5 – 1.7", flag: "" },
      { name: "Iodine (urine)", result: "145", unit: "ug/L", refRange: "100 – 200", flag: "" },
    ],
  },
  {
    title: "Cardiac Markers",
    markers: [
      { name: "NT-proBNP", result: "45", unit: "pg/mL", refRange: "< 125", flag: "" },
      { name: "Troponin I (High-Sensitivity)", result: "<0.01", unit: "ng/mL", refRange: "< 0.04", flag: "" },
      { name: "D-Dimer", result: "0.3", unit: "mg/L", refRange: "< 0.5", flag: "" },
      { name: "LDH (Lactate Dehydrogenase)", result: "175", unit: "U/L", refRange: "140 – 280", flag: "" },
      { name: "CPK (Creatine Kinase)", result: "165", unit: "U/L", refRange: "38 – 174", flag: "" },
      { name: "Myoglobin", result: "35", unit: "ng/mL", refRange: "< 85", flag: "" },
    ],
  },
  {
    title: "Autoimmune & Other",
    markers: [
      { name: "ANA (Antinuclear Antibodies)", result: "Negative", unit: "", refRange: "Negative", flag: "" },
      { name: "Rheumatoid Factor (RF)", result: "8", unit: "IU/mL", refRange: "< 14", flag: "" },
      { name: "Anti-CCP Antibodies", result: "<7", unit: "U/mL", refRange: "< 20", flag: "" },
      { name: "HbA1c Variant Screen", result: "Normal", unit: "", refRange: "Normal", flag: "" },
      { name: "Blood Type (ABO/Rh)", result: "A+", unit: "", refRange: "—", flag: "" },
      { name: "PSA (Prostate Specific Antigen)", result: "1.2", unit: "ng/mL", refRange: "< 4.0", flag: "" },
      { name: "Vitamin K", result: "0.8", unit: "ng/mL", refRange: "0.1 – 2.2", flag: "" },
      { name: "Ceruloplasmin", result: "28", unit: "mg/dL", refRange: "20 – 60", flag: "" },
    ],
  },
];

// ─── Build ──────────────────────────────────────────────────────────────────

async function main() {
  const outDir = join(__dirname, "..", "test-fixtures", "pdf");
  mkdirSync(outDir, { recursive: true });

  console.log("\nGenerating comprehensive 101-marker PDF...\n");

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595, 842]); // A4
  let y = 842;

  // ── Header band ──
  drawRect(page, 0, y - 80, 595, 80, HEADER_BG);

  // Logo placeholder
  drawRect(page, 30, y - 65, 50, 50, WHITE);
  drawText(page, "SYN", 35, y - 44, fontBold, 11, HEADER_BG);
  drawText(page, "LAB", 36, y - 56, fontBold, 10, ACCENT);

  // Lab name & address
  drawText(page, "Synlab Analytics & Services GmbH", 100, y - 28, fontBold, 15, WHITE);
  drawText(page, "Moosacher Strasse 88, 80809 Munich, Germany", 100, y - 42, font, 8, rgb(0.75, 0.85, 0.78));
  drawText(page, "Tel: +49 89 741 30 0  |  kontakt@synlab.de  |  www.synlab.com", 100, y - 54, font, 7.5, rgb(0.75, 0.85, 0.78));
  drawText(page, "DAkkS Accredited — D-ML-13340-01-00 — ISO 15189:2022", 100, y - 66, font, 7, rgb(0.6, 0.75, 0.65));

  // Right side: report type
  drawText(page, "EXECUTIVE HEALTH", 440, y - 30, fontBold, 10, rgb(0.7, 0.9, 0.75));
  drawText(page, "PREMIUM PANEL", 450, y - 42, fontBold, 9, rgb(0.7, 0.9, 0.75));

  y -= 100;

  // ── Title ──
  drawText(page, "COMPREHENSIVE LABORATORY REPORT", 40, y, fontBold, 14, ACCENT);
  y -= 8;
  drawLine(page, 40, y, 560, y, BORDER_ACCENT, 1.5);
  y -= 18;

  // ── Patient info box ──
  drawRect(page, 40, y - 72, 250, 72, TABLE_BG);
  drawRect(page, 300, y - 72, 260, 72, TABLE_BG);

  // Left column — patient
  drawText(page, "Patient Information", 50, y - 12, fontBold, 9, ACCENT);
  drawText(page, "Name:  Thomas Muller", 50, y - 26, font, 8, DARK_GREY);
  drawText(page, "Date of Birth:  1984-03-15    Sex:  Male    Age:  42", 50, y - 38, font, 8, DARK_GREY);
  drawText(page, "Order ID:  SYN-2604-10-EHP-5582", 50, y - 50, font, 8, DARK_GREY);
  drawText(page, "Referring Physician:  Dr. med. Friedrich Weber", 50, y - 62, font, 8, DARK_GREY);

  // Right column — collection
  drawText(page, "Collection Details", 310, y - 12, fontBold, 9, ACCENT);
  drawText(page, "Collection Date:  2026-04-10  07:15", 310, y - 26, font, 8, DARK_GREY);
  drawText(page, "Report Date:  2026-04-11", 310, y - 38, font, 8, DARK_GREY);
  drawText(page, "Material:  Serum / EDTA whole blood / Urine", 310, y - 50, font, 8, DARK_GREY);
  drawText(page, "Fasting:  Yes (12h)", 310, y - 62, font, 8, DARK_GREY);

  y -= 90;

  // ── Clinical note ──
  drawRect(page, 40, y - 32, 520, 32, rgb(1, 0.97, 0.92));
  drawLine(page, 40, y, 560, y, rgb(0.9, 0.6, 0.2), 1);
  drawText(page, "CLINICAL NOTE:", 50, y - 12, fontBold, 7.5, rgb(0.7, 0.3, 0.0));
  drawText(page, "Executive health screen — asymptomatic male, family history of cardiovascular disease. Fasting sample.", 130, y - 12, font, 7.5, rgb(0.5, 0.3, 0.1));
  drawText(page, "Abnormal results flagged: H = above reference range, L = below reference range.", 50, y - 24, font, 7, MID_GREY);

  y -= 46;

  // ── Results sections ──
  let rowIndex = 0;
  for (const section of sections) {
    // Need at least ~100pt for a section start + a few rows
    if (y < 120) {
      page = doc.addPage([595, 842]);
      y = 820;
    }

    y = drawSectionTitle(page, y, section.title, fontBold);
    y = drawTableHeader(page, y, fontBold);

    for (const marker of section.markers) {
      if (y < 60) {
        page = doc.addPage([595, 842]);
        y = 820;
        // Re-draw section continuation header
        drawText(page, `${section.title.toUpperCase()} (continued)`, 50, y - 2, fontBold, 8, MID_GREY);
        y -= 16;
        y = drawTableHeader(page, y, fontBold);
      }
      y = drawMarkerRow(page, y, marker, font, fontBold, rowIndex);
      rowIndex++;
    }

    y -= 10;
  }

  // ── Summary box at the end ──
  if (y < 160) {
    page = doc.addPage([595, 842]);
    y = 820;
  }

  y -= 6;
  drawLine(page, 40, y, 560, y, BORDER_ACCENT, 1.5);
  y -= 16;
  drawText(page, "SUMMARY OF ABNORMAL FINDINGS", 40, y, fontBold, 10, ACCENT);
  y -= 18;

  const findings = [
    "Total Cholesterol 228 mg/dL (H) — above desirable range; consider dietary review",
    "LDL Cholesterol 152 mg/dL (H) — elevated; statin therapy may be considered given family history",
    "Non-HDL Cholesterol 180 mg/dL (H) — correlated with elevated LDL",
    "Apolipoprotein B 118 mg/dL (H) — elevated atherogenic particle count",
    "hs-CRP 2.8 mg/L (H) — intermediate cardiovascular risk; correlates with lipid profile",
    "Omega-3 Index 4.2% (L) — suboptimal; supplementation recommended (target > 8%)",
    "Fasting Glucose 98 mg/dL — upper normal; monitor annually with HbA1c",
    "Vitamin D 32 ng/mL — low-normal; supplementation may be beneficial (target 40-60 ng/mL)",
  ];

  for (const f of findings) {
    if (y < 60) {
      page = doc.addPage([595, 842]);
      y = 820;
    }
    drawText(page, `\u2022  ${f}`, 50, y, font, 7.5, DARK_GREY);
    y -= 13;
  }

  y -= 10;
  drawText(page, "Total biomarkers analyzed: 101", 50, y, fontBold, 8, ACCENT);
  y -= 14;
  drawText(page, "Methodology: Immunoassay (ECLIA/CLIA), enzymatic colorimetric, HPLC, nephelometry, flow cytometry.", 50, y, font, 7, MID_GREY);
  y -= 11;
  drawText(page, "Analyzers: Roche Cobas 8000 (chemistry/immunoassay), Sysmex XN-3100 (hematology), Waters UPLC (vitamins).", 50, y, font, 7, MID_GREY);

  // ── Footer on every page ──
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    drawLine(p, 40, 45, 560, 45, LIGHT_GREY, 0.5);
    drawText(p, "Accredited by DAkkS (Deutsche Akkreditierungsstelle) — Registration No. D-ML-13340-01-00. ISO 15189:2022 Medical Laboratories.", 40, 32, font, 6, MID_GREY);
    drawText(p, `Page ${i + 1} of ${pages.length}`, 510, 32, font, 6.5, MID_GREY);
    drawText(p, "This report is electronically validated and does not require a signature. Results apply only to the sample tested.", 40, 22, font, 5.5, MID_GREY);
  }

  const bytes = await doc.save();
  const outPath = join(outDir, "comprehensive-101-markers.pdf");
  writeFileSync(outPath, bytes);

  // Count markers
  let total = 0;
  for (const s of sections) total += s.markers.length;

  console.log(`  Done: comprehensive-101-markers.pdf`);
  console.log(`  ${pages.length} page(s), ${total} biomarkers, ${bytes.length} bytes`);
  console.log(`  Output: ${outPath}\n`);
}

main().catch((err) => {
  console.error("Error generating PDF:", err);
  process.exit(1);
});
