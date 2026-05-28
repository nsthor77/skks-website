-- ============================================================================
-- Sprint 23: Health / Infirmary records (ห้องพยาบาล/สุขภาพ)
-- ============================================================================
-- Per-student health profile (blood type, allergies, chronic conditions,
-- emergency contact) + infirmary visit log. Staff/nurse manage; student/parent
-- view their own. Sensitive data — RLS restricted to school + own.
-- Created: 2026-05-28
-- ============================================================================

-- 1. Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.health_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  blood_type text,                           -- A / B / AB / O (+/-)
  allergies text,
  chronic_conditions text,
  medications text,
  emergency_contact_name text,
  emergency_contact_phone text,
  height_cm numeric,
  weight_kg numeric,
  note text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  visit_date date DEFAULT current_date,
  symptoms text,
  treatment text,
  medicine text,
  sent_home boolean DEFAULT false,
  note text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensive
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS blood_type text;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS allergies text;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS chronic_conditions text;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS medications text;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS height_cm numeric;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS weight_kg numeric;
ALTER TABLE public.health_profiles ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.health_visits ADD COLUMN IF NOT EXISTS sent_home boolean DEFAULT false;
ALTER TABLE public.health_visits ADD COLUMN IF NOT EXISTS medicine text;

CREATE UNIQUE INDEX IF NOT EXISTS hp_student_uidx ON public.health_profiles (student_id);
CREATE INDEX IF NOT EXISTS hv_school_student_idx ON public.health_visits (school_id, student_id, visit_date);

COMMENT ON TABLE public.health_profiles IS 'Sprint 23: per-student health profile (1 row/student)';
COMMENT ON TABLE public.health_visits IS 'Sprint 23: infirmary visit log';

-- 2. updated_at triggers
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hp_set_updated_at') THEN
    CREATE TRIGGER hp_set_updated_at BEFORE UPDATE ON public.health_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hv_set_updated_at') THEN
    CREATE TRIGGER hv_set_updated_at BEFORE UPDATE ON public.health_visits
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 3. RLS (staff all; student/parent own)
-- ============================================================================
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hp_select_staff ON public.health_profiles;
CREATE POLICY hp_select_staff ON public.health_profiles
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS hp_select_own ON public.health_profiles;
CREATE POLICY hp_select_own ON public.health_profiles
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id()
    AND (student_id = ANY(public.my_student_ids())
         OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = health_profiles.student_id AND s.profile_id = auth.uid())));

DROP POLICY IF EXISTS hp_modify_staff ON public.health_profiles;
CREATE POLICY hp_modify_staff ON public.health_profiles
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS hv_select_staff ON public.health_visits;
CREATE POLICY hv_select_staff ON public.health_visits
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS hv_select_own ON public.health_visits;
CREATE POLICY hv_select_own ON public.health_visits
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id()
    AND (student_id = ANY(public.my_student_ids())
         OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = health_visits.student_id AND s.profile_id = auth.uid())));

DROP POLICY IF EXISTS hv_modify_staff ON public.health_visits;
CREATE POLICY hv_modify_staff ON public.health_visits
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- 4. RPC: save_health_profile (staff) — upsert per student
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_health_profile(
  p_student_id uuid,
  p_blood_type text DEFAULT NULL,
  p_allergies text DEFAULT NULL,
  p_chronic_conditions text DEFAULT NULL,
  p_medications text DEFAULT NULL,
  p_emergency_contact_name text DEFAULT NULL,
  p_emergency_contact_phone text DEFAULT NULL,
  p_height_cm numeric DEFAULT NULL,
  p_weight_kg numeric DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success', false, 'error', 'forbidden'); END IF;
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_school'); END IF;
  IF p_student_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_student'); END IF;

  INSERT INTO public.health_profiles (school_id, student_id, updated_by, blood_type, allergies, chronic_conditions,
    medications, emergency_contact_name, emergency_contact_phone, height_cm, weight_kg, note)
  VALUES (v_school_id, p_student_id, auth.uid(), p_blood_type, p_allergies, p_chronic_conditions,
    p_medications, p_emergency_contact_name, p_emergency_contact_phone, p_height_cm, p_weight_kg, p_note)
  ON CONFLICT (student_id) DO UPDATE SET
    blood_type = EXCLUDED.blood_type, allergies = EXCLUDED.allergies,
    chronic_conditions = EXCLUDED.chronic_conditions, medications = EXCLUDED.medications,
    emergency_contact_name = EXCLUDED.emergency_contact_name, emergency_contact_phone = EXCLUDED.emergency_contact_phone,
    height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg, note = EXCLUDED.note,
    updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_health_profile TO authenticated;

-- 5. RPC: get_health_profile (role-aware)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_health_profile(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid; v_uid uuid; v_can boolean; v_row jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('error','no_school'); END IF;
  v_uid := auth.uid();
  v_can := public.is_staff_or_higher()
    OR p_student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.profile_id = v_uid);
  IF NOT v_can THEN RETURN jsonb_build_object('error','no_access'); END IF;

  SELECT to_jsonb(hp) INTO v_row FROM public.health_profiles hp
   WHERE hp.student_id = p_student_id AND hp.school_id = v_school_id;

  RETURN jsonb_build_object('success', true, 'profile', v_row);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_health_profile TO authenticated;

-- 6. RPC: record_visit (staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_visit(
  p_student_id uuid,
  p_symptoms text DEFAULT NULL,
  p_treatment text DEFAULT NULL,
  p_medicine text DEFAULT NULL,
  p_sent_home boolean DEFAULT false,
  p_visit_date date DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success', false, 'error', 'forbidden'); END IF;
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_school'); END IF;
  IF p_student_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_student'); END IF;

  INSERT INTO public.health_visits (school_id, student_id, recorded_by, visit_date, symptoms, treatment, medicine, sent_home, note)
  VALUES (v_school_id, p_student_id, auth.uid(), COALESCE(p_visit_date, current_date),
          p_symptoms, p_treatment, p_medicine, COALESCE(p_sent_home,false), p_note)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_visit TO authenticated;

-- 7. RPC: delete_visit (staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_visit(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success', false, 'error', 'forbidden'); END IF;
  v_school_id := public.current_school_id();
  DELETE FROM public.health_visits WHERE id = p_id AND school_id = v_school_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_visit TO authenticated;

-- 8. RPC: get_visits (role-aware)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_visits(p_student_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_uid uuid; v_staff boolean; v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_uid := auth.uid();
  v_staff := public.is_staff_or_higher();

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.visit_date DESC, t.created_at DESC) INTO v_rows
  FROM (
    SELECT hv.*,
           s.student_number, s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en, s.classroom,
           COALESCE(pr.display_name,'') AS recorded_by_name
    FROM public.health_visits hv
    JOIN public.students s ON s.id = hv.student_id
    LEFT JOIN public.profiles pr ON pr.id = hv.recorded_by
    WHERE hv.school_id = v_school_id
      AND (p_student_id IS NULL OR hv.student_id = p_student_id)
      AND (
        v_staff
        OR hv.student_id = ANY(public.my_student_ids())
        OR EXISTS (SELECT 1 FROM public.students s2 WHERE s2.id = hv.student_id AND s2.profile_id = v_uid)
      )
  ) t;
  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_visits TO authenticated;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.save_health_profile('<student>','O+','แพ้กุ้ง','หอบหืด',NULL,'แม่','081...',150,42,NULL);
-- SELECT public.get_health_profile('<student>');
-- SELECT public.record_visit('<student>','ปวดหัว','พักผ่อน','พารา',false,NULL,NULL);
-- SELECT public.get_visits('<student>');
