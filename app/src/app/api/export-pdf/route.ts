import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Brand colors ───────────────────────────────────────────────
const LIPA_GREEN = rgb(0x1b / 255, 0x6b / 255, 0x4a / 255); // #1B6B4A
const DARK_INK = rgb(0x0f / 255, 0x1a / 255, 0x15 / 255);   // #0F1A15
const CREAM_BG = rgb(0xf8 / 255, 0xf5 / 255, 0xef / 255);   // #F8F5EF
const WHITE = rgb(1, 1, 1);
const LIGHT_GREEN = rgb(0x1b / 255, 0x6b / 255, 0x4a / 255);
const MUTED_TEXT = rgb(0.45, 0.5, 0.45);
const ROW_ALT = rgb(0xf2 / 255, 0xef / 255, 0xe8 / 255);    // subtle alternating row

// ─── Layout ─────────────────────────────────────────────────────
const PAGE_W = 595.28;  // A4
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 35;
const HEADER_LINE_Y = PAGE_H - 40;

// ─── Category → Body System mapping ────────────────────────────
const SYSTEM_MAP: Record<string, string> = {
  cardiac: "Cardiovascular",
  lipid: "Cardiovascular",
  metabolic: "Metabolic",
  hormonal: "Hormonal",
  thyroid: "Hormonal",
  inflammatory: "Inflammatory",
  nutrient: "Nutritional",
  hematology: "Hematology",
  liver: "Liver",
  kidney: "Kidney",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  optimal: "Optimal",
  in_range: "In range",
  borderline: "Borderline",
  out_of_range: "Out of range",
};

// ─── Helpers ────────────────────────────────────────────────────

function truncateToSentences(text: string, max: number): string {
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, max).join(" ").trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface PageContext {
  doc: PDFDocument;
  fonts: { bold: PDFFont; regular: PDFFont; oblique: PDFFont };
  pages: PDFPage[];
  currentPage: PDFPage;
  y: number;
  pageNum: number;
}

function addPage(ctx: PageContext): PDFPage {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pages.push(page);
  ctx.currentPage = page;
  ctx.pageNum++;
  ctx.y = PAGE_H - 60;

  // cream background
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM_BG });

  // green header line
  page.drawRectangle({ x: MARGIN, y: HEADER_LINE_Y, width: CONTENT_W, height: 1.5, color: LIPA_GREEN });

  return page;
}

function drawFooter(page: PDFPage, font: PDFFont, pageNum: number, totalPages: number) {
  const footerText = "Lipa Health \u00B7 lipa.health";
  const pageText = `${pageNum} / ${totalPages}`;

  page.drawText(footerText, {
    x: MARGIN,
    y: FOOTER_Y,
    size: 8,
    font,
    color: MUTED_TEXT,
  });

  const pageTextW = font.widthOfTextAtSize(pageText, 8);
  page.drawText(pageText, {
    x: PAGE_W - MARGIN - pageTextW,
    y: FOOTER_Y,
    size: 8,
    font,
    color: MUTED_TEXT,
  });
}

function ensureSpace(ctx: PageContext, needed: number): void {
  if (ctx.y - needed < FOOTER_Y + 20) {
    addPage(ctx);
  }
}

function drawSectionTitle(ctx: PageContext, title: string) {
  ensureSpace(ctx, 30);
  ctx.y -= 8;

  ctx.currentPage.drawRectangle({
    x: MARGIN,
    y: ctx.y - 4,
    width: CONTENT_W,
    height: 22,
    color: LIPA_GREEN,
  });

  ctx.currentPage.drawText(title.toUpperCase(), {
    x: MARGIN + 8,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.bold,
    color: WHITE,
  });

  ctx.y -= 26;
}

function drawWrappedText(
  ctx: PageContext,
  text: string,
  x: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  maxWidth: number
): void {
  const lines = wrapText(text, font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, size + 4);
    ctx.currentPage.drawText(line, { x, y: ctx.y, size, font, color });
    ctx.y -= size + 4;
  }
}

// ─── Main handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, testDate } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // ──────────────────────────────────────────────────
    // 1. Fetch all data
    // ──────────────────────────────────────────────────

    // Get profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Get biomarker results (most recent test date, or specific date)
    let resultsQuery = supabase
      .from("biomarker_results")
      .select("*")
      .eq("user_id", userId)
      .order("test_date", { ascending: false });

    if (testDate) {
      resultsQuery = resultsQuery.eq("test_date", testDate);
    }

    const { data: biomarkerResults } = await resultsQuery;

    if (!biomarkerResults || biomarkerResults.length === 0) {
      return NextResponse.json({ error: "No biomarker results found" }, { status: 404 });
    }

    // Use the test_date from the most recent result if not specified
    const effectiveDate = testDate || biomarkerResults[0].test_date;

    // Filter to only this test date
    const results = testDate
      ? biomarkerResults
      : biomarkerResults.filter((r: any) => r.test_date === effectiveDate);

    // Get analyses for these results
    const resultIds = results.map((r: any) => r.id);
    const { data: analyses } = await supabase
      .from("user_analyses")
      .select("*")
      .in("biomarker_result_id", resultIds);

    // Get action plan
    const { data: actionPlan } = await supabase
      .from("action_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("test_date", effectiveDate)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get user email from Supabase auth
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email || "Unknown";
    const displayName = email.split("@")[0];

    // ──────────────────────────────────────────────────
    // 2. Build the PDF
    // ──────────────────────────────────────────────────

    const doc = await PDFDocument.create();
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);

    const fonts = { bold, regular, oblique };

    const ctx: PageContext = {
      doc,
      fonts,
      pages: [],
      currentPage: null as any,
      y: 0,
      pageNum: 0,
    };

    // ════════════════════════════════════════════════
    // PAGE 1 — Cover / Summary
    // ════════════════════════════════════════════════

    const coverPage = addPage(ctx);

    // Logo area
    ctx.y = PAGE_H - 100;

    coverPage.drawText("LIPA", {
      x: MARGIN,
      y: ctx.y,
      size: 48,
      font: bold,
      color: LIPA_GREEN,
    });

    // Leaf accent (small green circle as leaf stand-in)
    coverPage.drawCircle({
      x: MARGIN + bold.widthOfTextAtSize("LIPA", 48) + 16,
      y: ctx.y + 32,
      size: 6,
      color: LIPA_GREEN,
    });

    ctx.y -= 14;
    coverPage.drawText("HEALTH", {
      x: MARGIN,
      y: ctx.y,
      size: 14,
      font: regular,
      color: LIPA_GREEN,
    });

    // Title
    ctx.y -= 50;
    coverPage.drawText("Your Blood Test Analysis", {
      x: MARGIN,
      y: ctx.y,
      size: 26,
      font: bold,
      color: DARK_INK,
    });

    // Divider
    ctx.y -= 16;
    coverPage.drawRectangle({
      x: MARGIN,
      y: ctx.y,
      width: 80,
      height: 3,
      color: LIPA_GREEN,
    });

    // Patient info
    ctx.y -= 30;
    const infoLines = [
      `Patient: ${displayName}`,
      `Test date: ${effectiveDate || "Not specified"}`,
      `Markers analyzed: ${results.length}`,
    ];

    for (const line of infoLines) {
      coverPage.drawText(line, {
        x: MARGIN,
        y: ctx.y,
        size: 11,
        font: regular,
        color: DARK_INK,
      });
      ctx.y -= 18;
    }

    // Status breakdown
    const statusCounts = { optimal: 0, in_range: 0, borderline: 0, out_of_range: 0 };
    const analysisMap = new Map<string, any>();

    if (analyses) {
      for (const a of analyses) {
        const key = a.status as keyof typeof statusCounts;
        if (key in statusCounts) statusCounts[key]++;
        analysisMap.set(a.biomarker_result_id, a);
      }
    }

    ctx.y -= 10;
    coverPage.drawText("Status Breakdown", {
      x: MARGIN,
      y: ctx.y,
      size: 13,
      font: bold,
      color: DARK_INK,
    });
    ctx.y -= 22;

    const statusColors: Record<string, ReturnType<typeof rgb>> = {
      optimal: rgb(0.1, 0.6, 0.3),
      in_range: rgb(0.2, 0.5, 0.4),
      borderline: rgb(0.8, 0.6, 0.0),
      out_of_range: rgb(0.8, 0.2, 0.15),
    };

    const barWidth = CONTENT_W;
    const barHeight = 28;
    const total = results.length || 1;

    // Draw status bar
    let barX = MARGIN;
    for (const [status, count] of Object.entries(statusCounts)) {
      if (count === 0) continue;
      const segWidth = (count / total) * barWidth;
      coverPage.drawRectangle({
        x: barX,
        y: ctx.y,
        width: segWidth,
        height: barHeight,
        color: statusColors[status],
      });

      if (segWidth > 30) {
        coverPage.drawText(`${count}`, {
          x: barX + segWidth / 2 - 4,
          y: ctx.y + 9,
          size: 10,
          font: bold,
          color: WHITE,
        });
      }
      barX += segWidth;
    }
    ctx.y -= barHeight + 6;

    // Legend
    const legendItems = [
      { label: `${statusCounts.optimal} Optimal`, color: statusColors.optimal },
      { label: `${statusCounts.in_range} In range`, color: statusColors.in_range },
      { label: `${statusCounts.borderline} Borderline`, color: statusColors.borderline },
      { label: `${statusCounts.out_of_range} Out of range`, color: statusColors.out_of_range },
    ];

    let legendX = MARGIN;
    for (const item of legendItems) {
      coverPage.drawCircle({ x: legendX + 4, y: ctx.y + 4, size: 4, color: item.color });
      coverPage.drawText(item.label, {
        x: legendX + 14,
        y: ctx.y,
        size: 8,
        font: regular,
        color: DARK_INK,
      });
      legendX += regular.widthOfTextAtSize(item.label, 8) + 28;
    }
    ctx.y -= 30;

    // Biological age (if profile has it)
    if (profile?.biological_age) {
      coverPage.drawText(`Biological Age Estimate: ${profile.biological_age}`, {
        x: MARGIN,
        y: ctx.y,
        size: 12,
        font: bold,
        color: LIPA_GREEN,
      });
      ctx.y -= 24;
    }

    // "Here's what stood out" section
    const flaggedAnalyses = (analyses || []).filter(
      (a: any) => a.status === "borderline" || a.status === "out_of_range"
    );

    if (flaggedAnalyses.length > 0) {
      ctx.y -= 6;
      coverPage.drawText("Here\u2019s what stood out", {
        x: MARGIN,
        y: ctx.y,
        size: 14,
        font: bold,
        color: DARK_INK,
      });
      ctx.y -= 20;

      for (const a of flaggedAnalyses) {
        ensureSpace(ctx, 36);

        const statusLabel = a.status === "out_of_range" ? "\u26A0" : "\u25CF";
        const statusColor =
          a.status === "out_of_range" ? statusColors.out_of_range : statusColors.borderline;

        const result = results.find((r: any) => r.id === a.biomarker_result_id);
        const valueStr = result ? ` \u2014 ${result.value} ${result.unit || ""}` : "";
        const headline = `${statusLabel} ${a.biomarker_name}${valueStr}`;

        ctx.currentPage.drawText(headline, {
          x: MARGIN + 6,
          y: ctx.y,
          size: 10,
          font: bold,
          color: statusColor,
        });
        ctx.y -= 14;

        if (a.summary) {
          const summary = truncateToSentences(a.summary, 1);
          drawWrappedText(ctx, summary, MARGIN + 16, 9, regular, MUTED_TEXT, CONTENT_W - 20);
          ctx.y -= 4;
        }
      }
    }

    // Cover footer disclaimer
    ctx.y = FOOTER_Y + 18;
    const disclaimer1 = "Generated by Lipa Health \u00B7 lipa.health \u00B7 Educational content, not medical advice";
    const d1W = regular.widthOfTextAtSize(disclaimer1, 7);
    coverPage.drawText(disclaimer1, {
      x: (PAGE_W - d1W) / 2,
      y: ctx.y,
      size: 7,
      font: oblique,
      color: MUTED_TEXT,
    });

    // ════════════════════════════════════════════════
    // PAGE 2+ — Biomarker Details by Body System
    // ════════════════════════════════════════════════

    // Group results by body system
    const systemGroups = new Map<string, any[]>();
    for (const r of results) {
      const system = SYSTEM_MAP[r.category] || "Other";
      if (!systemGroups.has(system)) systemGroups.set(system, []);
      systemGroups.get(system)!.push(r);
    }

    // Preferred ordering
    const systemOrder = [
      "Cardiovascular",
      "Metabolic",
      "Hormonal",
      "Inflammatory",
      "Nutritional",
      "Hematology",
      "Liver",
      "Kidney",
      "Other",
    ];

    addPage(ctx);

    ctx.currentPage.drawText("Biomarker Details", {
      x: MARGIN,
      y: ctx.y,
      size: 18,
      font: bold,
      color: DARK_INK,
    });
    ctx.y -= 28;

    for (const system of systemOrder) {
      const group = systemGroups.get(system);
      if (!group || group.length === 0) continue;

      drawSectionTitle(ctx, system);

      // Table header
      ensureSpace(ctx, 20);
      const colX = {
        name: MARGIN + 6,
        value: MARGIN + 180,
        ref: MARGIN + 260,
        status: MARGIN + 370,
      };

      ctx.currentPage.drawText("Marker", { x: colX.name, y: ctx.y, size: 8, font: bold, color: MUTED_TEXT });
      ctx.currentPage.drawText("Result", { x: colX.value, y: ctx.y, size: 8, font: bold, color: MUTED_TEXT });
      ctx.currentPage.drawText("Reference Range", { x: colX.ref, y: ctx.y, size: 8, font: bold, color: MUTED_TEXT });
      ctx.currentPage.drawText("Status", { x: colX.status, y: ctx.y, size: 8, font: bold, color: MUTED_TEXT });
      ctx.y -= 16;

      for (let i = 0; i < group.length; i++) {
        const r = group[i];
        const analysis = analysisMap.get(r.id);
        const status = analysis?.status || "in_range";
        const isFlagged = status === "borderline" || status === "out_of_range";

        // Estimate row height
        const explanationLines =
          isFlagged && analysis?.what_it_means
            ? wrapText(truncateToSentences(analysis.what_it_means, 2), regular, 8, CONTENT_W - 20)
            : [];
        const rowHeight = 18 + (explanationLines.length > 0 ? explanationLines.length * 12 + 4 : 0);

        ensureSpace(ctx, rowHeight);

        // Alternating row background
        if (i % 2 === 0) {
          ctx.currentPage.drawRectangle({
            x: MARGIN,
            y: ctx.y - (rowHeight - 14),
            width: CONTENT_W,
            height: rowHeight,
            color: ROW_ALT,
          });
        }

        // Name (truncate if too long)
        let markerName = r.biomarker;
        while (bold.widthOfTextAtSize(markerName, 9) > 165 && markerName.length > 3) {
          markerName = markerName.slice(0, -1);
        }
        if (markerName !== r.biomarker) markerName += "\u2026";

        ctx.currentPage.drawText(markerName, {
          x: colX.name,
          y: ctx.y,
          size: 9,
          font: bold,
          color: DARK_INK,
        });

        // Value + unit
        const valueText = `${r.value} ${r.unit || ""}`.trim();
        ctx.currentPage.drawText(valueText, {
          x: colX.value,
          y: ctx.y,
          size: 9,
          font: regular,
          color: DARK_INK,
        });

        // Reference range
        const refText =
          r.ref_low != null && r.ref_high != null
            ? `${r.ref_low} \u2013 ${r.ref_high}`
            : r.ref_low != null
            ? `> ${r.ref_low}`
            : r.ref_high != null
            ? `< ${r.ref_high}`
            : "\u2014";
        ctx.currentPage.drawText(refText, {
          x: colX.ref,
          y: ctx.y,
          size: 9,
          font: regular,
          color: MUTED_TEXT,
        });

        // Status pill
        const statusLabel = STATUS_LABELS[status] || status;
        const statusColor = statusColors[status] || MUTED_TEXT;
        ctx.currentPage.drawText(statusLabel, {
          x: colX.status,
          y: ctx.y,
          size: 9,
          font: bold,
          color: statusColor,
        });

        ctx.y -= 16;

        // Explanation for flagged markers
        if (explanationLines.length > 0) {
          for (const line of explanationLines) {
            ctx.currentPage.drawText(line, {
              x: MARGIN + 12,
              y: ctx.y,
              size: 8,
              font: oblique,
              color: MUTED_TEXT,
            });
            ctx.y -= 12;
          }
          ctx.y -= 2;
        }
      }

      ctx.y -= 8;
    }

    // ════════════════════════════════════════════════
    // LAST PAGE — Action Plan Summary
    // ════════════════════════════════════════════════

    if (actionPlan) {
      addPage(ctx);

      ctx.currentPage.drawText("Your Action Plan", {
        x: MARGIN,
        y: ctx.y,
        size: 18,
        font: bold,
        color: DARK_INK,
      });
      ctx.y -= 28;

      // Overall summary
      if (actionPlan.overall_summary) {
        drawWrappedText(ctx, actionPlan.overall_summary, MARGIN, 10, regular, DARK_INK, CONTENT_W);
        ctx.y -= 16;
      }

      // Domains
      const domains = actionPlan.domains || [];
      for (const domain of domains) {
        ensureSpace(ctx, 50);

        // Domain header
        ctx.currentPage.drawRectangle({
          x: MARGIN,
          y: ctx.y - 2,
          width: CONTENT_W,
          height: 20,
          color: LIPA_GREEN,
        });

        ctx.currentPage.drawText(domain.name || domain.domain || "Recommendation", {
          x: MARGIN + 8,
          y: ctx.y + 2,
          size: 10,
          font: bold,
          color: WHITE,
        });
        ctx.y -= 24;

        // Recommendations
        const recs = domain.recommendations || domain.actions || [];
        for (const rec of recs) {
          ensureSpace(ctx, 20);
          const recText = typeof rec === "string" ? rec : rec.title || rec.action || rec.text || "";
          if (recText) {
            drawWrappedText(ctx, `\u2022 ${recText}`, MARGIN + 10, 9, regular, DARK_INK, CONTENT_W - 14);
            ctx.y -= 4;
          }
        }

        ctx.y -= 8;
      }

      // Disclaimer
      ctx.y -= 12;
      ensureSpace(ctx, 70);

      ctx.currentPage.drawRectangle({
        x: MARGIN,
        y: ctx.y - 50,
        width: CONTENT_W,
        height: 60,
        color: rgb(0.95, 0.93, 0.88),
      });

      const disclaimerText =
        actionPlan.disclaimer ||
        "This report is educational content based on peer-reviewed research. It is not medical advice. Please consult your healthcare provider.";

      drawWrappedText(
        ctx,
        disclaimerText,
        MARGIN + 10,
        8,
        oblique,
        MUTED_TEXT,
        CONTENT_W - 20
      );
    }

    // ──────────────────────────────────────────────────
    // 3. Finalize — add footers to all pages
    // ──────────────────────────────────────────────────

    const totalPages = ctx.pages.length;
    for (let i = 0; i < totalPages; i++) {
      drawFooter(ctx.pages[i], regular, i + 1, totalPages);
    }

    // ──────────────────────────────────────────────────
    // 4. Serialize and return
    // ──────────────────────────────────────────────────

    const pdfBytes = await doc.save();
    const dateStr = effectiveDate || new Date().toISOString().split("T")[0];

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lipa-report-${dateStr}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[export-pdf] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error.message },
      { status: 500 }
    );
  }
}
