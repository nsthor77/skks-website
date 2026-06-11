-- ============================================================================
-- Tier 1 — Daily-use upgrades (zero added platform cost)
--   1) get_today_summary()    → "วันนี้" operational dashboard (staff+)
--   2) get_my_child_today()   → parent/student one-page feed
--   3) Gradebook              → grade_items + grade_scores + RPCs (คะแนนเก็บ)
-- Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

-- ───────────────── 1) Today summary (staff dashboard) ──────────────────────
CREATE OR REPLACE FUNCTION public.get_today_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid; v jsonb := '{}'::jsonb;
  v_total int := 0; v_checked int := 0; v_present int := 0; v_absent int := 0; v_leave int := 0;
  v_absent_names jsonb := '[]'::jsonb;
  v_unchecked jsonb := '[]'::jsonb; v_unchecked_count int := 0;
  v_money numeric := 0; v_slips int := 0; v_ungraded int := 0;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('error','no_permission'); END IF;
  sid := public.current_school_id();
  IF sid IS NULL THEN RETURN jsonb_build_object('error','no_school'); END IF;

  -- attendance today
  BEGIN
    SELECT count(*) INTO v_total FROM public.students
    WHERE school_id = sid AND coalesce(status,'active') = 'active';

    SELECT count(*),
           count(*) FILTER (WHERE a.status IN ('present','late','half_day_am','half_day_pm')),
           count(*) FILTER (WHERE a.status = 'absent'),
           count(*) FILTER (WHERE a.status = 'leave')
    INTO v_checked, v_present, v_absent, v_leave
    FROM public.attendance a
    JOIN public.students s ON s.id = a.student_id AND coalesce(s.status,'active') = 'active'
    WHERE a.school_id = sid AND a.attendance_date = CURRENT_DATE;

    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_absent_names FROM (
      SELECT jsonb_build_object(
        'name', coalesce(s.first_name_th, s.first_name_en, '') || ' ' || coalesce(s.last_name_th, s.last_name_en, ''),
        'classroom', s.classroom, 'student_id', s.id
      ) AS x
      FROM public.attendance a
      JOIN public.students s ON s.id = a.student_id
      WHERE a.school_id = sid AND a.attendance_date = CURRENT_DATE AND a.status = 'absent'
      ORDER BY s.classroom, s.student_number LIMIT 12
    ) t;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- classrooms not yet checked today
  BEGIN
    WITH all_rooms AS (
      SELECT DISTINCT classroom FROM public.students
      WHERE school_id = sid AND coalesce(status,'active') = 'active'
        AND nullif(btrim(coalesce(classroom,'')),'') IS NOT NULL
    ), done AS (
      SELECT DISTINCT s.classroom FROM public.attendance a
      JOIN public.students s ON s.id = a.student_id
      WHERE a.school_id = sid AND a.attendance_date = CURRENT_DATE
    )
    SELECT coalesce(jsonb_agg(classroom ORDER BY classroom), '[]'::jsonb), count(*)
    INTO v_unchecked, v_unchecked_count
    FROM (SELECT classroom FROM all_rooms EXCEPT SELECT classroom FROM done) q;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- money received today (join through students for tenant scope)
  BEGIN
    SELECT coalesce(sum(p.amount), 0) INTO v_money
    FROM public.payments p
    JOIN public.students s ON s.id = p.student_id
    WHERE s.school_id = sid AND p.status = 'completed' AND p.payment_date = CURRENT_DATE;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- pending slips
  BEGIN
    SELECT count(*) INTO v_slips FROM public.payment_slips
    WHERE school_id = sid AND status = 'pending';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- homework submissions waiting for grading
  BEGIN
    SELECT count(*) INTO v_ungraded FROM public.homework_submissions
    WHERE school_id = sid AND status = 'submitted';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'total_active', v_total, 'checked', v_checked, 'present', v_present,
    'absent', v_absent, 'leave', v_leave, 'absent_names', v_absent_names,
    'unchecked_classrooms', v_unchecked, 'unchecked_count', v_unchecked_count,
    'money_today', v_money, 'slips_pending', v_slips, 'homework_ungraded', v_ungraded
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_today_summary() TO authenticated;

-- ───────────────── 2) My child today (parent/student feed) ─────────────────
CREATE OR REPLACE FUNCTION public.get_my_child_today()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_data), '[]'::jsonb) INTO v FROM (
    SELECT jsonb_build_object(
      'student_id', s.id,
      'name', coalesce(s.first_name_th, s.first_name_en, '') || ' ' || coalesce(s.last_name_th, s.last_name_en, ''),
      'nickname', s.nickname,
      'classroom', s.classroom,
      'attendance', (
        SELECT jsonb_build_object('status', a.status, 'check_in_at', a.check_in_at)
        FROM public.attendance a
        WHERE a.student_id = s.id AND a.attendance_date = CURRENT_DATE
        LIMIT 1
      ),
      'homework', (
        SELECT coalesce(jsonb_agg(h), '[]'::jsonb) FROM (
          SELECT jsonb_build_object('id', ha.id, 'title', ha.title, 'subject', ha.subject, 'due_date', ha.due_date) AS h
          FROM public.homework_assignments ha
          WHERE ha.school_id = s.school_id AND coalesce(ha.status,'open') = 'open'
            AND (nullif(btrim(coalesce(ha.classroom,'')),'') IS NULL OR ha.classroom = s.classroom)
            AND NOT EXISTS (
              SELECT 1 FROM public.homework_submissions hs
              WHERE hs.homework_id = ha.id AND hs.student_id = s.id
            )
          ORDER BY ha.due_date NULLS LAST, ha.assigned_date DESC LIMIT 3
        ) hh
      ),
      'unpaid', (
        SELECT jsonb_build_object('count', count(*), 'total', coalesce(sum(b.amount),0))
        FROM public.bills b
        WHERE b.student_id = s.id AND b.status IN ('unpaid','overdue')
      )
    ) AS row_data
    FROM public.students s
    WHERE s.id = ANY(public.my_student_ids())
      AND coalesce(s.status,'active') = 'active'
    ORDER BY s.first_name_th
  ) q;
  RETURN coalesce(v, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN RETURN '[]'::jsonb;
END $$;
GRANT EXECUTE ON FUNCTION public.get_my_child_today() TO authenticated;

-- ───────────────── 3) Gradebook (สมุดคะแนนเก็บ) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.grade_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  classroom text NOT NULL,
  subject_code text NOT NULL,
  subject_name text,
  academic_year text NOT NULL,
  term text NOT NULL,
  name text NOT NULL,                    -- เช่น "เก็บครั้งที่ 1", "กลางภาค"
  max_score numeric(6,2) NOT NULL DEFAULT 10,
  weight numeric(5,2) NOT NULL DEFAULT 10,   -- % ของเกรดรวม
  item_order int DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gi_lookup_idx ON public.grade_items
  (school_id, classroom, subject_code, academic_year, term, item_order);

CREATE TABLE IF NOT EXISTS public.grade_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.grade_items(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score numeric(6,2),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (item_id, student_id)
);
CREATE INDEX IF NOT EXISTS gs_item_idx ON public.grade_scores (item_id);
CREATE INDEX IF NOT EXISTS gs_student_idx ON public.grade_scores (student_id);

ALTER TABLE public.grade_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gi_staff ON public.grade_items;
CREATE POLICY gi_staff ON public.grade_items FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());
DROP POLICY IF EXISTS gs_staff ON public.grade_scores;
CREATE POLICY gs_staff ON public.grade_scores FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());
-- students may read their own scores (สำหรับหน้า my-grades ภายหลัง)
DROP POLICY IF EXISTS gs_student_read ON public.grade_scores;
CREATE POLICY gs_student_read ON public.grade_scores FOR SELECT TO authenticated
  USING (student_id = ANY(public.my_student_ids()));

-- save (insert/update) a grade item
CREATE OR REPLACE FUNCTION public.save_grade_item(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; v_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'คุณไม่มีสิทธิ์');
  END IF;
  sid := public.current_school_id();
  IF coalesce(btrim(p->>'name'),'') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'กรุณาตั้งชื่อช่องคะแนน');
  END IF;

  IF (p->>'id') IS NOT NULL THEN
    UPDATE public.grade_items SET
      name = btrim(p->>'name'),
      max_score = coalesce((p->>'max_score')::numeric, max_score),
      weight = coalesce((p->>'weight')::numeric, weight),
      item_order = coalesce((p->>'item_order')::int, item_order),
      updated_at = now()
    WHERE id = (p->>'id')::uuid AND school_id = sid
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.grade_items
      (school_id, classroom, subject_code, subject_name, academic_year, term,
       name, max_score, weight, item_order, created_by)
    VALUES
      (sid, p->>'classroom', p->>'subject_code', p->>'subject_name',
       p->>'academic_year', p->>'term', btrim(p->>'name'),
       coalesce((p->>'max_score')::numeric, 10), coalesce((p->>'weight')::numeric, 10),
       coalesce((p->>'item_order')::int, 0), auth.uid())
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

-- delete an item (scores cascade)
CREATE OR REPLACE FUNCTION public.delete_grade_item(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'คุณไม่มีสิทธิ์');
  END IF;
  DELETE FROM public.grade_items WHERE id = p_id AND school_id = public.current_school_id();
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

-- full gradebook matrix for one class+subject+term
CREATE OR REPLACE FUNCTION public.get_gradebook(
  p_classroom text, p_subject_code text, p_academic_year text, p_term text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; v_items jsonb; v_students jsonb; v_scores jsonb;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('error','no_permission'); END IF;
  sid := public.current_school_id();

  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.item_order, i.created_at), '[]'::jsonb) INTO v_items
  FROM public.grade_items i
  WHERE i.school_id = sid AND i.classroom = p_classroom
    AND i.subject_code = p_subject_code
    AND i.academic_year = p_academic_year AND i.term = p_term;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'student_number', s.student_number,
      'name', coalesce(s.first_name_th, s.first_name_en, '') || ' ' || coalesce(s.last_name_th, s.last_name_en, '')
    ) ORDER BY s.student_number), '[]'::jsonb) INTO v_students
  FROM public.students s
  WHERE s.school_id = sid AND s.classroom = p_classroom
    AND coalesce(s.status,'active') = 'active';

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'item_id', g.item_id, 'student_id', g.student_id, 'score', g.score)), '[]'::jsonb) INTO v_scores
  FROM public.grade_scores g
  JOIN public.grade_items i ON i.id = g.item_id
  WHERE i.school_id = sid AND i.classroom = p_classroom
    AND i.subject_code = p_subject_code
    AND i.academic_year = p_academic_year AND i.term = p_term;

  RETURN jsonb_build_object('items', v_items, 'students', v_students, 'scores', v_scores);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM);
END $$;

-- bulk save scores for one item: p_rows = [{student_id, score|null}, ...]
CREATE OR REPLACE FUNCTION public.save_grade_scores(p_item_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; r jsonb; v_saved int := 0;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'คุณไม่มีสิทธิ์');
  END IF;
  sid := public.current_school_id();
  IF NOT EXISTS (SELECT 1 FROM public.grade_items WHERE id = p_item_id AND school_id = sid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบช่องคะแนน');
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) LOOP
    BEGIN
      INSERT INTO public.grade_scores (school_id, item_id, student_id, score, updated_by)
      VALUES (sid, p_item_id, (r->>'student_id')::uuid,
              nullif(r->>'score','')::numeric, auth.uid())
      ON CONFLICT (item_id, student_id) DO UPDATE
        SET score = excluded.score, updated_by = auth.uid(), updated_at = now();
      v_saved := v_saved + 1;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'saved', v_saved);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

GRANT EXECUTE ON FUNCTION public.save_grade_item(jsonb)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_grade_item(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gradebook(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_grade_scores(uuid,jsonb)      TO authenticated;

-- Verify:
--   SELECT public.get_today_summary();
--   SELECT public.get_my_child_today();
--   SELECT public.get_gradebook('ป.1/1','MATH101','2569','1');
