-- ============================================================================
-- Sprint 24: Exam Schedule + Seating (ตารางสอบ + ผังที่นั่ง)
-- ============================================================================
-- Staff create exam slots per classroom. Students see their exam timetable.
-- Seating is generated on the fly (students ordered → seat numbers).
-- Created: 2026-05-28
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,                       -- e.g. สอบกลางภาค
  subject text,
  classroom text,
  grade text,
  academic_year text,
  exam_date date,
  start_time text,                           -- 'HH:MM'
  end_time text,
  room text,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS room text;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS start_time text;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS end_time text;
CREATE INDEX IF NOT EXISTS ex_school_idx ON public.exams (school_id, classroom, exam_date);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='ex_set_updated_at') THEN
    CREATE TRIGGER ex_set_updated_at BEFORE UPDATE ON public.exams
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ex_select_staff ON public.exams;
CREATE POLICY ex_select_staff ON public.exams FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS ex_select_own ON public.exams;
CREATE POLICY ex_select_own ON public.exams FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE (s.id = ANY(public.my_student_ids()) OR s.profile_id = auth.uid())
      AND (exams.classroom IS NULL OR s.classroom = exams.classroom)
      AND (exams.grade IS NULL OR s.grade = exams.grade)));

DROP POLICY IF EXISTS ex_modify_staff ON public.exams;
CREATE POLICY ex_modify_staff ON public.exams FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- save / delete
CREATE OR REPLACE FUNCTION public.save_exam(
  p_id uuid, p_title text, p_subject text DEFAULT NULL, p_classroom text DEFAULT NULL,
  p_grade text DEFAULT NULL, p_exam_date date DEFAULT NULL, p_start_time text DEFAULT NULL,
  p_end_time text DEFAULT NULL, p_room text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  v_school := public.current_school_id();
  IF p_title IS NULL OR length(btrim(p_title))=0 THEN RETURN jsonb_build_object('success',false,'error','no_title'); END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.exams (school_id, created_by, title, subject, classroom, grade, exam_date, start_time, end_time, room, note)
    VALUES (v_school, auth.uid(), btrim(p_title), NULLIF(btrim(COALESCE(p_subject,'')),''),
            NULLIF(btrim(COALESCE(p_classroom,'')),''), NULLIF(btrim(COALESCE(p_grade,'')),''),
            p_exam_date, NULLIF(p_start_time,''), NULLIF(p_end_time,''), NULLIF(btrim(COALESCE(p_room,'')),''), p_note)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.exams SET title=btrim(p_title), subject=NULLIF(btrim(COALESCE(p_subject,'')),''),
      classroom=NULLIF(btrim(COALESCE(p_classroom,'')),''), grade=NULLIF(btrim(COALESCE(p_grade,'')),''),
      exam_date=p_exam_date, start_time=NULLIF(p_start_time,''), end_time=NULLIF(p_end_time,''),
      room=NULLIF(btrim(COALESCE(p_room,'')),''), note=p_note
    WHERE id=p_id AND school_id=v_school RETURNING id INTO v_id;
    IF v_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'id',v_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM); END;
$$;
GRANT EXECUTE ON FUNCTION public.save_exam TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_exam(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  v_school := public.current_school_id();
  DELETE FROM public.exams WHERE id=p_id AND school_id=v_school;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM); END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_exam TO authenticated;

-- list (role-aware)
CREATE OR REPLACE FUNCTION public.get_exams(p_classroom text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_uid uuid; v_staff boolean; v_rows jsonb;
BEGIN
  v_school := public.current_school_id();
  IF v_school IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_uid := auth.uid(); v_staff := public.is_staff_or_higher();
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.exam_date, t.start_time) INTO v_rows FROM (
    SELECT e.* FROM public.exams e
    WHERE e.school_id = v_school
      AND (p_classroom IS NULL OR e.classroom = p_classroom)
      AND (v_staff OR EXISTS (SELECT 1 FROM public.students s
            WHERE (s.id = ANY(public.my_student_ids()) OR s.profile_id = v_uid)
              AND (e.classroom IS NULL OR s.classroom = e.classroom)
              AND (e.grade IS NULL OR s.grade = e.grade)))
  ) t;
  RETURN COALESCE(v_rows,'[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_exams TO authenticated;

-- seating: active students of a classroom with seat numbers (staff)
CREATE OR REPLACE FUNCTION public.get_seating(p_classroom text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_rows jsonb;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN '[]'::jsonb; END IF;
  v_school := public.current_school_id();
  SELECT jsonb_agg(row_to_json(t)) INTO v_rows FROM (
    SELECT row_number() OVER (ORDER BY s.student_number, s.first_name_th) AS seat_no,
           s.id, s.student_number, s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en, s.classroom
    FROM public.students s
    WHERE s.school_id = v_school AND COALESCE(s.status,'active')='active' AND s.classroom = p_classroom
  ) t;
  RETURN COALESCE(v_rows,'[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_seating TO authenticated;

-- Verify:
-- SELECT public.save_exam(NULL,'สอบกลางภาค','คณิตศาสตร์','ป.6/1','ป.6','2569-07-01','09:00','10:30','ห้อง 301',NULL);
-- SELECT public.get_exams(NULL);  SELECT public.get_seating('ป.6/1');
