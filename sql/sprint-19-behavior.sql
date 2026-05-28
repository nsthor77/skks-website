-- ============================================================================
-- Sprint 19: Behavior / Conduct points (คะแนนพฤติกรรม)
-- ============================================================================
-- Staff/teacher record +/- conduct points for a student (e.g. -5 late, +5 helping).
-- Each student starts at a base score (default 100). Current = base + sum(delta).
-- Students/parents can view their own records & score.
-- Created: 2026-05-28
-- ============================================================================

-- 1. Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.behavior_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  delta numeric NOT NULL DEFAULT 0,          -- signed: negative = deduct, positive = add
  category text,                             -- e.g. late / uniform / fighting / helping
  reason text,
  note text,
  occurred_date date DEFAULT current_date,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS delta numeric DEFAULT 0;
ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS occurred_date date DEFAULT current_date;
ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.behavior_records ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS br_school_student_idx ON public.behavior_records (school_id, student_id, occurred_date);
CREATE INDEX IF NOT EXISTS br_student_idx ON public.behavior_records (student_id);

COMMENT ON TABLE public.behavior_records IS 'Sprint 19: student conduct points (+/- delta). Current score = base(100) + sum(delta).';

-- 2. updated_at trigger
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'br_set_updated_at') THEN
    CREATE TRIGGER br_set_updated_at BEFORE UPDATE ON public.behavior_records
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 3. RLS
-- ============================================================================
ALTER TABLE public.behavior_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS br_select_staff ON public.behavior_records;
CREATE POLICY br_select_staff ON public.behavior_records
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS br_select_own ON public.behavior_records;
CREATE POLICY br_select_own ON public.behavior_records
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND (
      student_id = ANY(public.my_student_ids())
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = behavior_records.student_id AND s.profile_id = auth.uid())
    )
  );

-- only staff/teacher can write/modify/delete
DROP POLICY IF EXISTS br_modify_staff ON public.behavior_records;
CREATE POLICY br_modify_staff ON public.behavior_records
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- 4. RPC: record_behavior (staff/teacher)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_behavior(
  p_student_id uuid,
  p_delta numeric,
  p_category text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_occurred_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_school'); END IF;
  IF p_student_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_student'); END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'no_points'); END IF;

  INSERT INTO public.behavior_records (school_id, student_id, recorded_by, delta, category, reason, note, occurred_date)
  VALUES (v_school_id, p_student_id, auth.uid(), p_delta,
          NULLIF(btrim(COALESCE(p_category,'')),''), p_reason, p_note,
          COALESCE(p_occurred_date, current_date))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_behavior TO authenticated;

-- 5. RPC: delete_behavior (staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_behavior(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();
  DELETE FROM public.behavior_records WHERE id = p_id AND school_id = v_school_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_behavior TO authenticated;

-- 6. RPC: get_behavior (role-aware) — records for one student + their current score
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_behavior(p_student_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_uid uuid;
  v_staff boolean;
  v_rows jsonb;
  v_base numeric := 100;  -- starting conduct score
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_uid := auth.uid();
  v_staff := public.is_staff_or_higher();

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.occurred_date DESC, t.created_at DESC) INTO v_rows
  FROM (
    SELECT br.*,
           s.student_number, s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en,
           s.nickname, s.classroom, s.grade,
           COALESCE(pr.display_name, '') AS recorded_by_name
    FROM public.behavior_records br
    JOIN public.students s ON s.id = br.student_id
    LEFT JOIN public.profiles pr ON pr.id = br.recorded_by
    WHERE br.school_id = v_school_id
      AND (p_student_id IS NULL OR br.student_id = p_student_id)
      AND (
        v_staff
        OR br.student_id = ANY(public.my_student_ids())
        OR EXISTS (SELECT 1 FROM public.students s2 WHERE s2.id = br.student_id AND s2.profile_id = v_uid)
      )
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_behavior TO authenticated;

-- 7. RPC: get_behavior_scores (staff) — current score per student (for class list)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_behavior_scores(p_classroom text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_rows jsonb;
  v_base numeric := 100;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN '[]'::jsonb; END IF;
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.score ASC, t.classroom, t.student_number) INTO v_rows
  FROM (
    SELECT s.id AS student_id, s.student_number, s.first_name_th, s.last_name_th,
           s.first_name_en, s.last_name_en, s.nickname, s.classroom, s.grade,
           (v_base + COALESCE((SELECT SUM(br.delta) FROM public.behavior_records br WHERE br.student_id = s.id), 0)) AS score,
           (SELECT COUNT(*) FROM public.behavior_records br WHERE br.student_id = s.id) AS record_count
    FROM public.students s
    WHERE s.school_id = v_school_id
      AND COALESCE(s.status,'active') = 'active'
      AND (p_classroom IS NULL OR s.classroom = p_classroom)
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_behavior_scores TO authenticated;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.record_behavior('<student>', -5, 'late', 'มาสาย', NULL, NULL);
-- SELECT public.record_behavior('<student>',  5, 'helping', 'ช่วยงานครู', NULL, NULL);
-- SELECT public.get_behavior('<student>');
-- SELECT public.get_behavior_scores(NULL);
