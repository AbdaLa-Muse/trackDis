-- TradeFlow Weekly Reports Gallery — isolated ADDITIVE migration.
-- Run ONCE in Supabase SQL Editor AFTER existing TradeFlow v11.13.18 SQL.
-- Do NOT rerun the entire base SQL. Does not touch trading tables, PIN, or existing records.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tradeflow_weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end date NOT NULL,
  title text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  original_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','application/pdf')),
  file_size bigint NOT NULL CHECK (file_size BETWEEN 1 AND 12582912),
  storage_path text NOT NULL UNIQUE,
  thumbnail_path text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tradeflow_weekly_reports_dates CHECK (week_end >= week_start),
  CONSTRAINT tradeflow_weekly_reports_title_size CHECK (char_length(title) <= 180),
  CONSTRAINT tradeflow_weekly_reports_notes_size CHECK (char_length(notes) <= 2000)
);

CREATE INDEX IF NOT EXISTS tradeflow_weekly_reports_period_idx
  ON public.tradeflow_weekly_reports (week_start DESC, created_at DESC);

ALTER TABLE public.tradeflow_weekly_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tradeflow_weekly_reports FROM PUBLIC, anon, authenticated;
-- Only server-side service_role can access metadata. No browser-side direct grants/policies.
GRANT ALL ON TABLE public.tradeflow_weekly_reports TO service_role;

-- Existing PIN/session validation is intentionally reused by the new server-side Edge Function.
-- Keep execute revoked from anon/authenticated; only the service_role may call this validator.
GRANT EXECUTE ON FUNCTION public.tradeflow_session_valid(text) TO service_role;

-- PRIVATE storage bucket; no public storage.objects policies are added.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tradeflow-weekly-reports','tradeflow-weekly-reports',false,12582912,
        ARRAY['image/png','image/jpeg','application/pdf'])
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification after install:
-- SELECT id, public FROM storage.buckets WHERE id='tradeflow-weekly-reports';
-- SELECT * FROM public.tradeflow_weekly_reports LIMIT 1;
-- Do not give anon/authenticated direct bucket read or write policies.
-- Rollback (ONLY after backing up/removing reports safely):
-- DROP TABLE IF EXISTS public.tradeflow_weekly_reports;
-- DELETE FROM storage.buckets WHERE id='tradeflow-weekly-reports'; -- bucket must be EMPTY
-- REVOKE EXECUTE ON FUNCTION public.tradeflow_session_valid(text) FROM service_role;
