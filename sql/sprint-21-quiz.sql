-- ============================================================================
-- Sprint 21: Online Quiz / Exam (ข้อสอบออนไลน์)
-- ============================================================================
-- Teacher builds a quiz (questions stored as jsonb). Students take it once;
-- multiple-choice / true-false / short-answer are auto-graded.
-- Created: 2026-05-28
-- ============================================================================

-- 1. Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  title text NOT NULL,
  subject text,
  classroom text,
  grade text,
  academic_year text,

  time_limit_minutes int,                    -- NULL = no limit
  due_date date,
  status text NOT NULL DEFAULT 'draft',      -- draft / open / closed

  -- questions: [{ "q":"...", "type":"mc|tf|short", "options":["a","b"], "answer":"a", "points":1 }]
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  answers jsonb NOT NULL DEFAULT '{}'::jsonb, -- { "0":"a", "1":"true", "2":"text" } keyed by question index
  score numeric DEFAULT 0,
  max_score numeric DEFAULT 0,

  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensive
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS questions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS time_limit_minutes int;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS score numeric DEFAULT 0;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS max_score numeric DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS qa_unique_idx ON public.quiz_attempts (quiz_id, student_id);
CREATE INDEX IF NOT EXISTS qz_school_status_idx ON public.quizzes (school_id, status, classroom);
CREATE INDEX IF NOT EXISTS qz_creator_idx ON public.quizzes (created_by);
CREATE INDEX IF NOT EXISTS qa_quiz_idx ON public.quiz_attempts (quiz_id);

COMMENT ON TABLE public.quizzes IS 'Sprint 21: online quizzes; questions as jsonb';
COMMENT ON TABLE public.quiz_attempts IS 'Sprint 21: one attempt per student per quiz; auto-graded';

-- 2. updated_at triggers
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'qz_set_updated_at') THEN
    CREATE TRIGGER qz_set_updated_at BEFORE UPDATE ON public.quizzes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'qa_set_updated_at') THEN
    CREATE TRIGGER qa_set_updated_at BEFORE UPDATE ON public.quiz_attempts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 3. RLS
-- ============================================================================
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qz_select_staff ON public.quizzes;
CREATE POLICY qz_select_staff ON public.quizzes
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS qz_select_open ON public.quizzes;
CREATE POLICY qz_select_open ON public.quizzes
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND status IN ('open','closed')
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE (s.id = ANY(public.my_student_ids()) OR s.profile_id = auth.uid())
        AND (quizzes.classroom IS NULL OR s.classroom = quizzes.classroom)
        AND (quizzes.grade IS NULL OR s.grade = quizzes.grade)
    )
  );

DROP POLICY IF EXISTS qz_modify_staff ON public.quizzes;
CREATE POLICY qz_modify_staff ON public.quizzes
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS qa_select_staff ON public.quiz_attempts;
CREATE POLICY qa_select_staff ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS qa_select_own ON public.quiz_attempts;
CREATE POLICY qa_select_own ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND (student_id = ANY(public.my_student_ids())
         OR submitted_by = auth.uid()
         OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = quiz_attempts.student_id AND s.profile_id = auth.uid()))
  );

-- 4. RPC: save_quiz (create or update) — staff/teacher
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_quiz(
  p_id uuid,
  p_title text,
  p_questions jsonb,
  p_subject text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_time_limit_minutes int DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_status text DEFAULT 'draft',
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

  IF p_id IS NULL THEN
    INSERT INTO public.quizzes (school_id, created_by, title, subject, classroom, grade, academic_year,
                                time_limit_minutes, due_date, status, questions)
    VALUES (v_school_id, auth.uid(), btrim(p_title),
            NULLIF(btrim(COALESCE(p_subject,'')),''), NULLIF(btrim(COALESCE(p_classroom,'')),''),
            NULLIF(btrim(COALESCE(p_grade,'')),''), p_academic_year,
            p_time_limit_minutes, p_due_date, COALESCE(NULLIF(p_status,''),'draft'),
            COALESCE(p_questions, '[]'::jsonb))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.quizzes SET
      title = btrim(p_title),
      subject = NULLIF(btrim(COALESCE(p_subject,'')),''),
      classroom = NULLIF(btrim(COALESCE(p_classroom,'')),''),
      grade = NULLIF(btrim(COALESCE(p_grade,'')),''),
      time_limit_minutes = p_time_limit_minutes,
      due_date = p_due_date,
      status = COALESCE(NULLIF(p_status,''), status),
      questions = COALESCE(p_questions, questions)
    WHERE id = p_id AND school_id = v_school_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_quiz TO authenticated;

-- 5. RPC: delete_quiz (staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_quiz(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();
  DELETE FROM public.quizzes WHERE id = p_id AND school_id = v_school_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_quiz TO authenticated;

-- 6. RPC: get_quizzes (role-aware list, no questions payload)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_quizzes(
  p_status text DEFAULT NULL,
  p_mine boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid; v_uid uuid; v_staff boolean; v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_uid := auth.uid();
  v_staff := public.is_staff_or_higher();

  SELECT jsonb_agg(row_to_json(t) ORDER BY (t.due_date IS NULL), t.due_date ASC, t.created_at DESC) INTO v_rows
  FROM (
    SELECT q.id, q.title, q.subject, q.classroom, q.grade, q.status,
           q.time_limit_minutes, q.due_date, q.created_at,
           jsonb_array_length(q.questions) AS question_count,
           COALESCE(pr.display_name, 'ครู') AS creator_name,
           (SELECT count(*) FROM public.quiz_attempts qa WHERE qa.quiz_id = q.id) AS attempt_count,
           (SELECT jsonb_build_object('score', qa.score, 'max_score', qa.max_score)
              FROM public.quiz_attempts qa
              JOIN public.students s ON s.id = qa.student_id
             WHERE qa.quiz_id = q.id
               AND (s.id = ANY(public.my_student_ids()) OR s.profile_id = v_uid)
             LIMIT 1) AS my_attempt
    FROM public.quizzes q
    LEFT JOIN public.profiles pr ON pr.id = q.created_by
    WHERE q.school_id = v_school_id
      AND (p_status IS NULL OR q.status = p_status)
      AND (NOT p_mine OR q.created_by = v_uid)
      AND (
        v_staff
        OR (q.status IN ('open','closed') AND EXISTS (
              SELECT 1 FROM public.students s
              WHERE (s.id = ANY(public.my_student_ids()) OR s.profile_id = v_uid)
                AND (q.classroom IS NULL OR s.classroom = q.classroom)
                AND (q.grade IS NULL OR s.grade = q.grade)))
      )
    ORDER BY q.created_at DESC
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_quizzes TO authenticated;

-- 7. RPC: get_quiz — full quiz; strips correct answers for non-staff
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_quiz(p_id uuid, p_student_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid; v_uid uuid; v_staff boolean;
  v_q RECORD; v_questions jsonb; v_attempt jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('error','no_school'); END IF;
  v_uid := auth.uid();
  v_staff := public.is_staff_or_higher();

  SELECT * INTO v_q FROM public.quizzes WHERE id = p_id AND school_id = v_school_id;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;

  IF v_staff THEN
    v_questions := v_q.questions;
  ELSE
    -- must be open + match classroom (RLS also enforces); strip 'answer' from each question
    SELECT jsonb_agg(elem - 'answer') INTO v_questions
    FROM jsonb_array_elements(v_q.questions) elem;
    v_questions := COALESCE(v_questions, '[]'::jsonb);
    -- their existing attempt (if any)
    SELECT jsonb_build_object('answers', qa.answers, 'score', qa.score, 'max_score', qa.max_score, 'submitted_at', qa.submitted_at)
      INTO v_attempt
    FROM public.quiz_attempts qa
    JOIN public.students s ON s.id = qa.student_id
    WHERE qa.quiz_id = p_id AND (s.id = ANY(public.my_student_ids()) OR s.profile_id = v_uid)
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_q.id, 'title', v_q.title, 'subject', v_q.subject,
    'classroom', v_q.classroom, 'status', v_q.status,
    'time_limit_minutes', v_q.time_limit_minutes, 'due_date', v_q.due_date,
    'questions', v_questions,
    'my_attempt', v_attempt
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_quiz TO authenticated;

-- 8. RPC: submit_quiz — auto-grade + store attempt (one per student)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_quiz(
  p_quiz_id uuid,
  p_student_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid; v_uid uuid; v_can boolean;
  v_questions jsonb; v_elem jsonb; v_idx int;
  v_score numeric := 0; v_max numeric := 0; v_pts numeric; v_correct text; v_given text;
  v_id uuid;
BEGIN
  v_uid := auth.uid();
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_school'); END IF;

  SELECT questions INTO v_questions FROM public.quizzes
   WHERE id = p_quiz_id AND school_id = v_school_id AND status = 'open';
  IF v_questions IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_open'); END IF;

  v_can := public.is_staff_or_higher()
    OR p_student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.profile_id = v_uid);
  IF NOT v_can THEN RETURN jsonb_build_object('success', false, 'error', 'no_access'); END IF;

  -- grade
  v_idx := 0;
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_pts := COALESCE(NULLIF(v_elem->>'points','')::numeric, 1);
    v_max := v_max + v_pts;
    v_correct := lower(btrim(COALESCE(v_elem->>'answer','')));
    v_given := lower(btrim(COALESCE(p_answers->>(v_idx::text),'')));
    IF v_correct <> '' AND v_given <> '' AND v_given = v_correct THEN
      v_score := v_score + v_pts;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  INSERT INTO public.quiz_attempts (school_id, quiz_id, student_id, submitted_by, answers, score, max_score)
  VALUES (v_school_id, p_quiz_id, p_student_id, v_uid, COALESCE(p_answers,'{}'::jsonb), v_score, v_max)
  ON CONFLICT (quiz_id, student_id) DO UPDATE SET
    answers = EXCLUDED.answers, score = EXCLUDED.score, max_score = EXCLUDED.max_score,
    submitted_by = EXCLUDED.submitted_by, submitted_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'score', v_score, 'max_score', v_max);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_quiz TO authenticated;

-- 9. RPC: get_quiz_attempts (staff) — results for a quiz
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_quiz_attempts(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_rows jsonb;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN '[]'::jsonb; END IF;
  v_school_id := public.current_school_id();
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.score DESC) INTO v_rows
  FROM (
    SELECT qa.id, qa.score, qa.max_score, qa.submitted_at,
           s.student_number, s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en, s.classroom
    FROM public.quiz_attempts qa
    JOIN public.students s ON s.id = qa.student_id
    WHERE qa.quiz_id = p_quiz_id AND qa.school_id = v_school_id
  ) t;
  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_quiz_attempts TO authenticated;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.save_quiz(NULL,'แบบทดสอบบทที่ 1',
--   '[{"q":"2+2=?","type":"mc","options":["3","4","5"],"answer":"4","points":1},
--     {"q":"โลกกลม","type":"tf","answer":"true","points":1}]'::jsonb,
--   'คณิต','ป.6/1','ป.6',10,'2569-06-15','open','2569');
-- SELECT public.get_quizzes(NULL,false);
-- SELECT public.get_quiz('<id>');
-- SELECT public.submit_quiz('<id>','<student>','{"0":"4","1":"true"}'::jsonb);
