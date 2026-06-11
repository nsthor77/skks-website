-- ============================================================================
-- FIX: schools table missing school-info columns (found by live API testing)
-- ----------------------------------------------------------------------------
-- Live test result: SELECT s.school_name_th FROM schools → 42703 column does
-- not exist. These columns only ever existed on the legacy single-row
-- `school_settings` table, so every function that references them on `schools`
-- (get_public_school, get_school_info, save_school_info, certs-era
-- get_school_branding) failed at RUNTIME (CREATE FUNCTION doesn't validate
-- column refs). Effect: tenant public websites fell through to login,
-- school-settings save would error.
--
-- FIX: (1) add all referenced columns to schools (IF NOT EXISTS — safe),
--      (2) migrate SKKS's data from legacy school_settings into its schools row
--          (only fills NULLs; wrapped so a missing legacy table never fails).
-- Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

-- 1) Add every column the school-info functions reference -------------------
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS school_name         text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS school_name_th      text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS school_address      text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS school_phone        text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS school_email        text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS school_website      text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS motto               text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS motto_th            text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS principal_name      text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS principal_name_th   text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS principal_title     text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS principal_title_th  text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS description         text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url            text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS theme_color         text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS site_mode           text DEFAULT 'managed';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS plan                text;

-- 2) Migrate SKKS's real data from legacy school_settings (fills NULLs only) -
DO $$
DECLARE skks uuid;
BEGIN
  SELECT id INTO skks FROM public.schools
  WHERE slug = 'skks' OR lower(coalesce(custom_domain, '')) LIKE '%suansonkk%'
  ORDER BY created_at LIMIT 1;
  IF skks IS NULL THEN RAISE NOTICE 'SKKS school row not found — skip migration'; RETURN; END IF;

  UPDATE public.schools s SET
    school_name        = COALESCE(s.school_name,        (SELECT ss.school_name        FROM public.school_settings ss LIMIT 1)),
    school_name_th     = COALESCE(s.school_name_th,     (SELECT ss.school_name_th     FROM public.school_settings ss LIMIT 1)),
    school_address     = COALESCE(s.school_address,     (SELECT ss.school_address     FROM public.school_settings ss LIMIT 1)),
    school_phone       = COALESCE(s.school_phone,       (SELECT ss.school_phone       FROM public.school_settings ss LIMIT 1)),
    school_email       = COALESCE(s.school_email,       (SELECT ss.school_email       FROM public.school_settings ss LIMIT 1)),
    school_website     = COALESCE(s.school_website,     (SELECT ss.school_website     FROM public.school_settings ss LIMIT 1)),
    motto              = COALESCE(s.motto,              (SELECT ss.motto              FROM public.school_settings ss LIMIT 1)),
    motto_th           = COALESCE(s.motto_th,           (SELECT ss.motto_th           FROM public.school_settings ss LIMIT 1)),
    principal_name     = COALESCE(s.principal_name,     (SELECT ss.principal_name     FROM public.school_settings ss LIMIT 1)),
    principal_name_th  = COALESCE(s.principal_name_th,  (SELECT ss.principal_name_th  FROM public.school_settings ss LIMIT 1)),
    principal_title    = COALESCE(s.principal_title,    (SELECT ss.principal_title    FROM public.school_settings ss LIMIT 1)),
    principal_title_th = COALESCE(s.principal_title_th, (SELECT ss.principal_title_th FROM public.school_settings ss LIMIT 1)),
    registration_number= COALESCE(s.registration_number,(SELECT ss.registration_number FROM public.school_settings ss LIMIT 1))
  WHERE s.id = skks;
  RAISE NOTICE 'SKKS data migrated from school_settings';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'school_settings migration skipped: %', SQLERRM;
END $$;

-- Verify (both should return data, not an error):
--   SELECT public.get_public_school('smart-test', NULL);
--   SELECT slug, school_name_th, site_mode, plan FROM public.schools;
