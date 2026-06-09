-- ============================================================================
-- Site Mode — per-tenant "what shows at the homepage"
-- ----------------------------------------------------------------------------
-- Each school chooses how its homepage ({slug}.panyaschoolkit.com/) behaves:
--   'managed'  = ใช้เว็บของเรา  → show the public website (school-public.html)
--   'external' = มีเว็บเองอยู่แล้ว → homepage goes straight to Login
--   'app_only' = ใช้เฉพาะโปรแกรม → homepage goes straight to Login
-- (external & app_only behave the same at runtime — only the guidance differs.)
-- Default = 'managed'. Idempotent & safe to re-run. Run on prod "School Kit".
-- ============================================================================

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS site_mode text DEFAULT 'managed';
UPDATE public.schools SET site_mode = 'managed' WHERE site_mode IS NULL;

-- 1) get_public_school → now also returns site_mode (anon, for the homepage router)
CREATE OR REPLACE FUNCTION public.get_public_school(p_slug text DEFAULT NULL, p_domain text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF COALESCE(p_slug,'') = '' AND COALESCE(p_domain,'') = '' THEN
    RETURN jsonb_build_object('error','no_key');
  END IF;
  SELECT jsonb_build_object(
    'id', s.id, 'slug', s.slug,
    'name', COALESCE(s.school_name_th, s.school_name, s.name),
    'name_en', s.school_name,
    'address', s.school_address, 'phone', s.school_phone, 'email', s.school_email,
    'website', s.school_website, 'motto', COALESCE(s.motto_th, s.motto),
    'principal', COALESCE(s.principal_name_th, s.principal_name),
    'about', s.description,
    'logo_url', s.logo_url, 'theme_color', s.theme_color,
    'site_mode', COALESCE(s.site_mode, 'managed')
  ) INTO v
  FROM public.schools s
  WHERE (NULLIF(p_slug,'') IS NOT NULL AND lower(s.slug) = lower(p_slug))
     OR (NULLIF(p_domain,'') IS NOT NULL AND lower(s.custom_domain) = lower(p_domain))
  LIMIT 1;

  IF v IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
  RETURN jsonb_build_object('success', true, 'school', v);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_school TO anon, authenticated;

-- 2) get_school_info → add site_mode (for the settings page)
CREATE OR REPLACE FUNCTION public.get_school_info()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'custom_domain', s.custom_domain,
    'school_name', s.school_name, 'school_name_th', s.school_name_th, 'name', s.name,
    'school_address', s.school_address, 'school_phone', s.school_phone,
    'school_email', s.school_email, 'school_website', s.school_website,
    'registration_number', s.registration_number,
    'motto', s.motto, 'motto_th', s.motto_th, 'description', s.description,
    'principal_name', s.principal_name, 'principal_name_th', s.principal_name_th,
    'principal_title', s.principal_title, 'principal_title_th', s.principal_title_th,
    'logo_url', s.logo_url, 'theme_color', s.theme_color,
    'site_mode', COALESCE(s.site_mode, 'managed')
  ) INTO v
  FROM public.schools s
  WHERE s.id = public.current_school_id();
  RETURN v;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END $$;

-- 3) save_school_info → can now also set site_mode
CREATE OR REPLACE FUNCTION public.save_school_info(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  IF public.current_user_role() NOT IN ('owner','admin','staff','developer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'คุณไม่มีสิทธิ์แก้ไขข้อมูลโรงเรียน (เฉพาะเจ้าของ/ผู้ดูแล)');
  END IF;
  sid := public.current_school_id();
  IF sid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียนของคุณ');
  END IF;

  UPDATE public.schools SET
    school_name         = COALESCE(p->>'school_name',         school_name),
    school_name_th      = COALESCE(p->>'school_name_th',      school_name_th),
    school_address      = COALESCE(p->>'school_address',      school_address),
    school_phone        = COALESCE(p->>'school_phone',        school_phone),
    school_email        = COALESCE(p->>'school_email',        school_email),
    school_website      = COALESCE(p->>'school_website',      school_website),
    registration_number = COALESCE(p->>'registration_number', registration_number),
    motto               = COALESCE(p->>'motto',               motto),
    motto_th            = COALESCE(p->>'motto_th',            motto_th),
    description         = COALESCE(p->>'description',         description),
    principal_name      = COALESCE(p->>'principal_name',      principal_name),
    principal_name_th   = COALESCE(p->>'principal_name_th',   principal_name_th),
    principal_title     = COALESCE(p->>'principal_title',     principal_title),
    principal_title_th  = COALESCE(p->>'principal_title_th',  principal_title_th),
    site_mode           = COALESCE(p->>'site_mode',           site_mode)
  WHERE id = sid;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

GRANT EXECUTE ON FUNCTION public.get_school_info()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_school_info(jsonb) TO authenticated;

-- Verify:
--   SELECT public.get_public_school('skks', NULL);   -- should include "site_mode"
--   SELECT public.save_school_info('{"site_mode":"managed"}'::jsonb);
