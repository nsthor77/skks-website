-- ============================================================================
-- Tier 2 — Daily-use upgrades, batch 2 (zero added platform cost)
--   1) global_search(p_query)   → find a student/teacher fast from any page
--   2) get_student_360(p_id)    → one-page student overview (attendance/behavior/grades/homework)
-- Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

-- ───────────────── 1) Global search (students + teachers) ──────────────────
CREATE OR REPLACE FUNCTION public.global_search(p_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; v_students jsonb; v_teachers jsonb; q text;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN '[]'::jsonb; END IF;
  sid := public.current_school_id();
  IF sid IS NULL THEN RETURN '[]'::jsonb; END IF;
  q := btrim(coalesce(p_query, ''));
  IF length(q) < 2 THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_students FROM (
    SELECT jsonb_build_object(
      'type', 'student',
      'id', s.id,
      'title', coalesce(s.first_name_th,s.first_name_en,'') || ' ' || coalesce(s.last_name_th,s.last_name_en,''),
      'subtitle', coalesce(s.student_number,'') ||
        CASE WHEN s.classroom IS NOT NULL THEN ' · ' || s.classroom ELSE '' END,
      'href', 'student-detail.html?id=' || s.id
    ) AS x
    FROM public.students s
    WHERE s.school_id = sid
      AND (
        s.first_name_th ILIKE '%'||q||'%' OR s.last_name_th ILIKE '%'||q||'%'
        OR s.first_name_en ILIKE '%'||q||'%' OR s.last_name_en ILIKE '%'||q||'%'
        OR s.nickname ILIKE '%'||q||'%' OR s.student_number ILIKE '%'||q||'%'
      )
    ORDER BY s.student_number NULLS LAST LIMIT 8
  ) t;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_teachers FROM (
    SELECT jsonb_build_object(
      'type', 'teacher',
      'id', te.id,
      'title', coalesce(te.first_name_th,te.first_name_en,'') || ' ' || coalesce(te.last_name_th,te.last_name_en,''),
      'subtitle', coalesce(te.employee_id,'') ||
        CASE WHEN te.position IS NOT NULL THEN ' · ' || te.position ELSE '' END,
      'href', 'teacher-detail.html?id=' || te.id
    ) AS x
    FROM public.teachers te
    WHERE te.school_id = sid
      AND (
        te.first_name_th ILIKE '%'||q||'%' OR te.last_name_th ILIKE '%'||q||'%'
        OR te.first_name_en ILIKE '%'||q||'%' OR te.last_name_en ILIKE '%'||q||'%'
        OR te.nickname ILIKE '%'||q||'%' OR te.employee_id ILIKE '%'||q||'%'
      )
    ORDER BY te.employee_id NULLS LAST LIMIT 5
  ) t;

  RETURN v_students || v_teachers;
EXCEPTION WHEN OTHERS THEN RETURN '[]'::jsonb;
END $$;
GRANT EXECUTE ON FUNCTION public.global_search(text) TO authenticated;

-- ───────────────── 2) Student 360° overview ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_student_360(p_student_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid; v_uid uuid; v_staff boolean; v_allowed boolean;
  v_att jsonb; v_behavior jsonb; v_grades jsonb; v_homework jsonb;
BEGIN
  sid := public.current_school_id();
  IF sid IS NULL THEN RETURN jsonb_build_object('error','no_school'); END IF;
  v_uid := auth.uid();
  v_staff := public.is_staff_or_higher();
  v_allowed := v_staff OR p_student_id = ANY(public.my_student_ids());
  IF NOT v_allowed THEN RETURN jsonb_build_object('error','no_permission'); END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND school_id = sid) THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;

  -- attendance: last 30 days summary + last 10 records
  BEGIN
    SELECT jsonb_build_object(
      'present', count(*) FILTER (WHERE status IN ('present','late','half_day_am','half_day_pm')),
      'absent',  count(*) FILTER (WHERE status = 'absent'),
      'leave',   count(*) FILTER (WHERE status = 'leave'),
      'recent', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'date', a2.attendance_date, 'status', a2.status
        ) ORDER BY a2.attendance_date DESC), '[]'::jsonb)
        FROM (
          SELECT attendance_date, status FROM public.attendance
          WHERE student_id = p_student_id
          ORDER BY attendance_date DESC LIMIT 10
        ) a2
      )
    ) INTO v_att
    FROM public.attendance
    WHERE student_id = p_student_id AND attendance_date >= CURRENT_DATE - INTERVAL '30 days';
  EXCEPTION WHEN OTHERS THEN v_att := NULL; END;

  -- behavior: current score (base 100 + sum delta) + last 5 records
  BEGIN
    SELECT jsonb_build_object(
      'score', 100 + coalesce((SELECT sum(delta) FROM public.behavior_records WHERE student_id = p_student_id), 0),
      'recent', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'date', b2.occurred_date, 'delta', b2.delta, 'reason', b2.reason, 'category', b2.category
        ) ORDER BY b2.occurred_date DESC), '[]'::jsonb)
        FROM (
          SELECT occurred_date, delta, reason, category FROM public.behavior_records
          WHERE student_id = p_student_id
          ORDER BY occurred_date DESC LIMIT 5
        ) b2
      )
    ) INTO v_behavior;
  EXCEPTION WHEN OTHERS THEN v_behavior := NULL; END;

  -- grades: most recent 10 rows (any term/year)
  BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'subject_name', g.subject_name, 'subject_code', g.subject_code,
      'academic_year', g.academic_year, 'term', g.term,
      'score_total', g.score_total, 'grade_label', g.grade_label
    ) ORDER BY g.academic_year DESC, g.term DESC), '[]'::jsonb) INTO v_grades
    FROM (
      SELECT * FROM public.student_grades
      WHERE student_id = p_student_id
      ORDER BY academic_year DESC, term DESC LIMIT 10
    ) g;
  EXCEPTION WHEN OTHERS THEN v_grades := '[]'::jsonb; END;

  -- homework: open assignment count + submitted/graded counts
  BEGIN
    SELECT jsonb_build_object(
      'submitted', count(*) FILTER (WHERE hs.status = 'submitted'),
      'graded',    count(*) FILTER (WHERE hs.status = 'graded')
    ) INTO v_homework
    FROM public.homework_submissions hs
    WHERE hs.student_id = p_student_id;
  EXCEPTION WHEN OTHERS THEN v_homework := NULL; END;

  RETURN jsonb_build_object(
    'attendance', coalesce(v_att, jsonb_build_object('present',0,'absent',0,'leave',0,'recent','[]'::jsonb)),
    'behavior', coalesce(v_behavior, jsonb_build_object('score',100,'recent','[]'::jsonb)),
    'grades', coalesce(v_grades, '[]'::jsonb),
    'homework', coalesce(v_homework, jsonb_build_object('submitted',0,'graded',0))
  );
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM);
END $$;
GRANT EXECUTE ON FUNCTION public.get_student_360(uuid) TO authenticated;

-- Verify:
--   SELECT public.global_search('อาม');
--   SELECT public.get_student_360('00000000-0000-0000-0000-000000000000');
