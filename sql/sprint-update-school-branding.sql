-- ============================================================================
-- update_school_branding RPC  (logo + theme color self-service)
-- ----------------------------------------------------------------------------
-- pages/brand-setup.html calls supabaseClient.rpc('update_school_branding',
-- { p_logo_url, p_theme_color }) when the owner saves their logo + theme color.
-- The READER get_school_branding() lives in sprint-certs-multitenant.sql, but the
-- WRITER was never committed as a migration — so on any environment where it was
-- not pasted by hand, the brand "Save" button throws. This commits it.
--
-- Idempotent & safe to re-run. Run on prod "School Kit".
-- ============================================================================

-- DROP first so we can (re)create with these exact parameter names even if an
-- older version with different param names exists (Postgres forbids renaming
-- input params via CREATE OR REPLACE).
DROP FUNCTION IF EXISTS public.update_school_branding(text, text);

CREATE OR REPLACE FUNCTION public.update_school_branding(p_logo_url text, p_theme_color text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sid uuid;
BEGIN
  -- owner / admin only (teacher excluded)
  IF public.current_user_role() NOT IN ('owner','admin','staff','developer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'คุณไม่มีสิทธิ์แก้ไขแบรนด์โรงเรียน (เฉพาะเจ้าของ/ผู้ดูแล)');
  END IF;

  sid := public.current_school_id();
  IF sid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียนของคุณ');
  END IF;

  -- NULL keeps the existing value; '' clears it (lets the owner remove a logo).
  UPDATE public.schools SET
    logo_url    = COALESCE(p_logo_url,    logo_url),
    theme_color = COALESCE(p_theme_color, theme_color)
  WHERE id = sid;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

GRANT EXECUTE ON FUNCTION public.update_school_branding(text, text) TO authenticated;

-- Verify:
--   SELECT public.update_school_branding('/images/logo.png', '#1B5E3F');
--   SELECT public.get_school_branding();
