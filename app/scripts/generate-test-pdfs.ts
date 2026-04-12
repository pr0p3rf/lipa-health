/**
 * generate-test-pdfs.ts
 *
 * Generates 3 hyper-realistic European blood test PDFs using pdf-lib.
 *
 * Usage:  npx tsx scripts/generate-test-pdfs.ts
 * Output: test-fixtures/pdf/
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
const ACCENT_GREEN = rgb(0.0, 0.45, 0.3);
const HEADER_BG_BLUE = rgb(0.12, 0.24, 0.48);
const HEADER_BG_ORANGE = rgb(0.85, 0.35, 0.05);

// ─── types ──────────────────────────────────────────────────────────────────
interface Marker {
  name: string;
  result: string;
  unit: string;
  refRange: string;
  flag: "" | "H" | "L";
}

interface PatientInfo {
  name: string;
  dob: string;
  sex: string;
  collectionDate: string;
  reportDate: string;
  doctor: string;
  orderId: string;
}

interface LabInfo {
  name: string;
  address: string[];
  phone: string;
  email: string;
  accreditation: string;
  website: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGB
) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  _y2: number,
  color: RGB = LIGHT_GREY,
  thickness = 0.5
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: _y2 },
    color,
    thickness,
  });
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB = BLACK
) {
  page.drawText(text, { x, y, font, size, color });
}

// Column layout for the results table
const COL = {
  name: 50,
  result: 310,
  unit: 390,
  ref: 450,
  flag: 540,
};

function drawTableHeader(
  page: PDFPage,
  y: number,
  fontBold: PDFFont,
  style: "polish" | "dutch" | "euro"
) {
  const headerColor =
    style === "polish"
      ? HEADER_BG_BLUE
      : style === "dutch"
        ? HEADER_BG_ORANGE
        : ACCENT_GREEN;

  drawRect(page, 40, y - 4, 520, 18, headerColor);

  const labels = ["Test Name", "Result", "Unit", "Reference Range", "Flag"];
  const cols = [COL.name, COL.result, COL.unit, COL.ref, COL.flag];
  for (let i = 0; i < labels.length; i++) {
    drawText(page, labels[i], cols[i], y, fontBold, 8, WHITE);
  }
  return y - 22;
}

function drawMarkerRow(
  page: PDFPage,
  y: number,
  m: Marker,
  font: PDFFont,
  fontBold: PDFFont,
  rowIndex: number
): number {
  // alternating row background
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

function drawSectionTitle(
  page: PDFPage,
  y: number,
  title: string,
  fontBold: PDFFont,
  accentColor: RGB
): number {
  drawLine(page, 40, y + 4, 560, y + 4, accentColor, 1);
  drawText(page, title.toUpperCase(), 50, y - 10, fontBold, 9, accentColor);
  return y - 24;
}

// ─── Lab report builders ────────────────────────────────────────────────────

async function buildReport(opts: {
  lab: LabInfo;
  patient: PatientInfo;
  sections: { title: string; markers: Marker[] }[];
  style: "polish" | "dutch" | "euro";
  filename: string;
}) {
  const { lab, patient, sections, style, filename } = opts;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const accentColor =
    style === "polish"
      ? HEADER_BG_BLUE
      : style === "dutch"
        ? HEADER_BG_ORANGE
        : ACCENT_GREEN;

  // Count total rows to estimate pages
  let totalRows = 0;
  for (const s of sections) totalRows += s.markers.length + 2; // +2 for header + section title

  let page = doc.addPage([595, 842]); // A4
  let y = 842;

  // ── Header band ──
  drawRect(page, 0, y - 80, 595, 80, accentColor);

  // Logo placeholder (white square)
  drawRect(page, 30, y - 65, 50, 50, WHITE);
  drawText(page, "LAB", 40, y - 48, fontBold, 14, accentColor);

  // Lab name & address
  drawText(page, lab.name, 100, y - 28, fontBold, 16, WHITE);
  let addrY = y - 42;
  for (const line of lab.address) {
    drawText(page, line, 100, addrY, font, 8, rgb(0.85, 0.88, 0.95));
    addrY -= 11;
  }

  // Contact info right-aligned
  drawText(page, lab.phone, 430, y - 28, font, 8, rgb(0.85, 0.88, 0.95));
  drawText(page, lab.email, 430, y - 40, font, 8, rgb(0.85, 0.88, 0.95));
  drawText(page, lab.website, 430, y - 52, font, 8, rgb(0.85, 0.88, 0.95));

  y -= 100;

  // ── Title ──
  drawText(page, "LABORATORY TEST RESULTS", 40, y, fontBold, 14, accentColor);
  y -= 8;
  drawLine(page, 40, y, 560, y, accentColor, 1.5);
  y -= 18;

  // ── Patient info box ──
  drawRect(page, 40, y - 68, 250, 68, TABLE_BG);
  drawRect(page, 300, y - 68, 260, 68, TABLE_BG);

  // Left column
  drawText(page, "Patient Information", 50, y - 12, fontBold, 9, accentColor);
  drawText(page, `Name:  ${patient.name}`, 50, y - 26, font, 8, DARK_GREY);
  drawText(
    page,
    `Date of Birth:  ${patient.dob}    Sex:  ${patient.sex}`,
    50,
    y - 38,
    font,
    8,
    DARK_GREY
  );
  drawText(
    page,
    `Order ID:  ${patient.orderId}`,
    50,
    y - 50,
    font,
    8,
    DARK_GREY
  );
  drawText(
    page,
    `Referring Physician:  ${patient.doctor}`,
    50,
    y - 62,
    font,
    8,
    DARK_GREY
  );

  // Right column
  drawText(page, "Collection Details", 310, y - 12, fontBold, 9, accentColor);
  drawText(
    page,
    `Collection Date:  ${patient.collectionDate}`,
    310,
    y - 26,
    font,
    8,
    DARK_GREY
  );
  drawText(
    page,
    `Report Date:  ${patient.reportDate}`,
    310,
    y - 38,
    font,
    8,
    DARK_GREY
  );
  drawText(
    page,
    `Material:  Serum / EDTA whole blood`,
    310,
    y - 50,
    font,
    8,
    DARK_GREY
  );
  drawText(page, `Fasting:  Yes`, 310, y - 62, font, 8, DARK_GREY);

  y -= 86;

  // ── Results sections ──
  let rowIndex = 0;
  for (const section of sections) {
    // Check if we need a new page (need at least ~100pt for a section start)
    if (y < 120) {
      page = doc.addPage([595, 842]);
      y = 820;
    }

    y = drawSectionTitle(page, y, section.title, fontBold, accentColor);
    y = drawTableHeader(page, y, fontBold, style);

    for (const marker of section.markers) {
      if (y < 60) {
        // Footer area — new page
        page = doc.addPage([595, 842]);
        y = 820;
        y = drawTableHeader(page, y, fontBold, style);
      }
      y = drawMarkerRow(page, y, marker, font, fontBold, rowIndex);
      rowIndex++;
    }

    y -= 10;
  }

  // ── Footer on every page ──
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    drawLine(p, 40, 45, 560, 45, LIGHT_GREY, 0.5);
    drawText(
      p,
      lab.accreditation,
      40,
      32,
      font,
      6.5,
      MID_GREY
    );
    drawText(
      p,
      `Page ${i + 1} of ${pages.length}`,
      510,
      32,
      font,
      6.5,
      MID_GREY
    );
    drawText(
      p,
      "This report is electronically validated and does not require a signature.",
      40,
      22,
      font,
      6,
      MID_GREY
    );
  }

  const bytes = await doc.save();
  const outPath = join(__dirname, "..", "test-fixtures", "pdf", filename);
  writeFileSync(outPath, bytes);
  console.log(`  ✓ ${filename} (${pages.length} page(s), ${bytes.length} bytes)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 1 — Comprehensive panel (Polish lab — Diagnostyka style)
// Patient: Marek Kowalski, 38M
// ═══════════════════════════════════════════════════════════════════════════

const polishLab: LabInfo = {
  name: "Diagnostyka Laboratoria Medyczne",
  address: [
    "ul. Prof. M. Zyczkowskiego 16",
    "31-864 Krakow, Poland",
  ],
  phone: "+48 12 295 80 00",
  email: "kontakt@diagnostyka.pl",
  website: "www.diagnostyka.pl",
  accreditation:
    "Accredited by PCA (Polish Centre for Accreditation) — Certificate No. AB 1536. ISO 15189:2022 Medical Laboratories.",
};

const polishPatient: PatientInfo = {
  name: "Marek Kowalski",
  dob: "1988-02-14",
  sex: "Male",
  collectionDate: "2026-03-28  07:45",
  reportDate: "2026-03-29",
  doctor: "Dr. Anna Wisniewska",
  orderId: "DG-2026-0328-4471",
};

const polishSections: { title: string; markers: Marker[] }[] = [
  {
    title: "Complete Blood Count (CBC)",
    markers: [
      { name: "White Blood Cells (WBC)", result: "6.8", unit: "10^9/L", refRange: "4.0 – 10.0", flag: "" },
      { name: "Red Blood Cells (RBC)", result: "5.1", unit: "10^12/L", refRange: "4.5 – 5.5", flag: "" },
      { name: "Hemoglobin (HGB)", result: "15.2", unit: "g/dL", refRange: "13.5 – 17.5", flag: "" },
      { name: "Hematocrit (HCT)", result: "44.8", unit: "%", refRange: "40.0 – 54.0", flag: "" },
      { name: "MCV", result: "87.8", unit: "fL", refRange: "80.0 – 100.0", flag: "" },
      { name: "MCH", result: "29.8", unit: "pg", refRange: "27.0 – 33.0", flag: "" },
      { name: "MCHC", result: "33.9", unit: "g/dL", refRange: "32.0 – 36.0", flag: "" },
      { name: "Platelets (PLT)", result: "238", unit: "10^9/L", refRange: "150 – 400", flag: "" },
      { name: "Neutrophils", result: "3.9", unit: "10^9/L", refRange: "1.8 – 7.5", flag: "" },
      { name: "Lymphocytes", result: "2.1", unit: "10^9/L", refRange: "1.0 – 4.0", flag: "" },
    ],
  },
  {
    title: "Lipid Panel",
    markers: [
      { name: "Total Cholesterol", result: "228", unit: "mg/dL", refRange: "< 200", flag: "H" },
      { name: "LDL Cholesterol", result: "152", unit: "mg/dL", refRange: "< 130", flag: "H" },
      { name: "HDL Cholesterol", result: "48", unit: "mg/dL", refRange: "> 40", flag: "" },
      { name: "Triglycerides", result: "168", unit: "mg/dL", refRange: "< 150", flag: "H" },
      { name: "Non-HDL Cholesterol", result: "180", unit: "mg/dL", refRange: "< 160", flag: "H" },
    ],
  },
  {
    title: "Metabolic Panel",
    markers: [
      { name: "Fasting Glucose", result: "104", unit: "mg/dL", refRange: "70 – 99", flag: "H" },
      { name: "HbA1c", result: "5.6", unit: "%", refRange: "< 5.7", flag: "" },
      { name: "Creatinine", result: "0.98", unit: "mg/dL", refRange: "0.70 – 1.20", flag: "" },
      { name: "eGFR (CKD-EPI)", result: "98", unit: "mL/min/1.73m2", refRange: "> 90", flag: "" },
      { name: "Urea (BUN)", result: "14.2", unit: "mg/dL", refRange: "7.0 – 20.0", flag: "" },
      { name: "Uric Acid", result: "5.8", unit: "mg/dL", refRange: "3.5 – 7.2", flag: "" },
      { name: "AST (GOT)", result: "24", unit: "U/L", refRange: "< 40", flag: "" },
      { name: "ALT (GPT)", result: "31", unit: "U/L", refRange: "< 41", flag: "" },
      { name: "GGT", result: "28", unit: "U/L", refRange: "< 60", flag: "" },
      { name: "Total Bilirubin", result: "0.9", unit: "mg/dL", refRange: "0.2 – 1.2", flag: "" },
      { name: "Alkaline Phosphatase (ALP)", result: "68", unit: "U/L", refRange: "40 – 130", flag: "" },
    ],
  },
  {
    title: "Vitamins & Minerals",
    markers: [
      { name: "Vitamin D (25-OH)", result: "18.4", unit: "ng/mL", refRange: "30.0 – 100.0", flag: "L" },
      { name: "Vitamin B12", result: "412", unit: "pg/mL", refRange: "200 – 900", flag: "" },
      { name: "Folate", result: "8.7", unit: "ng/mL", refRange: "3.0 – 17.0", flag: "" },
      { name: "Iron", result: "88", unit: "ug/dL", refRange: "65 – 175", flag: "" },
      { name: "Ferritin", result: "124", unit: "ng/mL", refRange: "30 – 300", flag: "" },
      { name: "Magnesium", result: "2.1", unit: "mg/dL", refRange: "1.6 – 2.6", flag: "" },
    ],
  },
  {
    title: "Thyroid & Hormones",
    markers: [
      { name: "TSH", result: "2.14", unit: "mIU/L", refRange: "0.35 – 4.94", flag: "" },
      { name: "Free T4 (FT4)", result: "1.18", unit: "ng/dL", refRange: "0.70 – 1.48", flag: "" },
      { name: "Testosterone (Total)", result: "5.82", unit: "ng/mL", refRange: "2.49 – 8.36", flag: "" },
      { name: "Cortisol (morning)", result: "14.8", unit: "ug/dL", refRange: "6.2 – 19.4", flag: "" },
    ],
  },
  {
    title: "Inflammation & Other",
    markers: [
      { name: "C-Reactive Protein (hsCRP)", result: "1.4", unit: "mg/L", refRange: "< 3.0", flag: "" },
      { name: "ESR", result: "8", unit: "mm/h", refRange: "< 15", flag: "" },
      { name: "Homocysteine", result: "11.2", unit: "umol/L", refRange: "5.0 – 15.0", flag: "" },
      { name: "Total Protein", result: "7.1", unit: "g/dL", refRange: "6.0 – 8.3", flag: "" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 2 — Basic panel (Dutch lab)
// Patient: Maria van den Berg, 45F — iron deficiency, elevated TSH
// ═══════════════════════════════════════════════════════════════════════════

const dutchLab: LabInfo = {
  name: "Star-SHL Medisch Diagnostisch Centrum",
  address: [
    "Bergerweg 200",
    "6135 KC Sittard, Netherlands",
  ],
  phone: "+31 (0)46 459 77 00",
  email: "info@star-shl.nl",
  website: "www.star-shl.nl",
  accreditation:
    "Accredited by RvA (Raad voor Accreditatie) — Registration No. M008. ISO 15189:2022 Medical Laboratories.",
};

const dutchPatient: PatientInfo = {
  name: "Maria van den Berg",
  dob: "1981-06-22",
  sex: "Female",
  collectionDate: "2026-04-02  08:15",
  reportDate: "2026-04-03",
  doctor: "Dr. J.P. de Vries",
  orderId: "SHL-260402-8823",
};

const dutchSections: { title: string; markers: Marker[] }[] = [
  {
    title: "Hematology",
    markers: [
      { name: "Hemoglobin (Hb)", result: "12.4", unit: "g/dL", refRange: "12.0 – 16.0", flag: "" },
      { name: "Hematocrit (Ht)", result: "37.2", unit: "%", refRange: "36.0 – 46.0", flag: "" },
      { name: "MCV", result: "76.8", unit: "fL", refRange: "80.0 – 100.0", flag: "L" },
      { name: "White Blood Cells", result: "7.2", unit: "10^9/L", refRange: "4.0 – 10.0", flag: "" },
      { name: "Platelets", result: "312", unit: "10^9/L", refRange: "150 – 400", flag: "" },
    ],
  },
  {
    title: "Iron Studies",
    markers: [
      { name: "Iron (Fe)", result: "38", unit: "ug/dL", refRange: "60 – 170", flag: "L" },
      { name: "Ferritin", result: "8", unit: "ng/mL", refRange: "13 – 150", flag: "L" },
      { name: "Transferrin", result: "3.8", unit: "g/L", refRange: "2.0 – 3.6", flag: "H" },
      { name: "Transferrin Saturation (TSAT)", result: "10", unit: "%", refRange: "20 – 50", flag: "L" },
    ],
  },
  {
    title: "Thyroid Function",
    markers: [
      { name: "TSH", result: "5.82", unit: "mIU/L", refRange: "0.27 – 4.20", flag: "H" },
      { name: "Free T4 (FT4)", result: "0.92", unit: "ng/dL", refRange: "0.93 – 1.70", flag: "L" },
    ],
  },
  {
    title: "Basic Metabolic",
    markers: [
      { name: "Fasting Glucose", result: "91", unit: "mg/dL", refRange: "70 – 100", flag: "" },
      { name: "Creatinine", result: "0.74", unit: "mg/dL", refRange: "0.55 – 1.02", flag: "" },
      { name: "eGFR (CKD-EPI)", result: "102", unit: "mL/min/1.73m2", refRange: "> 90", flag: "" },
      { name: "Total Cholesterol", result: "198", unit: "mg/dL", refRange: "< 200", flag: "" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REPORT 3 — Hormone panel (general European lab)
// Patient: Isabelle Moreau, 52F — perimenopause
// ═══════════════════════════════════════════════════════════════════════════

const euroLab: LabInfo = {
  name: "Synlab Analytics & Services",
  address: [
    "Moosacher Strasse 88",
    "80809 Munich, Germany",
  ],
  phone: "+49 89 741 30 0",
  email: "kontakt@synlab.de",
  website: "www.synlab.com",
  accreditation:
    "Accredited by DAkkS (Deutsche Akkreditierungsstelle) — Registration No. D-ML-13340-01-00. ISO 15189:2022 Medical Laboratories.",
};

const euroPatient: PatientInfo = {
  name: "Isabelle Moreau",
  dob: "1974-09-03",
  sex: "Female",
  collectionDate: "2026-04-05  07:30",
  reportDate: "2026-04-07",
  doctor: "Dr. med. Klaus Fischer",
  orderId: "SYN-2604-07-2291",
};

const euroSections: { title: string; markers: Marker[] }[] = [
  {
    title: "Reproductive Hormones",
    markers: [
      { name: "Estradiol (E2)", result: "18", unit: "pg/mL", refRange: "30 – 400 (follicular)", flag: "L" },
      { name: "FSH", result: "58.4", unit: "mIU/mL", refRange: "3.5 – 12.5 (follicular)", flag: "H" },
      { name: "LH", result: "34.2", unit: "mIU/mL", refRange: "2.4 – 12.6 (follicular)", flag: "H" },
      { name: "Progesterone", result: "0.4", unit: "ng/mL", refRange: "0.2 – 1.5 (follicular)", flag: "" },
      { name: "Prolactin", result: "12.8", unit: "ng/mL", refRange: "4.8 – 23.3", flag: "" },
      { name: "AMH (Anti-Mullerian Hormone)", result: "0.18", unit: "ng/mL", refRange: "1.0 – 3.5", flag: "L" },
      { name: "SHBG", result: "68", unit: "nmol/L", refRange: "18 – 114", flag: "" },
      { name: "Total Testosterone", result: "0.22", unit: "ng/mL", refRange: "0.08 – 0.48", flag: "" },
      { name: "Free Testosterone", result: "1.8", unit: "pg/mL", refRange: "0.5 – 4.5", flag: "" },
      { name: "DHEA-S", result: "82", unit: "ug/dL", refRange: "35 – 430", flag: "" },
    ],
  },
  {
    title: "Thyroid Panel",
    markers: [
      { name: "TSH", result: "1.98", unit: "mIU/L", refRange: "0.27 – 4.20", flag: "" },
      { name: "Free T4 (FT4)", result: "1.14", unit: "ng/dL", refRange: "0.93 – 1.70", flag: "" },
      { name: "Free T3 (FT3)", result: "3.1", unit: "pg/mL", refRange: "2.0 – 4.4", flag: "" },
      { name: "Anti-TPO Antibodies", result: "< 10", unit: "IU/mL", refRange: "< 34", flag: "" },
      { name: "Anti-Thyroglobulin Ab", result: "< 15", unit: "IU/mL", refRange: "< 115", flag: "" },
    ],
  },
  {
    title: "Adrenal & Metabolic Hormones",
    markers: [
      { name: "Cortisol (morning)", result: "16.2", unit: "ug/dL", refRange: "6.2 – 19.4", flag: "" },
      { name: "Insulin (fasting)", result: "7.4", unit: "uIU/mL", refRange: "2.6 – 24.9", flag: "" },
      { name: "IGF-1", result: "128", unit: "ng/mL", refRange: "87 – 238", flag: "" },
    ],
  },
  {
    title: "Bone & Vitamin Markers",
    markers: [
      { name: "Vitamin D (25-OH)", result: "34.2", unit: "ng/mL", refRange: "30.0 – 100.0", flag: "" },
      { name: "Calcium (total)", result: "9.4", unit: "mg/dL", refRange: "8.6 – 10.2", flag: "" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const outDir = join(__dirname, "..", "test-fixtures", "pdf");
  mkdirSync(outDir, { recursive: true });

  console.log("\nGenerating test PDFs…\n");

  await buildReport({
    lab: polishLab,
    patient: polishPatient,
    sections: polishSections,
    style: "polish",
    filename: "comprehensive-panel-polish.pdf",
  });

  await buildReport({
    lab: dutchLab,
    patient: dutchPatient,
    sections: dutchSections,
    style: "dutch",
    filename: "basic-panel-dutch.pdf",
  });

  await buildReport({
    lab: euroLab,
    patient: euroPatient,
    sections: euroSections,
    style: "euro",
    filename: "hormone-panel-european.pdf",
  });

  console.log(`\nDone — files written to ${outDir}\n`);
}

main().catch((err) => {
  console.error("Error generating PDFs:", err);
  process.exit(1);
});
