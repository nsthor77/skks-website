-- ============================================================================
-- Sprint 18: Homework / Assignments (การบ้าน/งานมอบหมาย)
-- ============================================================================
-- Teacher/staff create homework targeting a classroom (or grade, or whole school).
-- Students/parents see homework for their classroom and can mark done / submit.
-- Teachers can view submissions and give a score + feedback.
-- Created: 2026-05-28
-- ============================================================================

-- 1. Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.homework_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  title text NOT NULL,
  description text,
  subject text,                               -- free text or subject code
  classroom text,                             -- target classroom (NULL = all in grade / school)
  grade text,                                 -- target grade (NULL = any)
  academic_year text,

  assigned_date date DEFAULT current_date,
  due_date date,
  points numeric,                             -- max score (optional)
  attachment_url text,                        -- worksheet / link

  status text NOT NULL DEFAULT 'open',        -- open / closed
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  homework_id uuid NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'submitted',   -- submitted / done (graded)
  note text,                                  -- student's answer / link
  attachment_url text,
  score numeric,                              -- teacher grading (optional)
  feedback text,

  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensive ADD COLUMN (in case tables pre-existed in a partial state)
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS classroom text;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS assigned_date date DEFAULT current_date;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS points numeric;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.homework_assignments ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS homework_id uuid REFERENCES public.homework_assignments(id) ON DELETE CASCADE;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS status text DEFAULT 'submitted';
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS score numeric;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now();
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- One submission per student per homework
CREATE UNIQUE INDEX IF NOT EXISTS hw_sub_unique_idx ON public.homework_submissions (homework_id, student_id);

CREATE INDEX IF NOT EXISTS hw_school_status_idx ON public.homework_assignments (school_id, status, due_date);
CREATE INDEX IF NOT EXISTS hw_school_classroom_idx ON public.homework_assignments (school_id, classroom);
CREATE INDEX IF NOT EXISTS hw_creator_idx ON public.homework_assignments (created_by);
CREATE INDEX IF NOT EXISTS hw_sub_homework_idx ON public.homework_submissions (homework_id);
CREATE INDEX IF NOT EXISTS hw_sub_student_idx ON public.homework_submissions (student_id);

COMMENT ON TABLE public.homework_assignments IS 'Sprint 18: homework/assignments created by staff, targeting a classroom/grade';
COMMENT ON TABLE public.homework_submissions IS 'Sprint 18: student submissions / mark-done for homework, with optional teacher score';

-- 2. updated_at triggers
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hw_set_updated_at') THEN
    CREATE TRIGGER hw_set_updated_at BEFORE UPDATE ON public.homework_assignments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hw_sub_set_updated_at') THEN
    CREATE TRIGGER hw_sub_set_updated_at BEFORE UPDATE ON public.homework_submissions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 3. RLS
-- ============================================================================
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- --- homework_assignments ---
DROP POLICY IF EXISTS hw_select_staff ON public.homework_assignments;
CREATE POLICY hw_select_staff ON public.homework_assignments
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS hw_select_own ON public.homework_assignments;
CREATE POLICY hw_select_own ON public.homework_assignments
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE (s.id = ANY(public.my_student_ids()) OR s.profile_id = auth.uid())
        AND (homework_assignments.classroom IS NULL OR s.classroom = homework_assignments.classroom)
        AND (homework_assignments.grade IS NULL OR s.grade = homework_assignments.grade)
    )
  );

DROP POLICY IF EXISTS hw_modify_staff ON public.homework_assignments;
CREATE POLICY hw_modify_staff ON public.homework_assignments
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- --- homework_submissions ---
DROP POLICY IF EXISTS hws_select_staff ON public.homework_submissions;
CREATE POLICY hws_select_staff ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS hws_select_own ON public.homework_submissions;
CREATE POLICY hws_select_own ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND (
      student_id = ANY(public.my_student_ids())
      OR submitted_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = homework_submissions.student_id AND s.profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS hws_insert_own ON public.homework_submissions;
CREATE POLICY hws_insert_own ON public.homework_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.current_school_id()
    AND (
      public.is_staff_or_higher()
      OR student_id = ANY(public.my_student_ids())
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = homework_submissions.student_id AND s.profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS hws_update_own ON public.homework_submissions;
CREATE POLICY hws_update_own ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (
    school_id = public.current_school_id()
    AND (
      public.is_staff_or_higher()
      OR student_id = ANY(public.my_student_ids())
      OR submitted_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = homework_submissions.student_id AND s.profile_id = auth.uid())
    )
  )
  WITH CHECK (school_id = public.current_school_id());

DROP POLICY IF EXISTS hws_delete_staff ON public.homework_submissions;
CREATE POLICY hws_delete_staff ON public.homework_submissions
  FOR DELETE TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- 4. RPC: create_homework (staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_homework(
  p_title text,
  p_description text DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_points numeric DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_academic_year text DEFAULT NULL
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
  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_title');
  END IF;

  INSERT INTO public.homework_assignments
    (school_id, created_by, title, description, subject, classroom, grade, academic_year, due_date, points, attachment_url, status)
  VALUES
    (v_school_id, auth.uid(), btrim(p_title), p_description, NULLIF(btrim(COALESCE(p_subject,'')),''),
     NULLIF(btrim(COALESCE(p_classroom,'')),''), NULLIF(btrim(COALESCE(p_grade,'')),''),
     p_academic_year, p_due_date, p_points, p_attachment_url, 'open')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_homework TO authenticated;

-- 5. RPC: update_homework (staff) — edit / close-reopen
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_homework(
  p_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_points numeric DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();

  UPDATE public.homework_assignments SET
    title          = COALESCE(NULLIF(btrim(COALESCE(p_title,'')),''), title),
    description    = COALESCE(p_description, description),
    subject        = COALESCE(p_subject, subject),
    classroom      = COALESCE(p_classroom, classroom),
    grade          = COALESCE(p_grade, grade),
    due_date       = COALESCE(p_due_date, due_date),
    points         = COALESCE(p_points, points),
    attachment_url = COALESCE(p_attachment_url, attachment_url),
    status         = COALESCE(NULLIF(p_status,''), status)
  WHERE id = p_id AND school_id = v_school_id;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_homework TO authenticated;

-- 6. RPC: delete_homework (staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_homework(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();
  DELETE FROM public.homework_assignments WHERE id = p_id AND school_id = v_school_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_homework TO authenticated;

-- 7. RPC: get_homework (role-aware)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_homework(
  p_status text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_mine boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_uid uuid;
  v_staff boolean;
  v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_uid := auth.uid();
  v_staff := public.is_staff_or_higher();

  SELECT jsonb_agg(row_to_json(t) ORDER BY (t.due_date IS NULL), t.due_date ASC, t.created_at DESC) INTO v_rows
  FROM (
    SELECT ha.*,
           COALESCE(pr.display_name, 'ครู') AS creator_name,
           (SELECT count(*) FROM public.homework_submissions hs WHERE hs.homework_id = ha.id) AS submission_count,
           EXISTS (
             SELECT 1 FROM public.homework_submissions hs
             JOIN public.students s ON s.id = hs.student_id
             WHERE hs.homework_id = ha.id
               AND (s.id = ANY(public.my_student_ids()) OR s.profile_id = v_uid)
           ) AS my_submitted
    FROM public.homework_assignments ha
    LEFT JOIN public.profiles pr ON pr.id = ha.created_by
    WHERE ha.school_id = v_school_id
      AND (p_status IS NULL OR ha.status = p_status)
      AND (p_classroom IS NULL OR ha.classroom = p_classroom)
      AND (NOT p_mine OR ha.created_by = v_uid)
      AND (
        v_staff
        OR EXISTS (
          SELECT 1 FROM public.students s
          WHERE (s.id = ANY(public.my_student_ids()) OR s.profile_id = v_uid)
            AND (ha.classroom IS NULL OR s.classroom = ha.classroom)
            AND (ha.grade IS NULL OR s.grade = ha.grade)
        )
      )
    ORDER BY (ha.due_date IS NULL), ha.due_date ASC, ha.created_at DESC
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_homework TO authenticated;

-- 8. RPC: submit_homework (student/parent or staff) — upsert mark-done / submit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_homework(
  p_homework_id uuid,
  p_student_id uuid,
  p_note text DEFAULT NULL,
  p_attachment_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_uid uuid;
  v_can boolean;
  v_id uuid;
BEGIN
  v_uid := auth.uid();
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_school'); END IF;

  -- homework must exist in this school
  IF NOT EXISTS (SELECT 1 FROM public.homework_assignments WHERE id = p_homework_id AND school_id = v_school_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  v_can := public.is_staff_or_higher()
    OR p_student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.profile_id = v_uid);
  IF NOT v_can THEN RETURN jsonb_build_object('success', false, 'error', 'no_access'); END IF;

  INSERT INTO public.homework_submissions
    (school_id, homework_id, student_id, submitted_by, status, note, attachment_url)
  VALUES
    (v_school_id, p_homework_id, p_student_id, v_uid, 'submitted', p_note, p_attachment_url)
  ON CONFLICT (homework_id, student_id) DO UPDATE SET
    note = COALESCE(EXCLUDED.note, homework_submissions.note),
    attachment_url = COALESCE(EXCLUDED.attachment_url, homework_submissions.attachment_url),
    submitted_by = EXCLUDED.submitted_by,
    status = 'submitted',
    submitted_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_homework TO authenticated;

-- 9. RPC: grade_homework (staff) — score + feedback
-- ============================================================================
CREATE OR REPLACE FUNCTION public.grade_homework(
  p_submission_id uuid,
  p_score numeric DEFAULT NULL,
  p_feedback text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();

  UPDATE public.homework_submissions
  SET score = p_score,
      feedback = p_feedback,
      status = 'done'
  WHERE id = p_submission_id AND school_id = v_school_id;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.grade_homework TO authenticated;

-- 10. RPC: get_homework_submissions (staff sees all for a homework; student sees own)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_homework_submissions(p_homework_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_uid uuid;
  v_staff boolean;
  v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_uid := auth.uid();
  v_staff := public.is_staff_or_higher();

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.submitted_at DESC) INTO v_rows
  FROM (
    SELECT hs.*,
           s.student_number, s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en,
           s.nickname, s.classroom, s.grade
    FROM public.homework_submissions hs
    JOIN public.students s ON s.id = hs.student_id
    WHERE hs.homework_id = p_homework_id
      AND hs.school_id = v_school_id
      AND (
        v_staff
        OR hs.student_id = ANY(public.my_student_ids())
        OR hs.submitted_by = v_uid
        OR EXISTS (SELECT 1 FROM public.students s2 WHERE s2.id = hs.student_id AND s2.profile_id = v_uid)
      )
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_homework_submissions TO authenticated;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.create_homework('อ่านบทที่ 3','สรุปใจความสำคัญ','ภาษาไทย','ป.6/1','ป.6','2569-06-10',10,NULL,'2569');
-- SELECT public.get_homework(NULL, NULL, false);
-- SELECT public.submit_homework('<homework_id>','<student_id>','ทำเสร็จแล้วครับ',NULL);
-- SELECT public.get_homework_submissions('<homework_id>');
-- SELECT public.grade_homework('<submission_id>', 9, 'ดีมาก');
