-- ============================================================================
-- Admissions: multi-tenant isolation + safe public submit RPC
-- ============================================================================
-- Fixes: applications had NO school_id (new-tenant apps were tenant-less / could
-- leak across schools) and the public form inserted directly as anon (no validation,
-- spam risk). Now: school_id column + tenant-scoped RLS + a SECURITY DEFINER
-- submit_application() RPC the public form calls (per-school app number, server-set
-- school_id). Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

-- 1) add school_id, backfill existing (SKKS) rows --------------------------------
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

UPDATE public.applications a
SET school_id = (SELECT id FROM public.schools WHERE slug = 'skks' LIMIT 1)
WHERE a.school_id IS NULL;

CREATE INDEX IF NOT EXISTS app_school_idx ON public.applications (school_id);

-- 2) RLS: only staff of the SAME school can read/manage applications -------------
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert applications" ON public.applications;
DROP POLICY IF EXISTS "Anyone can apply" ON public.applications;
DROP POLICY IF EXISTS "Staff manage applications" ON public.applications;
DROP POLICY IF EXISTS app_public_insert ON public.applications;
DROP POLICY IF EXISTS app_staff_manage ON public.applications;

CREATE POLICY app_staff_manage ON public.applications FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());
-- (no anon/public policy: the public form inserts via the SECURITY DEFINER RPC below)

-- 3) Public submit RPC (anon) — server sets school_id + per-school app number -----
CREATE OR REPLACE FUNCTION public.submit_application(p_school_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq int; v_num text; v_fn text; v_phone text; v_email text;
BEGIN
  IF p_school_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_school');
  END IF;

  v_fn    := btrim(COALESCE(p_payload->>'student_first_name',''));
  v_phone := btrim(COALESCE(p_payload->>'parent_phone',''));
  v_email := btrim(COALESCE(p_payload->>'parent_email',''));
  IF v_fn = '' OR (v_phone = '' AND v_email = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_fields');
  END IF;

  -- per-school application number
  SELECT count(*) + 1 INTO v_seq FROM public.applications WHERE school_id = p_school_id;
  v_num := 'APP-' || to_char(now(),'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.applications (
    school_id, application_number, status,
    student_first_name, student_last_name, student_nickname,
    student_birth_date, student_gender, student_nationality,
    program, grade,
    parent_name, parent_relation, parent_phone, parent_email, parent_address, notes
  ) VALUES (
    p_school_id, v_num, 'pending',
    v_fn,
    btrim(COALESCE(p_payload->>'student_last_name','')),
    NULLIF(btrim(COALESCE(p_payload->>'student_nickname','')), ''),
    NULLIF(p_payload->>'student_birth_date','')::date,
    NULLIF(btrim(COALESCE(p_payload->>'student_gender','')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'student_nationality','')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'program','')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'grade','')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'parent_name','')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'parent_relation','')), ''),
    NULLIF(v_phone, ''),
    NULLIF(v_email, ''),
    NULLIF(btrim(COALESCE(p_payload->>'parent_address','')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'notes','')), '')
  );

  RETURN jsonb_build_object('success', true, 'application_number', v_num);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END$$;
GRANT EXECUTE ON FUNCTION public.submit_application TO anon, authenticated;

-- Verify:
-- SELECT public.submit_application(
--   (SELECT id FROM public.schools WHERE slug='skks'),
--   '{"student_first_name":"Test","parent_phone":"0812345678","program":"ep","grade":"P1"}'::jsonb);
