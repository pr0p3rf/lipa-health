-- =====================================================================
-- Lipa — action_plans: persist cross_marker_patterns
-- The summary prompt asks Claude for a cross_marker_patterns array
-- with research_backing + severity + clinical_significance, but the
-- existing schema only had columns for overall_summary, disclaimer,
-- and domains — so Claude's pattern output was being thrown away on
-- INSERT. This adds the column so the data lands.
-- =====================================================================

alter table action_plans
  add column if not exists cross_marker_patterns jsonb not null default '[]';
