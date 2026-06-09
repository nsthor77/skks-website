-- ============================================================================
-- School Info Self-Service Fix
-- ----------------------------------------------------------------------------
-- PROBLEM: pages/school-settings.html read/wrote a single-row `school_settings`
-- table that is NOT scoped per-tenant and is NOT the table the public website,
-- certificates, ปพ. documents and branding actually read from (those read
-- `schools`). So when an owner edited the school name / principal / address /
-- motto, the change never reached the rest of the system.
--
-- FIX: edit the real `schools` row for the current tenant, via two
-- SECURITY DEFINER RPCs so we don't depend on a direct UPDATE RLS policy.
--   - get_school_info()         -> current school's editable fields (any staff)
--   - save_school_info(p jsonb) -> update current school (owner/admin only)
--
-- Columns school_name / school_name_th / school_address / school_phone /
-- school_email / school_website / motto / motto_th / principal_name /
-- principal_name_th / description already exist on `schools`
-- (used by get_public_school). We only ADD the few that may be missing.
-- Safe to re-run.
-- ============================================================================

-- 1) Make sure every column the form edits exists on schools -----------------
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS principal_title      text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS principal_title_th   text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS description          text;  -- "เกี่ยวกับโรงเรียน" / about

-- 2) Read current school's editable info -------------------------------------
CREATE OR REPLACE FUNCTION public.get_school_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id',                 s.id,
    'slug',               s.slug,
    'custom_domain',      s.custom_domain,
    'school_name',        s.school_name,
    'school_name_th',     s.school_name_th,
    'name',               s.name,
    'school_address',     s.school_address,
    'school_phone',       s.school_phone,
    'school_email',       s.school_email,
    'school_website',     s.school_website,
    'registration_number',s.registration_number,
    'motto',              s.motto,
    'motto_th',           s.motto_th,
    'description',        s.description,
    'principal_name',     s.principal_name,
    'principal_name_th',  s.principal_name_th,
    'principal_title',    s.principal_title,
    'principal_title_th', s.principal_title_th,
    'logo_url',           s.logo_url,
    'theme_color',        s.theme_color
  ) INTO v
  FROM public.schools s
  WHERE s.id = public.current_school_id();
  RETURN v;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END $$;

-- 3) Save current school's info (owner / admin only) -------------------------
-- COALESCE(p->>'x', col): an absent key keeps the existing value; an explicit
-- '' clears the field (empty string is NOT NULL), which is the intended UX.
CREATE OR REPLACE FUNCTION public.save_school_info(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    principal_title_th  = COALESCE(p->>'principal_title_th',  principal_title_th)
  WHERE id = sid;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

GRANT EXECUTE ON FUNCTION public.get_school_info()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_school_info(jsonb)  TO authenticated;

-- Verify:
--   SELECT public.get_school_info();
--   SELECT public.save_school_info('{"school_name_th":"โรงเรียนทดสอบ"}'::jsonb);
