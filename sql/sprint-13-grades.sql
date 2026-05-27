-- ============================================================================
-- Sprint 13: Grades + Report Cards
-- ============================================================================
-- Per-school grading scale config + student_grades table + report_cards
-- Defensive: works with legacy SKKS schema
-- Created: 2026-05-27
-- ============================================================================

-- 1. grading_scales table (per school config)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.grading_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

  name text NOT NULL,                  -- 'Standard A-F', 'Thai 4.0 GPA', 'Pass/Fail'
  scale_type text NOT NULL CHECK (scale_type IN ('letter','gpa','percent','pass_fail','custom')),

  -- Grade definitions stored as jsonb array
  -- Example for letter: [
  --   {"label":"A",  "value":4.0, "min":80, "max":100, "color":"#065F46"},
  --   {"label":"B+", "value":3.5, "min":75, "max":79,  "color":"#10B981"},
  --   ...
  -- ]
  grades jsonb NOT NULL DEFAULT '[]'::jsonb,

  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 100,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS gs_school_idx ON public.grading_scales (school_id, is_active);

COMMENT ON TABLE public.grading_scales IS 'Sprint 13: Per-school grading scale definitions';


-- 2. student_grades table (defensive — may already exist in legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensive ADD COLUMN
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS subject_code text;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS subject_name text;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS term text;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS grade_level text;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS classroom text;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS grading_scale_id uuid REFERENCES public.grading_scales(id) ON DELETE SET NULL;

-- Score components
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS score_midterm numeric(6,2);
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS score_final numeric(6,2);
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS score_assignment numeric(6,2);
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS score_total numeric(6,2);    -- คะแนนรวม 0-100
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS credit_hours numeric(4,1);

-- Final grade
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS grade_label text;             -- 'A', 'B+', 'P', etc.
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS grade_value numeric(4,2);     -- 4.00, 3.50, etc.
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS pass_status text CHECK (pass_status IS NULL OR pass_status IN ('pass','fail','incomplete','withdrawn'));

-- Notes
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS comments text;                -- comment ของครู
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;

-- Metadata
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS published boolean DEFAULT false;  -- ผู้ปกครองเห็นได้เมื่อ published
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Unique: one record per student+subject+term+year
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.student_grades
      ADD CONSTRAINT student_grades_unique_key UNIQUE (student_id, subject_code, academic_year, term);
  EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
  END;
END$$;

CREATE INDEX IF NOT EXISTS sg_school_year_term_idx ON public.student_grades (school_id, academic_year, term);
CREATE INDEX IF NOT EXISTS sg_student_idx ON public.student_grades (student_id, academic_year, term);
CREATE INDEX IF NOT EXISTS sg_class_subject_idx ON public.student_grades (school_id, classroom, subject_code, academic_year, term);
CREATE INDEX IF NOT EXISTS sg_published_idx ON public.student_grades (school_id, published);

COMMENT ON TABLE public.student_grades IS 'Sprint 13: Student grades per subject + term';


-- 3. report_cards table (defensive)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS report_number text;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS term text;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS grade_level text;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS classroom text;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS gpa numeric(4,2);                -- GPA ของเทอม
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS cumulative_gpa numeric(4,2);     -- GPA สะสม
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS total_credits numeric(6,1);
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS rank_in_class int;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS total_in_class int;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS attendance_days int;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS attendance_present int;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS attendance_absent int;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS attendance_late int;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS teacher_comments text;           -- ความเห็นครูประจำชั้น
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS principal_comments text;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS published boolean DEFAULT false;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS pdf_url text;                    -- ที่เก็บ PDF
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.report_cards ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Unique per student per year per term
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.report_cards
      ADD CONSTRAINT report_cards_unique_key UNIQUE (student_id, academic_year, term);
  EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
  END;
END$$;

CREATE INDEX IF NOT EXISTS rc_school_year_term_idx ON public.report_cards (school_id, academic_year, term);
CREATE INDEX IF NOT EXISTS rc_student_idx ON public.report_cards (student_id, academic_year, term);

COMMENT ON TABLE public.report_cards IS 'Sprint 13: Per-term report cards';


-- 4. Triggers for updated_at
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'gs_set_updated_at') THEN
    CREATE TRIGGER gs_set_updated_at BEFORE UPDATE ON public.grading_scales
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sg_set_updated_at') THEN
    CREATE TRIGGER sg_set_updated_at BEFORE UPDATE ON public.student_grades
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rc_set_updated_at') THEN
    CREATE TRIGGER rc_set_updated_at BEFORE UPDATE ON public.report_cards
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;


-- 5. RLS
-- ============================================================================
ALTER TABLE public.grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

-- grading_scales: read by all staff/students, modify by owner only
DROP POLICY IF EXISTS gs_select_same_school ON public.grading_scales;
CREATE POLICY gs_select_same_school ON public.grading_scales
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());

DROP POLICY IF EXISTS gs_modify_owner ON public.grading_scales;
CREATE POLICY gs_modify_owner ON public.grading_scales
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_owner_or_developer())
  WITH CHECK (school_id = public.current_school_id() AND public.is_owner_or_developer());

-- student_grades: staff read all, students/parents read own only when published
DROP POLICY IF EXISTS sg_select_staff ON public.student_grades;
CREATE POLICY sg_select_staff ON public.student_grades
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS sg_select_own ON public.student_grades;
CREATE POLICY sg_select_own ON public.student_grades
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND published = true
    AND (
      student_id = ANY(public.my_student_ids())
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_grades.student_id AND s.profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS sg_modify_staff ON public.student_grades;
CREATE POLICY sg_modify_staff ON public.student_grades
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- report_cards: same pattern
DROP POLICY IF EXISTS rc_select_staff ON public.report_cards;
CREATE POLICY rc_select_staff ON public.report_cards
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS rc_select_own ON public.report_cards;
CREATE POLICY rc_select_own ON public.report_cards
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id() AND published = true
    AND (
      student_id = ANY(public.my_student_ids())
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = report_cards.student_id AND s.profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS rc_modify_staff ON public.report_cards;
CREATE POLICY rc_modify_staff ON public.report_cards
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());


-- 6. RPC: get_grades_for_class — list students with their grades for a subject+term
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_grades_for_class(
  p_classroom text,
  p_subject_code text,
  p_academic_year text,
  p_term text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_rows jsonb;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_school_id := public.current_school_id();

  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      s.id AS student_id,
      s.student_number,
      s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en, s.nickname,
      s.grade, s.classroom,
      g.id AS grade_id,
      g.score_midterm, g.score_final, g.score_assignment, g.score_total,
      g.grade_label, g.grade_value, g.pass_status,
      g.comments, g.published
    FROM public.students s
    LEFT JOIN public.student_grades g
      ON g.student_id = s.id
        AND g.subject_code = p_subject_code
        AND g.academic_year = p_academic_year
        AND g.term = p_term
    WHERE s.school_id = v_school_id
      AND s.status = 'active'
      AND s.classroom = p_classroom
    ORDER BY s.student_number NULLS LAST
  ) t;

  RETURN jsonb_build_object(
    'classroom', p_classroom,
    'subject_code', p_subject_code,
    'academic_year', p_academic_year,
    'term', p_term,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_grades_for_class TO authenticated;


-- 7. RPC: upsert_grade — single
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_grade(
  p_student_id uuid,
  p_subject_code text,
  p_subject_name text,
  p_academic_year text,
  p_term text,
  p_score_midterm numeric DEFAULT NULL,
  p_score_final numeric DEFAULT NULL,
  p_score_assignment numeric DEFAULT NULL,
  p_score_total numeric DEFAULT NULL,
  p_grade_label text DEFAULT NULL,
  p_grade_value numeric DEFAULT NULL,
  p_pass_status text DEFAULT NULL,
  p_comments text DEFAULT NULL,
  p_credit_hours numeric DEFAULT NULL,
  p_published boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_student RECORD;
  v_grade_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_school_id := public.current_school_id();

  SELECT id, grade, classroom INTO v_student
  FROM public.students
  WHERE id = p_student_id AND school_id = v_school_id;

  IF v_student.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'student_not_found');
  END IF;

  INSERT INTO public.student_grades (
    school_id, student_id, subject_code, subject_name,
    academic_year, term, grade_level, classroom,
    score_midterm, score_final, score_assignment, score_total,
    grade_label, grade_value, pass_status, comments,
    credit_hours, published, published_at, recorded_by
  ) VALUES (
    v_school_id, p_student_id, p_subject_code, p_subject_name,
    p_academic_year, p_term, v_student.grade, v_student.classroom,
    p_score_midterm, p_score_final, p_score_assignment, p_score_total,
    p_grade_label, p_grade_value, p_pass_status, p_comments,
    p_credit_hours, p_published,
    CASE WHEN p_published THEN now() ELSE NULL END,
    v_user_id
  )
  ON CONFLICT (student_id, subject_code, academic_year, term) DO UPDATE SET
    subject_name      = COALESCE(EXCLUDED.subject_name, student_grades.subject_name),
    score_midterm     = COALESCE(EXCLUDED.score_midterm, student_grades.score_midterm),
    score_final       = COALESCE(EXCLUDED.score_final, student_grades.score_final),
    score_assignment  = COALESCE(EXCLUDED.score_assignment, student_grades.score_assignment),
    score_total       = COALESCE(EXCLUDED.score_total, student_grades.score_total),
    grade_label       = COALESCE(EXCLUDED.grade_label, student_grades.grade_label),
    grade_value       = COALESCE(EXCLUDED.grade_value, student_grades.grade_value),
    pass_status       = COALESCE(EXCLUDED.pass_status, student_grades.pass_status),
    comments          = COALESCE(EXCLUDED.comments, student_grades.comments),
    credit_hours      = COALESCE(EXCLUDED.credit_hours, student_grades.credit_hours),
    published         = EXCLUDED.published,
    published_at      = CASE WHEN EXCLUDED.published AND NOT student_grades.published THEN now() ELSE student_grades.published_at END,
    recorded_by       = v_user_id,
    updated_at        = now()
  RETURNING id INTO v_grade_id;

  RETURN jsonb_build_object('success', true, 'id', v_grade_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_grade TO authenticated;


-- 8. RPC: bulk_upsert_grades — for batch class grading
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bulk_upsert_grades(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_result jsonb;
  v_count int := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_result := public.upsert_grade(
      (v_row->>'student_id')::uuid,
      v_row->>'subject_code',
      v_row->>'subject_name',
      v_row->>'academic_year',
      v_row->>'term',
      (v_row->>'score_midterm')::numeric,
      (v_row->>'score_final')::numeric,
      (v_row->>'score_assignment')::numeric,
      (v_row->>'score_total')::numeric,
      v_row->>'grade_label',
      (v_row->>'grade_value')::numeric,
      v_row->>'pass_status',
      v_row->>'comments',
      (v_row->>'credit_hours')::numeric,
      COALESCE((v_row->>'published')::boolean, false)
    );
    IF v_result->>'success' = 'true' THEN
      v_count := v_count + 1;
    ELSE
      v_errors := v_errors || jsonb_build_object('student_id', v_row->>'student_id', 'error', v_result->>'error');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'saved', v_count, 'errors', v_errors);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_upsert_grades TO authenticated;


-- 9. RPC: get_my_grades — student/parent view
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_grades(
  p_student_id uuid DEFAULT NULL,
  p_academic_year text DEFAULT NULL,
  p_term text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_target_student uuid;
  v_rows jsonb;
  v_gpa numeric;
  v_credits numeric;
BEGIN
  v_user_id := auth.uid();
  v_school_id := public.current_school_id();

  IF p_student_id IS NULL THEN
    SELECT id INTO v_target_student FROM public.students
    WHERE profile_id = v_user_id AND school_id = v_school_id LIMIT 1;
  ELSE
    IF p_student_id = ANY(public.my_student_ids()) OR public.is_staff_or_higher() THEN
      v_target_student := p_student_id;
    ELSE
      SELECT id INTO v_target_student FROM public.students
      WHERE id = p_student_id AND profile_id = v_user_id;
    END IF;
  END IF;

  IF v_target_student IS NULL THEN
    RETURN jsonb_build_object('error', 'no_access_or_not_found');
  END IF;

  -- Fetch grades (only published for non-staff)
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.subject_code) INTO v_rows
  FROM (
    SELECT g.*
    FROM public.student_grades g
    WHERE g.student_id = v_target_student
      AND (p_academic_year IS NULL OR g.academic_year = p_academic_year)
      AND (p_term IS NULL OR g.term = p_term)
      AND (public.is_staff_or_higher() OR g.published = true)
    ORDER BY g.academic_year DESC, g.term DESC, g.subject_code
  ) t;

  -- Calculate GPA
  SELECT
    ROUND(SUM(g.grade_value * COALESCE(g.credit_hours, 1)) / NULLIF(SUM(COALESCE(g.credit_hours, 1)), 0), 2),
    SUM(COALESCE(g.credit_hours, 1))
  INTO v_gpa, v_credits
  FROM public.student_grades g
  WHERE g.student_id = v_target_student
    AND (p_academic_year IS NULL OR g.academic_year = p_academic_year)
    AND (p_term IS NULL OR g.term = p_term)
    AND (public.is_staff_or_higher() OR g.published = true)
    AND g.grade_value IS NOT NULL;

  RETURN jsonb_build_object(
    'student_id', v_target_student,
    'academic_year', p_academic_year,
    'term', p_term,
    'gpa', v_gpa,
    'total_credits', v_credits,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_grades TO authenticated;


-- 10. RPC: get_grading_scales
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_grading_scales()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.sort_order, t.name) INTO v_rows
  FROM (
    SELECT * FROM public.grading_scales
    WHERE school_id = v_school_id AND is_active = true
    ORDER BY sort_order, name
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_grading_scales TO authenticated;


-- 11. RPC: upsert_grading_scale
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_grading_scale(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_scale_type text DEFAULT 'letter',
  p_grades jsonb DEFAULT '[]'::jsonb,
  p_is_default boolean DEFAULT false,
  p_is_active boolean DEFAULT true,
  p_sort_order int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.is_owner_or_developer() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();

  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;

  -- If setting default, unset others
  IF p_is_default THEN
    UPDATE public.grading_scales SET is_default = false
    WHERE school_id = v_school_id AND (p_id IS NULL OR id != p_id);
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.grading_scales (school_id, name, scale_type, grades, is_default, is_active, sort_order, created_by)
    VALUES (v_school_id, p_name, p_scale_type, p_grades, p_is_default, p_is_active, p_sort_order, v_user_id)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.grading_scales SET
      name = p_name, scale_type = p_scale_type, grades = p_grades,
      is_default = p_is_default, is_active = p_is_active, sort_order = p_sort_order
    WHERE id = p_id AND school_id = v_school_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_grading_scale TO authenticated;


-- 12. RPC: publish_grades — bulk publish (so students/parents can see)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.publish_grades(
  p_classroom text DEFAULT NULL,
  p_subject_code text DEFAULT NULL,
  p_academic_year text DEFAULT NULL,
  p_term text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_count int;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_school_id := public.current_school_id();

  UPDATE public.student_grades SET
    published = true,
    published_at = now()
  WHERE school_id = v_school_id
    AND (p_classroom IS NULL OR classroom = p_classroom)
    AND (p_subject_code IS NULL OR subject_code = p_subject_code)
    AND (p_academic_year IS NULL OR academic_year = p_academic_year)
    AND (p_term IS NULL OR term = p_term);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'published', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_grades TO authenticated;


-- 13. Seed default grading scales (only if school has none)
-- ============================================================================
-- Run this AFTER login as owner of school. Or via the UI.
-- Sample for Standard A-F:
-- INSERT INTO public.grading_scales (school_id, name, scale_type, grades, is_default, sort_order)
-- VALUES (
--   '<your-school-id>',
--   'Standard A-F (Thai 4.0 GPA)',
--   'letter',
--   '[
--     {"label":"A",  "value":4.0, "min":80, "max":100, "color":"#065F46"},
--     {"label":"B+", "value":3.5, "min":75, "max":79,  "color":"#10B981"},
--     {"label":"B",  "value":3.0, "min":70, "max":74,  "color":"#34D399"},
--     {"label":"C+", "value":2.5, "min":65, "max":69,  "color":"#FBBF24"},
--     {"label":"C",  "value":2.0, "min":60, "max":64,  "color":"#F59E0B"},
--     {"label":"D+", "value":1.5, "min":55, "max":59,  "color":"#F97316"},
--     {"label":"D",  "value":1.0, "min":50, "max":54,  "color":"#EF4444"},
--     {"label":"F",  "value":0.0, "min":0,  "max":49,  "color":"#991B1B"}
--   ]'::jsonb,
--   true,
--   10
-- );


-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.get_grading_scales();
-- SELECT public.get_grades_for_class('EP/3A', 'MATH', '2569', '1');
