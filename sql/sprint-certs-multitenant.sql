-- ============================================================================
-- Certificates: multi-tenant isolation + tenant-aware verification
-- ============================================================================
-- Fixes: (1) certificates table had NO school_id + public-read RLS = cross-tenant
-- leak; (2) get_school_branding now returns principal/slug/custom_domain so certs
-- render the SCHOOL's own identity (not hardcoded SKKS); (3) verify_certificate()
-- = safe anon RPC for the QR-scan public verify page.
-- Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

-- 1) Extend get_school_branding → add principal + slug + custom_domain ----------
CREATE OR REPLACE FUNCTION public.get_school_branding()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v jsonb;
BEGIN
  v_school := public.current_school_id();
  IF v_school IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'id', s.id,
    'name', COALESCE(NULLIF(btrim(s.school_name_th), ''), s.name),
    'name_en', s.name,
    'logo_url', s.logo_url,
    'theme_color', s.theme_color,
    'slug', s.slug,
    'custom_domain', s.custom_domain,
    'principal', COALESCE(NULLIF(btrim(s.principal_name_th), ''), s.principal_name)
  ) INTO v FROM public.schools s WHERE s.id = v_school;
  RETURN v;
END$$;
GRANT EXECUTE ON FUNCTION public.get_school_branding TO authenticated;

-- 2) certificates: add school_id, backfill existing rows to SKKS ---------------
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

-- backfill any existing (SKKS-only) certs to the SKKS school
UPDATE public.certificates c
SET school_id = (SELECT id FROM public.schools WHERE slug = 'skks' LIMIT 1)
WHERE c.school_id IS NULL;

CREATE INDEX IF NOT EXISTS cert_school_idx ON public.certificates (school_id);

-- 3) RLS: replace public-read leak with tenant-scoped staff management ----------
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public verify certificate" ON public.certificates;
DROP POLICY IF EXISTS "Staff manage certificates" ON public.certificates;
DROP POLICY IF EXISTS cert_public_read ON public.certificates;
DROP POLICY IF EXISTS cert_staff_manage ON public.certificates;
DROP POLICY IF EXISTS cert_student_read ON public.certificates;

-- staff/owner of the SAME school manage their certs
CREATE POLICY cert_staff_manage ON public.certificates FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- a student/parent can read their own issued certs
CREATE POLICY cert_student_read ON public.certificates FOR SELECT TO authenticated
  USING (school_id = public.current_school_id()
         AND student_id = ANY (public.my_student_ids()));

-- 4) Public verification RPC (anon) — minimal safe fields by code --------------
CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF COALESCE(btrim(p_code),'') = '' THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT jsonb_build_object(
    'found', true,
    'certificate_number', c.certificate_number,
    'student_name', btrim(COALESCE(st.first_name,'') || ' ' || COALESCE(st.last_name,'')),
    'type', c.certificate_type,
    'title', c.title,
    'status', c.status,
    'school_name', COALESCE(sc.school_name_th, sc.school_name, sc.name),
    'issued_at', COALESCE(c.issued_date::timestamptz, c.created_at)
  ) INTO v
  FROM public.certificates c
  LEFT JOIN public.students st ON st.id = c.student_id
  LEFT JOIN public.schools  sc ON sc.id = c.school_id
  WHERE c.qr_verification_code = p_code AND c.status = 'issued'
  LIMIT 1;
  RETURN COALESCE(v, jsonb_build_object('found', false));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('found', false);
END$$;
GRANT EXECUTE ON FUNCTION public.verify_certificate TO anon, authenticated;

-- Verify:
-- SELECT public.get_school_branding();
-- SELECT public.verify_certificate('CERT-xxxx');
