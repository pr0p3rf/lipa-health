/**
 * =====================================================================
 * LIPA — Synthetic Blood Test Fixture Generator
 * =====================================================================
 *
 * Generates realistic fake blood test PDFs for testing the analyze API.
 * Covers different lab formats, languages, panel sizes, and edge cases.
 *
 * Usage:
 *   npx tsx scripts/generate-test-fixtures.ts
 *
 * Outputs:
 *   scripts/test-fixtures/synthetic-*.pdf
 * =====================================================================
 */

import * as fs from "fs";
import * as path from "path";

const FIXTURES_DIR = path.resolve(process.cwd(), "scripts/test-fixtures");

if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

// ---------------------------------------------------------------------
// Biomarker data pools (realistic values with intentional variations)
// ---------------------------------------------------------------------

interface Marker {
  name: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
}

const COMPREHENSIVE_PANEL: Marker[] = [
  // Lipids
  { name: "Total Cholesterol", value: 198, unit: "mg/dL", ref_low: 125, ref_high: 200 },
  { name: "LDL Cholesterol", value: 118, unit: "mg/dL", ref_low: 0, ref_high: 100 },
  { name: "HDL Cholesterol", value: 52, unit: "mg/dL", ref_low: 40, ref_high: null },
  { name: "Triglycerides", value: 142, unit: "mg/dL", ref_low: 0, ref_high: 150 },
  { name: "Non-HDL Cholesterol", value: 146, unit: "mg/dL", ref_low: 0, ref_high: 130 },
  { name: "ApoB", value: 98, unit: "mg/dL", ref_low: 40, ref_high: 125 },

  // Inflammatory
  { name: "hs-CRP", value: 2.4, unit: "mg/L", ref_low: 0.0, ref_high: 3.0 },
  { name: "ESR", value: 12, unit: "mm/hr", ref_low: 0, ref_high: 20 },

  // Metabolic
  { name: "Fasting Glucose", value: 92, unit: "mg/dL", ref_low: 70, ref_high: 99 },
  { name: "HbA1c", value: 5.4, unit: "%", ref_low: 4.0, ref_high: 5.7 },
  { name: "Fasting Insulin", value: 9.2, unit: "μIU/mL", ref_low: 2.6, ref_high: 24.9 },

  // Liver
  { name: "ALT", value: 28, unit: "U/L", ref_low: 7, ref_high: 56 },
  { name: "AST", value: 22, unit: "U/L", ref_low: 10, ref_high: 40 },
  { name: "GGT", value: 24, unit: "U/L", ref_low: 9, ref_high: 48 },
  { name: "Alkaline Phosphatase", value: 78, unit: "U/L", ref_low: 40, ref_high: 129 },
  { name: "Total Bilirubin", value: 0.8, unit: "mg/dL", ref_low: 0.2, ref_high: 1.2 },
  { name: "Albumin", value: 4.4, unit: "g/dL", ref_low: 3.5, ref_high: 5.0 },

  // Kidney
  { name: "Creatinine", value: 0.98, unit: "mg/dL", ref_low: 0.6, ref_high: 1.3 },
  { name: "eGFR", value: 94, unit: "mL/min/1.73m²", ref_low: 60, ref_high: null },
  { name: "BUN", value: 14, unit: "mg/dL", ref_low: 7, ref_high: 20 },
  { name: "Uric Acid", value: 5.6, unit: "mg/dL", ref_low: 3.5, ref_high: 7.2 },

  // Thyroid
  { name: "TSH", value: 2.1, unit: "mIU/L", ref_low: 0.4, ref_high: 4.5 },
  { name: "Free T3", value: 3.4, unit: "pg/mL", ref_low: 2.3, ref_high: 4.2 },
  { name: "Free T4", value: 1.2, unit: "ng/dL", ref_low: 0.8, ref_high: 1.8 },

  // Hormones
  { name: "Total Testosterone", value: 612, unit: "ng/dL", ref_low: 264, ref_high: 916 },
  { name: "Free Testosterone", value: 12.4, unit: "pg/mL", ref_low: 5.0, ref_high: 21.0 },
  { name: "SHBG", value: 32, unit: "nmol/L", ref_low: 10, ref_high: 57 },
  { name: "Estradiol", value: 26, unit: "pg/mL", ref_low: 10, ref_high: 40 },
  { name: "Cortisol", value: 14.2, unit: "μg/dL", ref_low: 6.2, ref_high: 19.4 },
  { name: "DHEA-S", value: 275, unit: "μg/dL", ref_low: 80, ref_high: 560 },

  // Nutrients
  { name: "Vitamin D (25-OH)", value: 38, unit: "ng/mL", ref_low: 30, ref_high: 100 },
  { name: "Vitamin B12", value: 520, unit: "pg/mL", ref_low: 200, ref_high: 900 },
  { name: "Folate", value: 12, unit: "ng/mL", ref_low: 3, ref_high: 17 },
  { name: "Ferritin", value: 135, unit: "ng/mL", ref_low: 30, ref_high: 400 },
  { name: "Iron", value: 98, unit: "μg/dL", ref_low: 60, ref_high: 170 },
  { name: "Magnesium", value: 2.1, unit: "mg/dL", ref_low: 1.7, ref_high: 2.2 },

  // CBC
  { name: "Hemoglobin", value: 15.4, unit: "g/dL", ref_low: 13.5, ref_high: 17.5 },
  { name: "Hematocrit", value: 46, unit: "%", ref_low: 38.8, ref_high: 50.0 },
  { name: "WBC", value: 6.8, unit: "K/μL", ref_low: 4.5, ref_high: 11.0 },
  { name: "Platelets", value: 248, unit: "K/μL", ref_low: 150, ref_high: 450 },
];

// TRT-focused panel
const TRT_PANEL: Marker[] = [
  { name: "Total Testosterone", value: 398, unit: "ng/dL", ref_low: 264, ref_high: 916 },
  { name: "Free Testosterone", value: 7.2, unit: "pg/mL", ref_low: 5.0, ref_high: 21.0 },
  { name: "Bioavailable Testosterone", value: 178, unit: "ng/dL", ref_low: 131, ref_high: 682 },
  { name: "SHBG", value: 48, unit: "nmol/L", ref_low: 10, ref_high: 57 },
  { name: "Estradiol", value: 32, unit: "pg/mL", ref_low: 10, ref_high: 40 },
  { name: "Dihydrotestosterone", value: 58, unit: "ng/dL", ref_low: 30, ref_high: 85 },
  { name: "LH", value: 4.2, unit: "IU/L", ref_low: 1.7, ref_high: 8.6 },
  { name: "FSH", value: 5.8, unit: "IU/L", ref_low: 1.5, ref_high: 12.4 },
  { name: "Prolactin", value: 8.2, unit: "ng/mL", ref_low: 4.0, ref_high: 15.0 },
  { name: "Hematocrit", value: 51, unit: "%", ref_low: 38.8, ref_high: 50.0 }, // Slightly elevated
  { name: "Hemoglobin", value: 17.2, unit: "g/dL", ref_low: 13.5, ref_high: 17.5 },
  { name: "PSA", value: 0.9, unit: "ng/mL", ref_low: 0, ref_high: 4.0 },
];

// Partial panel with some values out of range
const PARTIAL_WITH_ISSUES: Marker[] = [
  { name: "hs-CRP", value: 4.8, unit: "mg/L", ref_low: 0.0, ref_high: 3.0 }, // HIGH
  { name: "Vitamin D (25-OH)", value: 22, unit: "ng/mL", ref_low: 30, ref_high: 100 }, // LOW
  { name: "Ferritin", value: 520, unit: "ng/mL", ref_low: 30, ref_high: 400 }, // HIGH
  { name: "Fasting Insulin", value: 18, unit: "μIU/mL", ref_low: 2.6, ref_high: 24.9 }, // In range but high
  { name: "HbA1c", value: 5.8, unit: "%", ref_low: 4.0, ref_high: 5.7 }, // Slightly elevated
  { name: "Total Testosterone", value: 245, unit: "ng/dL", ref_low: 264, ref_high: 916 }, // LOW
  { name: "Homocysteine", value: 14.2, unit: "μmol/L", ref_low: 3.7, ref_high: 15.0 }, // Borderline
];

// ---------------------------------------------------------------------
// PDF generation (using pdf-lib for portability)
// ---------------------------------------------------------------------

interface LabTemplate {
  name: string;
  labName: string;
  headerText: string;
  language: string;
  markers: Marker[];
  filename: string;
}

const TEMPLATES: LabTemplate[] = [
  {
    name: "Thriva-style (UK)",
    labName: "THRIVA",
    headerText: "Blood Test Results",
    language: "en",
    markers: COMPREHENSIVE_PANEL,
    filename: "synthetic-thriva-style.pdf",
  },
  {
    name: "Medichecks-style (UK)",
    labName: "MEDICHECKS",
    headerText: "Advanced Well Woman / Man Blood Test",
    language: "en",
    markers: COMPREHENSIVE_PANEL,
    filename: "synthetic-medichecks-style.pdf",
  },
  {
    name: "TRT monitoring panel",
    labName: "CLINICAL LABS",
    headerText: "Hormone Panel — Testosterone Replacement Monitoring",
    language: "en",
    markers: TRT_PANEL,
    filename: "synthetic-trt-panel.pdf",
  },
  {
    name: "Panel with issues",
    labName: "GENERIC LAB",
    headerText: "Routine Blood Panel",
    language: "en",
    markers: PARTIAL_WITH_ISSUES,
    filename: "synthetic-panel-with-issues.pdf",
  },
];

async function generatePDF(template: LabTemplate): Promise<void> {
  // Dynamically import pdf-lib
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  let y = height - 50;
  const leftMargin = 50;
  const lineHeight = 16;

  // Header
  page.drawText(template.labName, {
    x: leftMargin,
    y,
    size: 18,
    font: bold,
    color: rgb(0.1, 0.42, 0.29), // Lipa green-ish
  });
  y -= 20;

  page.drawText(template.headerText, {
    x: leftMargin,
    y,
    size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 20;

  page.drawText(
    `Sample collected: ${new Date().toLocaleDateString("en-GB")}  |  Patient: Test Subject  |  ID: ${Math.floor(Math.random() * 900000) + 100000}`,
    {
      x: leftMargin,
      y,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    }
  );
  y -= 30;

  // Table header
  page.drawText("BIOMARKER", { x: leftMargin, y, size: 9, font: bold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("RESULT", { x: leftMargin + 220, y, size: 9, font: bold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("UNIT", { x: leftMargin + 310, y, size: 9, font: bold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("REFERENCE RANGE", { x: leftMargin + 380, y, size: 9, font: bold, color: rgb(0.3, 0.3, 0.3) });
  y -= 5;

  page.drawLine({
    start: { x: leftMargin, y },
    end: { x: width - leftMargin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 15;

  // Markers
  for (const marker of template.markers) {
    if (y < 80) {
      page = pdfDoc.addPage([595, 842]);
      y = height - 50;
    }

    // Determine if value is out of range
    const isHigh = marker.ref_high !== null && marker.value > marker.ref_high;
    const isLow = marker.ref_low !== null && marker.value < marker.ref_low;
    const isOutOfRange = isHigh || isLow;

    const textColor = isOutOfRange ? rgb(0.7, 0.1, 0.1) : rgb(0.1, 0.1, 0.1);

    // Name
    page.drawText(marker.name, { x: leftMargin, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });

    // Value
    page.drawText(String(marker.value), {
      x: leftMargin + 220,
      y,
      size: 10,
      font: bold,
      color: textColor,
    });

    // Flag indicator
    if (isOutOfRange) {
      page.drawText(isHigh ? "H" : "L", {
        x: leftMargin + 270,
        y,
        size: 9,
        font: bold,
        color: rgb(0.7, 0.1, 0.1),
      });
    }

    // Unit
    page.drawText(marker.unit, { x: leftMargin + 310, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

    // Reference range
    const rangeStr =
      marker.ref_low !== null && marker.ref_high !== null
        ? `${marker.ref_low} - ${marker.ref_high}`
        : marker.ref_low !== null
        ? `> ${marker.ref_low}`
        : marker.ref_high !== null
        ? `< ${marker.ref_high}`
        : "N/A";

    page.drawText(rangeStr, { x: leftMargin + 380, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

    y -= lineHeight;
  }

  // Footer
  y -= 20;
  page.drawLine({
    start: { x: leftMargin, y },
    end: { x: width - leftMargin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 15;
  page.drawText(
    "SYNTHETIC TEST DATA — NOT A REAL LAB REPORT — FOR LIPA ENGINEERING TESTING ONLY",
    {
      x: leftMargin,
      y,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
    }
  );

  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(FIXTURES_DIR, template.filename);
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`✓ Generated: ${template.filename} (${template.markers.length} markers)`);
}

async function main() {
  console.log("Generating synthetic blood test fixtures...\n");

  for (const template of TEMPLATES) {
    try {
      await generatePDF(template);
    } catch (err: any) {
      console.error(`Failed to generate ${template.filename}:`, err.message);
    }
  }

  console.log(`\n📁 Fixtures saved to: ${FIXTURES_DIR}`);
  console.log("\nNext step: Run test harness");
  console.log("  npx tsx scripts/test-analyze.ts");
}

main().catch(console.error);
