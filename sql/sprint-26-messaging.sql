-- ============================================================================
-- Sprint 26: Teacher–Parent Messaging (แชทครู-ผู้ปกครอง 2 ทาง)
-- ============================================================================
-- One thread per student, between staff and the student's parents/student.
-- Created: 2026-05-28
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_role text,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS msg_school_student_idx ON public.messages (school_id, student_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msg_select ON public.messages;
CREATE POLICY msg_select ON public.messages FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND (
    public.is_staff_or_higher()
    OR student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = messages.student_id AND s.profile_id = auth.uid())
  ));

DROP POLICY IF EXISTS msg_insert ON public.messages;
CREATE POLICY msg_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (school_id = public.current_school_id() AND (
    public.is_staff_or_higher()
    OR student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = messages.student_id AND s.profile_id = auth.uid())
  ));

DROP POLICY IF EXISTS msg_delete_staff ON public.messages;
CREATE POLICY msg_delete_staff ON public.messages FOR DELETE TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- send
CREATE OR REPLACE FUNCTION public.send_message(p_student_id uuid, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_uid uuid; v_can boolean; v_role text; v_id uuid;
BEGIN
  v_uid := auth.uid(); v_school := public.current_school_id();
  IF v_school IS NULL THEN RETURN jsonb_build_object('success',false,'error','no_school'); END IF;
  IF p_body IS NULL OR length(btrim(p_body))=0 THEN RETURN jsonb_build_object('success',false,'error','empty'); END IF;
  v_can := public.is_staff_or_higher()
    OR p_student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.profile_id = v_uid);
  IF NOT v_can THEN RETURN jsonb_build_object('success',false,'error','no_access'); END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.messages (school_id, student_id, sender_id, sender_role, body)
  VALUES (v_school, p_student_id, v_uid, v_role, btrim(p_body)) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM); END;
$$;
GRANT EXECUTE ON FUNCTION public.send_message TO authenticated;

-- messages of a thread
CREATE OR REPLACE FUNCTION public.get_messages(p_student_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_uid uuid; v_can boolean; v_rows jsonb;
BEGIN
  v_school := public.current_school_id(); v_uid := auth.uid();
  IF v_school IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_can := public.is_staff_or_higher()
    OR p_student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.profile_id = v_uid);
  IF NOT v_can THEN RETURN '[]'::jsonb; END IF;
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at ASC) INTO v_rows FROM (
    SELECT m.id, m.body, m.sender_id, m.sender_role, m.created_at,
           COALESCE(pr.display_name,'') AS sender_name,
           (m.sender_id = v_uid) AS mine
    FROM public.messages m
    LEFT JOIN public.profiles pr ON pr.id = m.sender_id
    WHERE m.school_id = v_school AND m.student_id = p_student_id
  ) t;
  RETURN COALESCE(v_rows,'[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_messages TO authenticated;

-- thread list (role-aware)
CREATE OR REPLACE FUNCTION public.get_threads()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_uid uuid; v_staff boolean; v_rows jsonb;
BEGIN
  v_school := public.current_school_id(); v_uid := auth.uid();
  IF v_school IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_staff := public.is_staff_or_higher();

  IF v_staff THEN
    -- students that have at least one message
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.last_at DESC) INTO v_rows FROM (
      SELECT s.id AS student_id, s.first_name_th, s.last_name_th, s.classroom,
             (SELECT body FROM public.messages m WHERE m.student_id=s.id ORDER BY created_at DESC LIMIT 1) AS last_body,
             (SELECT max(created_at) FROM public.messages m WHERE m.student_id=s.id) AS last_at
      FROM public.students s
      WHERE s.school_id = v_school
        AND EXISTS (SELECT 1 FROM public.messages m WHERE m.student_id = s.id)
    ) t;
  ELSE
    -- their own children/student record
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.last_at DESC NULLS LAST) INTO v_rows FROM (
      SELECT s.id AS student_id, s.first_name_th, s.last_name_th, s.classroom,
             (SELECT body FROM public.messages m WHERE m.student_id=s.id ORDER BY created_at DESC LIMIT 1) AS last_body,
             (SELECT max(created_at) FROM public.messages m WHERE m.student_id=s.id) AS last_at
      FROM public.students s
      WHERE s.school_id = v_school
        AND (s.id = ANY(public.my_student_ids()) OR s.profile_id = v_uid)
    ) t;
  END IF;
  RETURN COALESCE(v_rows,'[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_threads TO authenticated;

-- Verify:
-- SELECT public.send_message('<student>','สวัสดีครับ');
-- SELECT public.get_threads();  SELECT public.get_messages('<student>');
