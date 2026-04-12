-- =====================================================================
-- LIVING RESEARCH™ ENGINE — Database Schema
-- =====================================================================
-- Creates the research corpus, embeddings, and citation infrastructure
-- for Lipa's proprietary biomarker analysis engine.
--
-- Requirements:
--   1. Enable pgvector extension in Supabase Dashboard:
--      Database → Extensions → Search "vector" → Enable
--
--   2. Run this migration to create tables
--
--   3. Run the ingestion script to populate the corpus
-- =====================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================
-- Table: research_studies
-- Purpose: Store peer-reviewed studies from PubMed and other sources
-- =====================================================================

CREATE TABLE IF NOT EXISTS research_studies (
  id BIGSERIAL PRIMARY KEY,

  -- Identifiers
  pmid TEXT UNIQUE,  -- PubMed ID
  pmcid TEXT,        -- PubMed Central ID (for open access)
  doi TEXT,          -- Digital Object Identifier

  -- Metadata
  title TEXT NOT NULL,
  abstract TEXT,
  authors TEXT[],
  journal TEXT,
  publication_year INT,
  publication_date DATE,

  -- Classification
  study_type TEXT,  -- e.g., 'Randomized Controlled Trial', 'Meta-Analysis', 'Observational'
  is_systematic_review BOOLEAN DEFAULT FALSE,
  is_meta_analysis BOOLEAN DEFAULT FALSE,
  is_clinical_trial BOOLEAN DEFAULT FALSE,

  -- Quality signals
  mesh_terms TEXT[],
  keywords TEXT[],
  sample_size INT,

  -- Relevance tagging (populated during ingestion or manually)
  biomarker_tags TEXT[],       -- e.g., ['hs-CRP', 'inflammation']
  intervention_tags TEXT[],    -- e.g., ['omega-3', 'curcumin']
  outcome_tags TEXT[],          -- e.g., ['cardiovascular-risk']
  population_tags TEXT[],       -- e.g., ['adults', 'elderly', 'male']

  -- Evidence grading
  grade_score TEXT CHECK (grade_score IN ('HIGH', 'MODERATE', 'LOW', 'VERY_LOW')),
  confidence_score FLOAT DEFAULT 0.5,  -- 0.0 to 1.0, weighted by study type + sample size

  -- Source tracking
  source TEXT DEFAULT 'pubmed',  -- 'pubmed', 'europe_pmc', 'cochrane', 'openalex'
  full_text_available BOOLEAN DEFAULT FALSE,
  full_text_url TEXT,

  -- Vector embedding (OpenAI text-embedding-3-large produces 3072-dim vectors)
  -- We use 1536 for compatibility with text-embedding-3-small or reduced version
  embedding vector(1536),

  -- Timestamps
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_research_studies_pmid ON research_studies(pmid);
CREATE INDEX idx_research_studies_doi ON research_studies(doi);
CREATE INDEX idx_research_studies_biomarker_tags ON research_studies USING GIN(biomarker_tags);
CREATE INDEX idx_research_studies_intervention_tags ON research_studies USING GIN(intervention_tags);
CREATE INDEX idx_research_studies_publication_year ON research_studies(publication_year DESC);
CREATE INDEX idx_research_studies_grade_score ON research_studies(grade_score);

-- HNSW index for fast vector similarity search
-- This is the key performance enabler for RAG retrieval
CREATE INDEX idx_research_studies_embedding ON research_studies
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =====================================================================
-- Table: biomarker_reference
-- Purpose: Store canonical biomarker definitions and ranges
-- =====================================================================

CREATE TABLE IF NOT EXISTS biomarker_reference (
  id BIGSERIAL PRIMARY KEY,

  -- Canonical name and aliases
  canonical_name TEXT NOT NULL UNIQUE,
  aliases TEXT[],  -- Alternative names (e.g., 'High-sensitivity CRP', 'hsCRP', 'hs-CRP')
  abbreviation TEXT,

  -- Category
  category TEXT,  -- 'cardiovascular', 'metabolic', 'hormonal', 'inflammatory', 'nutritional', 'liver', 'kidney', 'thyroid', 'hematology', 'lipid', 'other'
  subcategory TEXT,

  -- Description
  short_description TEXT,
  what_it_measures TEXT,
  why_it_matters TEXT,

  -- Reference ranges (general population)
  standard_unit TEXT,
  ref_low FLOAT,
  ref_high FLOAT,
  optimal_low FLOAT,  -- Lipa's evidence-based optimal range
  optimal_high FLOAT,

  -- Sex-specific ranges
  ref_low_male FLOAT,
  ref_high_male FLOAT,
  optimal_low_male FLOAT,
  optimal_high_male FLOAT,
  ref_low_female FLOAT,
  ref_high_female FLOAT,
  optimal_low_female FLOAT,
  optimal_high_female FLOAT,

  -- Affecting factors (JSON for flexibility)
  affecting_factors JSONB,

  -- Research
  total_studies INT DEFAULT 0,  -- Cached count of studies tagged with this biomarker
  key_study_pmids TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_biomarker_reference_canonical_name ON biomarker_reference(canonical_name);
CREATE INDEX idx_biomarker_reference_category ON biomarker_reference(category);
CREATE INDEX idx_biomarker_reference_aliases ON biomarker_reference USING GIN(aliases);

-- =====================================================================
-- Table: analysis_citations
-- Purpose: Track which studies were cited in each analysis (for audit)
-- =====================================================================

CREATE TABLE IF NOT EXISTS analysis_citations (
  id BIGSERIAL PRIMARY KEY,

  -- Link to user's analysis
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  biomarker_result_id BIGINT REFERENCES biomarker_results(id) ON DELETE CASCADE,

  -- Citation details
  study_id BIGINT REFERENCES research_studies(id),
  relevance_score FLOAT,  -- 0.0 to 1.0
  retrieval_rank INT,  -- Position in retrieved results (1 = most relevant)

  -- Context
  biomarker_name TEXT,
  query_used TEXT,  -- What query was used to retrieve this study

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_citations_user ON analysis_citations(user_id);
CREATE INDEX idx_analysis_citations_biomarker ON analysis_citations(biomarker_result_id);

-- =====================================================================
-- Table: user_analyses
-- Purpose: Store the generated AI analysis per biomarker per test
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_analyses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  biomarker_result_id BIGINT REFERENCES biomarker_results(id) ON DELETE CASCADE,

  -- The analysis content
  biomarker_name TEXT NOT NULL,
  status TEXT,  -- 'optimal', 'normal', 'borderline', 'out_of_range'
  flag TEXT,    -- 'low', 'high', 'optimal', 'borderline'

  -- AI-generated content
  summary TEXT,                 -- 1-2 sentence takeaway
  what_it_means TEXT,           -- Plain-English explanation
  what_research_shows TEXT,     -- Synthesis of retrieved studies
  related_patterns TEXT,        -- Cross-marker context if relevant
  suggested_exploration TEXT,   -- Educational "research has studied..." content

  -- Metadata
  citation_count INT DEFAULT 0,
  avg_study_year FLOAT,
  highest_evidence_grade TEXT,
  retrieval_time_ms INT,
  generation_time_ms INT,

  -- Legal/compliance
  disclaimer_shown BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_analyses_user ON user_analyses(user_id);
CREATE INDEX idx_user_analyses_biomarker ON user_analyses(biomarker_result_id);

-- =====================================================================
-- Function: match_research_studies
-- Purpose: Vector similarity search for RAG retrieval
-- =====================================================================

CREATE OR REPLACE FUNCTION match_research_studies (
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 20,
  filter_biomarker TEXT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  pmid TEXT,
  title TEXT,
  abstract TEXT,
  authors TEXT[],
  journal TEXT,
  publication_year INT,
  study_type TEXT,
  grade_score TEXT,
  confidence_score FLOAT,
  biomarker_tags TEXT[],
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rs.id,
    rs.pmid,
    rs.title,
    rs.abstract,
    rs.authors,
    rs.journal,
    rs.publication_year,
    rs.study_type,
    rs.grade_score,
    rs.confidence_score,
    rs.biomarker_tags,
    1 - (rs.embedding <=> query_embedding) AS similarity
  FROM research_studies rs
  WHERE
    (1 - (rs.embedding <=> query_embedding)) > match_threshold
    AND (filter_biomarker IS NULL OR filter_biomarker = ANY(rs.biomarker_tags))
  ORDER BY rs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================================
-- Row Level Security (RLS)
-- =====================================================================

ALTER TABLE research_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE biomarker_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analyses ENABLE ROW LEVEL SECURITY;

-- Research studies and biomarker reference are publicly readable
CREATE POLICY "Research studies are publicly readable"
  ON research_studies FOR SELECT USING (true);

CREATE POLICY "Biomarker reference is publicly readable"
  ON biomarker_reference FOR SELECT USING (true);

-- Only service role can write (for ingestion pipeline)
CREATE POLICY "Only service role can insert research studies"
  ON research_studies FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update research studies"
  ON research_studies FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can insert biomarker reference"
  ON biomarker_reference FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update biomarker reference"
  ON biomarker_reference FOR UPDATE USING (auth.role() = 'service_role');

-- User analyses and citations are user-scoped
CREATE POLICY "Users can read their own analyses"
  ON user_analyses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert user analyses"
  ON user_analyses FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can read their own citations"
  ON analysis_citations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert citations"
  ON analysis_citations FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- =====================================================================
-- Comments for future developers
-- =====================================================================

COMMENT ON TABLE research_studies IS 'Living Research corpus: peer-reviewed studies from PubMed and other sources, embedded for semantic retrieval';
COMMENT ON TABLE biomarker_reference IS 'Canonical biomarker definitions with evidence-based optimal ranges';
COMMENT ON TABLE user_analyses IS 'AI-generated analysis per biomarker per user, with citation tracking';
COMMENT ON TABLE analysis_citations IS 'Audit trail: which studies were cited for which analyses';
COMMENT ON FUNCTION match_research_studies IS 'Vector similarity search with optional biomarker filter for RAG retrieval';
