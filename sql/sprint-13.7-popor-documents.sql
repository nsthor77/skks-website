-- ============================================================================
-- Sprint 13.7: ปพ. Documents (Thai Government Report Cards)
-- ============================================================================
-- Tracks issued ปพ.1 / ปพ.5 / ปพ.6 documents per school with serial numbers
-- Provides RPCs for transcript aggregation + class grade summary
-- Created: 2026-05-27
-- ============================================================================

-- 1. popor_documents table — track issued documents (serial numbers per school)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.popor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,

  -- Document type: 'popor1' | 'popor5' | 'popor6' (extensible: popor2/3/4/7)
  doc_type text NOT NULL CHECK (doc_type IN ('popor1','popor2','popor3','popor4','popor5','popor6','popor7')),

  -- Per-school serial number (auto-assigned sequential within school+type)
  serial_number int NOT NULL,
  serial_text text NOT NULL,   -- formatted: '0001/2569', includes year suffix

  -- Optional scope (some docs span multiple years; some are per-term)
  academic_year text,
  term text,
  grade_level text,
  classroom text,

  -- Snapshot data at time of issue (jsonb for flexibility across types)
  -- Used when student data later changes but PDF reissue should match original
  snapshot jsonb DEFAULT '{}'::jsonb,

  -- Issuance metadata
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  cancel_reason text,

  -- Optional storage
  pdf_url text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pd_school_type_idx ON public.popor_documents (school_id, doc_type, serial_number);
CREATE INDEX IF NOT EXISTS pd_student_idx ON public.popor_documents (student_id, doc_type);
CREATE UNIQUE INDEX IF NOT EXISTS pd_school_type_serial_uq ON public.popor_documents (school_id, doc_type, serial_number);

COMMENT ON TABLE public.popor_documents IS 'Sprint 13.7: Issued ปพ. documents log (audit trail + serial tracking)';


-- 2. Trigger: updated_at
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pd_set_updated_at') THEN
    CREATE TRIGGER pd_set_updated_at BEFORE UPDATE ON public.popor_documents
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;


-- 3. RLS
-- ============================================================================
ALTER TABLE public.popor_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pd_select_staff ON public.popor_documents;
CREATE POLICY pd_select_staff ON public.popor_documents
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- Students/parents can see only their own issued docs
DROP POLICY IF EXISTS pd_select_own ON public.popor_documents;
CREATE POLICY pd_select_own ON public.popor_documents
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND cancelled_at IS NULL
    AND (
      student_id = ANY(public.my_student_ids())
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = popor_documents.student_id AND s.profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS pd_modify_staff ON public.popor_documents;
CREATE POLICY pd_modify_staff ON public.popor_documents
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());


-- 4. RPC: issue_popor_document — atomically allocate next serial + log issuance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.issue_popor_document(
  p_student_id uuid,
  p_doc_type text,
  p_academic_year text DEFAULT NULL,
  p_term text DEFAULT NULL,
  p_grade_level text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_next_serial int;
  v_year_suffix text;
  v_serial_text text;
  v_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_school_id := public.current_school_id();

  IF p_doc_type NOT IN ('popor1','popor2','popor3','popor4','popor5','popor6','popor7') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_doc_type');
  END IF;

  -- Allocate next serial atomically (serializable in single tx)
  SELECT COALESCE(MAX(serial_number), 0) + 1 INTO v_next_serial
  FROM public.popor_documents
  WHERE school_id = v_school_id AND doc_type = p_doc_type;

  -- Year suffix: Thai Buddhist year of issuance, or p_academic_year if set
  v_year_suffix := COALESCE(p_academic_year, to_char((EXTRACT(YEAR FROM now())::int + 543), 'FM0000'));
  v_serial_text := LPAD(v_next_serial::text, 4, '0') || '/' || v_year_suffix;

  INSERT INTO public.popor_documents (
    school_id, student_id, doc_type, serial_number, serial_text,
    academic_year, term, grade_level, classroom, snapshot,
    issued_by, issued_at
  ) VALUES (
    v_school_id, p_student_id, p_doc_type, v_next_serial, v_serial_text,
    p_academic_year, p_term, p_grade_level, p_classroom, p_snapshot,
    v_user_id, now()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'serial_number', v_next_serial,
    'serial_text', v_serial_text
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_popor_document TO authenticated;


-- 5. RPC: get_student_transcript — for ปพ.1 (all grades across all years)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_student_transcript(
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_student jsonb;
  v_school jsonb;
  v_grades jsonb;
  v_terms jsonb;
  v_cum_gpa numeric;
  v_total_credits numeric;
  v_can_access boolean;
BEGIN
  v_user_id := auth.uid();
  v_school_id := public.current_school_id();

  -- Access control
  v_can_access := public.is_staff_or_higher()
    OR p_student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.profile_id = v_user_id);

  IF NOT v_can_access THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Student snapshot
  SELECT to_jsonb(s.*) INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id AND s.school_id = v_school_id;

  IF v_student IS NULL THEN
    RETURN jsonb_build_object('error', 'student_not_found');
  END IF;

  -- School snapshot
  SELECT to_jsonb(sc.*) INTO v_school
  FROM public.schools sc
  WHERE sc.id = v_school_id;

  -- All grades (published or staff-visible) ordered by year, term, subject
  SELECT jsonb_agg(row_to_json(t)) INTO v_grades
  FROM (
    SELECT g.academic_year, g.term, g.grade_level, g.classroom,
           g.subject_code, g.subject_name,
           g.score_midterm, g.score_final, g.score_assignment, g.score_total,
           g.grade_label, g.grade_value, g.pass_status, g.credit_hours,
           g.comments, g.published
    FROM public.student_grades g
    WHERE g.student_id = p_student_id
      AND (public.is_staff_or_higher() OR g.published = true)
    ORDER BY g.academic_year, g.term, g.subject_code
  ) t;

  -- Per-term summary (GPA + credits per academic_year + term)
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.academic_year, t.term) INTO v_terms
  FROM (
    SELECT
      academic_year, term, grade_level, classroom,
      ROUND(SUM(grade_value * COALESCE(credit_hours, 1)) / NULLIF(SUM(COALESCE(credit_hours, 1)), 0), 2) AS term_gpa,
      SUM(COALESCE(credit_hours, 1)) AS term_credits,
      COUNT(*) AS subject_count
    FROM public.student_grades
    WHERE student_id = p_student_id
      AND grade_value IS NOT NULL
      AND (public.is_staff_or_higher() OR published = true)
    GROUP BY academic_year, term, grade_level, classroom
    ORDER BY academic_year, term
  ) t;

  -- Cumulative
  SELECT
    ROUND(SUM(grade_value * COALESCE(credit_hours, 1)) / NULLIF(SUM(COALESCE(credit_hours, 1)), 0), 2),
    SUM(COALESCE(credit_hours, 1))
  INTO v_cum_gpa, v_total_credits
  FROM public.student_grades
  WHERE student_id = p_student_id
    AND grade_value IS NOT NULL
    AND (public.is_staff_or_higher() OR published = true);

  RETURN jsonb_build_object(
    'student', v_student,
    'school', v_school,
    'grades', COALESCE(v_grades, '[]'::jsonb),
    'terms', COALESCE(v_terms, '[]'::jsonb),
    'cumulative_gpa', v_cum_gpa,
    'total_credits', v_total_credits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_transcript TO authenticated;


-- 6. RPC: get_class_grade_summary — for ปพ.5 (per-class+subject all student grades)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_class_grade_summary(
  p_classroom text,
  p_academic_year text,
  p_term text,
  p_subject_code text DEFAULT NULL    -- NULL = all subjects (pivot view)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_school jsonb;
  v_students jsonb;
  v_subjects jsonb;
  v_grades jsonb;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_school_id := public.current_school_id();

  SELECT to_jsonb(sc.*) INTO v_school FROM public.schools sc WHERE sc.id = v_school_id;

  -- Students in classroom
  SELECT jsonb_agg(row_to_json(t) ORDER BY COALESCE(t.student_number, '~~~'), t.first_name_th) INTO v_students
  FROM (
    SELECT id, student_number, first_name_th, last_name_th, first_name_en, last_name_en,
           nickname, grade, classroom
    FROM public.students
    WHERE school_id = v_school_id
      AND classroom = p_classroom
      AND status = 'active'
    ORDER BY COALESCE(student_number, '~~~'), first_name_th
  ) t;

  -- Subjects taught in this class+term (distinct from grade records)
  SELECT jsonb_agg(DISTINCT row_to_json(t)::jsonb ORDER BY (row_to_json(t)::jsonb)) INTO v_subjects
  FROM (
    SELECT DISTINCT subject_code, subject_name, credit_hours
    FROM public.student_grades
    WHERE school_id = v_school_id
      AND classroom = p_classroom
      AND academic_year = p_academic_year
      AND term = p_term
      AND (p_subject_code IS NULL OR subject_code = p_subject_code)
  ) t;

  -- All grades for class+term (+ optional subject filter)
  SELECT jsonb_agg(row_to_json(g)) INTO v_grades
  FROM (
    SELECT g.student_id, g.subject_code, g.subject_name,
           g.score_midterm, g.score_final, g.score_assignment, g.score_total,
           g.grade_label, g.grade_value, g.pass_status, g.credit_hours, g.comments
    FROM public.student_grades g
    WHERE g.school_id = v_school_id
      AND g.classroom = p_classroom
      AND g.academic_year = p_academic_year
      AND g.term = p_term
      AND (p_subject_code IS NULL OR g.subject_code = p_subject_code)
  ) g;

  RETURN jsonb_build_object(
    'school', v_school,
    'classroom', p_classroom,
    'academic_year', p_academic_year,
    'term', p_term,
    'subject_code', p_subject_code,
    'students', COALESCE(v_students, '[]'::jsonb),
    'subjects', COALESCE(v_subjects, '[]'::jsonb),
    'grades', COALESCE(v_grades, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_grade_summary TO authenticated;


-- 7. RPC: get_student_progress_report — for ปพ.6 (single-student comprehensive)
-- ============================================================================
-- Aggregates: term grades + attendance stats + desired characteristics from custom_data
CREATE OR REPLACE FUNCTION public.get_student_progress_report(
  p_student_id uuid,
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
  v_user_id uuid;
  v_can_access boolean;
  v_student jsonb;
  v_school jsonb;
  v_grades jsonb;
  v_attendance jsonb;
  v_gpa numeric;
  v_credits numeric;
  v_present int;
  v_absent int;
  v_late int;
  v_excused int;
  v_total_days int;
BEGIN
  v_user_id := auth.uid();
  v_school_id := public.current_school_id();

  v_can_access := public.is_staff_or_higher()
    OR p_student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.profile_id = v_user_id);

  IF NOT v_can_access THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT to_jsonb(s.*) INTO v_student
  FROM public.students s
  WHERE s.id = p_student_id AND s.school_id = v_school_id;

  IF v_student IS NULL THEN
    RETURN jsonb_build_object('error', 'student_not_found');
  END IF;

  SELECT to_jsonb(sc.*) INTO v_school FROM public.schools sc WHERE sc.id = v_school_id;

  -- Grades for this term
  SELECT jsonb_agg(row_to_json(g) ORDER BY g.subject_code) INTO v_grades
  FROM (
    SELECT subject_code, subject_name,
           score_midterm, score_final, score_assignment, score_total,
           grade_label, grade_value, pass_status, credit_hours, comments
    FROM public.student_grades
    WHERE student_id = p_student_id
      AND academic_year = p_academic_year
      AND term = p_term
      AND (public.is_staff_or_higher() OR published = true)
    ORDER BY subject_code
  ) g;

  -- Term GPA
  SELECT
    ROUND(SUM(grade_value * COALESCE(credit_hours, 1)) / NULLIF(SUM(COALESCE(credit_hours, 1)), 0), 2),
    SUM(COALESCE(credit_hours, 1))
  INTO v_gpa, v_credits
  FROM public.student_grades
  WHERE student_id = p_student_id
    AND academic_year = p_academic_year
    AND term = p_term
    AND grade_value IS NOT NULL
    AND (public.is_staff_or_higher() OR published = true);

  -- Attendance stats for term (best-effort; attendance.term column may not exist)
  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE status = 'present'),
      COUNT(*) FILTER (WHERE status = 'absent'),
      COUNT(*) FILTER (WHERE status = 'late'),
      COUNT(*) FILTER (WHERE status IN ('excused','leave','sick')),
      COUNT(*)
    INTO v_present, v_absent, v_late, v_excused, v_total_days
    FROM public.attendance
    WHERE student_id = p_student_id
      AND school_id = v_school_id;
  EXCEPTION WHEN OTHERS THEN
    v_present := 0; v_absent := 0; v_late := 0; v_excused := 0; v_total_days := 0;
  END;

  v_attendance := jsonb_build_object(
    'present', COALESCE(v_present, 0),
    'absent', COALESCE(v_absent, 0),
    'late', COALESCE(v_late, 0),
    'excused', COALESCE(v_excused, 0),
    'total_days', COALESCE(v_total_days, 0)
  );

  RETURN jsonb_build_object(
    'student', v_student,
    'school', v_school,
    'academic_year', p_academic_year,
    'term', p_term,
    'grades', COALESCE(v_grades, '[]'::jsonb),
    'gpa', v_gpa,
    'total_credits', v_credits,
    'attendance', v_attendance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_progress_report TO authenticated;


-- 8. RPC: get_popor_history — list issued documents for a student (audit trail)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_popor_history(
  p_student_id uuid DEFAULT NULL,
  p_doc_type text DEFAULT NULL
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
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.issued_at DESC) INTO v_rows
  FROM (
    SELECT pd.*,
           p.email AS issued_by_email,
           p.display_name AS issued_by_name
    FROM public.popor_documents pd
    LEFT JOIN public.profiles p ON p.id = pd.issued_by
    WHERE pd.school_id = v_school_id
      AND (p_student_id IS NULL OR pd.student_id = p_student_id)
      AND (p_doc_type IS NULL OR pd.doc_type = p_doc_type)
      AND (
        public.is_staff_or_higher()
        OR pd.student_id = ANY(public.my_student_ids())
      )
    ORDER BY pd.issued_at DESC
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_popor_history TO authenticated;


-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.issue_popor_document('<student-uuid>', 'popor1', '2569', '2', 'ม.6', 'EP/6A', '{}'::jsonb);
-- SELECT public.get_student_transcript('<student-uuid>');
-- SELECT public.get_class_grade_summary('EP/3A', '2569', '1', NULL);
-- SELECT public.get_student_progress_report('<student-uuid>', '2569', '1');
-- SELECT public.get_popor_history(NULL, NULL);
