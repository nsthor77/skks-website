-- ============================================================================
-- Tier 3: Per-period attendance (เช็คชื่อรายคาบ)
-- ============================================================================
-- attendance.period_number int NULL
--   NULL     = daily/homeroom check (existing behavior — canonical for parent
--              LINE alerts and ALL daily stats)
--   non-null = per-period check, tied to class_periods.period_number
--
-- ⚠️ BACKWARD COMPATIBILITY NOTES (read before running):
--   1. mark_attendance + get_attendance_for_date get a NEW trailing parameter.
--      CREATE OR REPLACE with an added param would create a SECOND overload and
--      PostgREST would then fail with ambiguity on EVERY existing call.
--      → We DROP the exact old signatures first, then recreate, then re-GRANT.
--   2. The unique key moves from (student_id, attendance_date) to
--      (student_id, attendance_date, COALESCE(period_number, -1)).
--      The new unique index is created BEFORE the old constraint is dropped,
--      so there is no window without a uniqueness guarantee.
--   3. Every daily aggregate/lookup RPC is re-emitted with
--      "period_number IS NULL" so per-period rows can NEVER leak into daily
--      stats, parent feeds, or LINE absent alerts.
--
-- ⚠️ Run on STAGING first, verify, then prod "School Kit".
-- Idempotent — safe to re-run.
-- Created: 2026-07-13
-- ============================================================================


-- 1. Column
-- ============================================================================
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS period_number int;

COMMENT ON COLUMN public.attendance.period_number IS
  'Tier 3: NULL = daily/homeroom check (canonical for LINE alerts + daily stats); non-null = per-period check (class_periods.period_number)';


-- 2. Unique key: (student_id, attendance_date) → (student_id, attendance_date, COALESCE(period_number, -1))
-- ============================================================================
-- Create the NEW index first (existing rows all have period_number NULL, and the
-- old stricter constraint guarantees no duplicates, so this always succeeds).
CREATE UNIQUE INDEX IF NOT EXISTS attendance_day_period_uidx
  ON public.attendance (student_id, attendance_date, COALESCE(period_number, -1));

-- Then drop the old day-level unique constraint/index (exception-safe).
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_date_key;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    -- legacy DBs may have it as a bare index instead of a constraint
    DROP INDEX IF EXISTS public.attendance_student_date_key;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END$$;

CREATE INDEX IF NOT EXISTS att_school_date_period_idx
  ON public.attendance (school_id, attendance_date, period_number);


-- 3. mark_attendance — DROP old signature, recreate with trailing p_period
-- ============================================================================
-- ⚠️ exact old signature from sprint-12-attendance.sql — do not change this line
DROP FUNCTION IF EXISTS public.mark_attendance(uuid,date,text,timestamptz,timestamptz,text,text,text);

CREATE OR REPLACE FUNCTION public.mark_attendance(
  p_student_id uuid,
  p_date date,
  p_status text,
  p_check_in_at timestamptz DEFAULT NULL,
  p_check_out_at timestamptz DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_method text DEFAULT 'manual',
  p_period int DEFAULT NULL
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
  v_att_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_school_id := public.current_school_id();

  -- Verify student belongs to current school
  SELECT id, grade, classroom, academic_year INTO v_student
  FROM public.students
  WHERE id = p_student_id AND school_id = v_school_id;

  IF v_student.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'student_not_found');
  END IF;

  -- Per-period check: the period must exist for this school and not be a break
  IF p_period IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.class_periods cp
    WHERE cp.school_id = v_school_id
      AND cp.period_number = p_period
      AND COALESCE(cp.is_break, false) = false
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบคาบเรียนนี้ในตารางคาบของโรงเรียน');
  END IF;

  -- Upsert (conflict target expression must match attendance_day_period_uidx exactly)
  INSERT INTO public.attendance (
    school_id, student_id, attendance_date, period_number,
    academic_year, grade, classroom,
    status, check_in_at, check_out_at, check_in_method,
    reason, notes, recorded_by
  ) VALUES (
    v_school_id, p_student_id, p_date, p_period,
    v_student.academic_year, v_student.grade, v_student.classroom,
    p_status,
    COALESCE(p_check_in_at, CASE WHEN p_status IN ('present','late','half_day_am') THEN now() ELSE NULL END),
    p_check_out_at,
    COALESCE(p_method, 'manual'),
    p_reason, p_notes, v_user_id
  )
  ON CONFLICT (student_id, attendance_date, COALESCE(period_number, -1)) DO UPDATE SET
    status        = EXCLUDED.status,
    check_in_at   = COALESCE(EXCLUDED.check_in_at, attendance.check_in_at),
    check_out_at  = COALESCE(EXCLUDED.check_out_at, attendance.check_out_at),
    check_in_method = COALESCE(EXCLUDED.check_in_method, attendance.check_in_method),
    reason        = COALESCE(EXCLUDED.reason, attendance.reason),
    notes         = COALESCE(EXCLUDED.notes, attendance.notes),
    recorded_by   = v_user_id,
    updated_at    = now()
  RETURNING id INTO v_att_id;

  RETURN jsonb_build_object('success', true, 'id', v_att_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_attendance(uuid,date,text,timestamptz,timestamptz,text,text,text,int) TO authenticated;


-- 4. bulk_mark_attendance — signature UNCHANGED (plain replace is safe)
--    Reads optional 'period_number' from each row.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bulk_mark_attendance(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_count int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_result := public.mark_attendance(
      (v_row->>'student_id')::uuid,
      (v_row->>'date')::date,
      v_row->>'status',
      (v_row->>'check_in_at')::timestamptz,
      (v_row->>'check_out_at')::timestamptz,
      v_row->>'reason',
      v_row->>'notes',
      COALESCE(v_row->>'method', 'manual'),
      NULLIF(v_row->>'period_number','')::int
    );
    IF v_result->>'success' = 'true' THEN
      v_count := v_count + 1;
    ELSE
      v_errors := v_errors || jsonb_build_object('student_id', v_row->>'student_id', 'error', v_result->>'error');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'marked', v_count,
    'errors', v_errors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_mark_attendance(jsonb) TO authenticated;


-- 5. get_attendance_for_date — DROP old signature, recreate with trailing p_period
--    p_period NULL → daily rows only (existing behavior, IS NOT DISTINCT FROM NULL)
-- ============================================================================
-- ⚠️ exact old signature from sprint-12-attendance.sql — do not change this line
DROP FUNCTION IF EXISTS public.get_attendance_for_date(date,text,text);

CREATE OR REPLACE FUNCTION public.get_attendance_for_date(
  p_date date,
  p_classroom text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_period int DEFAULT NULL
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
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_school');
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      s.id AS student_id,
      s.student_number,
      s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en, s.nickname,
      s.grade, s.classroom, s.program, s.gender,
      a.id AS attendance_id,
      COALESCE(a.status, 'unmarked') AS status,
      a.check_in_at,
      a.check_out_at,
      a.reason,
      a.notes,
      a.line_send_status,
      a.period_number
    FROM public.students s
    LEFT JOIN public.attendance a
      ON a.student_id = s.id AND a.attendance_date = p_date
      AND a.period_number IS NOT DISTINCT FROM p_period
    WHERE s.school_id = v_school_id
      AND s.status = 'active'
      AND (p_classroom IS NULL OR s.classroom = p_classroom)
      AND (p_grade IS NULL OR s.grade = p_grade)
    ORDER BY s.classroom NULLS LAST, s.student_number NULLS LAST
  ) t;

  RETURN jsonb_build_object(
    'date', p_date,
    'classroom', p_classroom,
    'grade', p_grade,
    'period', p_period,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_for_date(date,text,text,int) TO authenticated;


-- 6. get_attendance_stats — signature UNCHANGED; daily rows only (period_number IS NULL)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_attendance_stats(
  p_date date DEFAULT CURRENT_DATE,
  p_classroom text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_total int;
  v_present int;
  v_absent int;
  v_late int;
  v_excused int;
  v_leave int;
  v_sick int;
  v_unmarked int;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_school');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.students s
  WHERE s.school_id = v_school_id
    AND s.status = 'active'
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_present
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date
    AND a.period_number IS NULL
    AND a.status IN ('present','half_day_am','half_day_pm')
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_absent
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'absent'
    AND a.period_number IS NULL
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_late
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'late'
    AND a.period_number IS NULL
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_excused
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'excused'
    AND a.period_number IS NULL
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_leave
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'leave'
    AND a.period_number IS NULL
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_sick
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'sick'
    AND a.period_number IS NULL
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  v_unmarked := v_total - (v_present + v_absent + v_late + v_excused + v_leave + v_sick);

  RETURN jsonb_build_object(
    'date', p_date,
    'classroom', p_classroom,
    'total', v_total,
    'present', v_present,
    'absent', v_absent,
    'late', v_late,
    'excused', v_excused,
    'leave', v_leave,
    'sick', v_sick,
    'unmarked', v_unmarked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_stats(date,text) TO authenticated;


-- 7. get_my_attendance — signature UNCHANGED; daily rows only (period_number IS NULL)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_attendance(
  p_student_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
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
  v_summary jsonb;
BEGIN
  v_user_id := auth.uid();
  v_school_id := public.current_school_id();

  -- Determine which student we're viewing
  IF p_student_id IS NULL THEN
    SELECT id INTO v_target_student FROM public.students
    WHERE profile_id = v_user_id AND school_id = v_school_id
    LIMIT 1;
  ELSE
    -- Verify access: own student, parent's student, or staff
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

  -- Default range: last 30 days
  IF p_from IS NULL THEN p_from := CURRENT_DATE - INTERVAL '30 days'; END IF;
  IF p_to IS NULL THEN p_to := CURRENT_DATE; END IF;

  -- Fetch records (daily checks only — per-period rows excluded)
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.attendance_date DESC) INTO v_rows
  FROM (
    SELECT a.* FROM public.attendance a
    WHERE a.student_id = v_target_student
      AND a.attendance_date BETWEEN p_from AND p_to
      AND a.period_number IS NULL
    ORDER BY a.attendance_date DESC
  ) t;

  -- Summary counts (daily checks only)
  SELECT jsonb_build_object(
    'present', COUNT(*) FILTER (WHERE status IN ('present','half_day_am','half_day_pm')),
    'absent',  COUNT(*) FILTER (WHERE status = 'absent'),
    'late',    COUNT(*) FILTER (WHERE status = 'late'),
    'excused', COUNT(*) FILTER (WHERE status = 'excused'),
    'leave',   COUNT(*) FILTER (WHERE status = 'leave'),
    'sick',    COUNT(*) FILTER (WHERE status = 'sick'),
    'total',   COUNT(*)
  ) INTO v_summary
  FROM public.attendance
  WHERE student_id = v_target_student
    AND attendance_date BETWEEN p_from AND p_to
    AND period_number IS NULL;

  RETURN jsonb_build_object(
    'student_id', v_target_student,
    'from', p_from,
    'to', p_to,
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'summary', v_summary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_attendance(uuid,date,date) TO authenticated;


-- 8. get_today_summary — signature UNCHANGED; attendance metrics = daily rows only
--    (full body from sprint-tier1-daily.sql + period_number IS NULL in all 3 attendance queries)
-- ============================================================================
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

  -- attendance today (daily checks only — per-period rows excluded)
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
    WHERE a.school_id = sid AND a.attendance_date = CURRENT_DATE
      AND a.period_number IS NULL;

    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_absent_names FROM (
      SELECT jsonb_build_object(
        'name', coalesce(s.first_name_th, s.first_name_en, '') || ' ' || coalesce(s.last_name_th, s.last_name_en, ''),
        'classroom', s.classroom, 'student_id', s.id
      ) AS x
      FROM public.attendance a
      JOIN public.students s ON s.id = a.student_id
      WHERE a.school_id = sid AND a.attendance_date = CURRENT_DATE AND a.status = 'absent'
        AND a.period_number IS NULL
      ORDER BY s.classroom, s.student_number LIMIT 12
    ) t;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- classrooms not yet checked today (daily checks only)
  BEGIN
    WITH all_rooms AS (
      SELECT DISTINCT classroom FROM public.students
      WHERE school_id = sid AND coalesce(status,'active') = 'active'
        AND nullif(btrim(coalesce(classroom,'')),'') IS NOT NULL
    ), done AS (
      SELECT DISTINCT s.classroom FROM public.attendance a
      JOIN public.students s ON s.id = a.student_id
      WHERE a.school_id = sid AND a.attendance_date = CURRENT_DATE
        AND a.period_number IS NULL
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


-- 9. get_my_child_today — signature UNCHANGED; attendance subquery = daily row only
--    (full body from sprint-tier1-daily.sql + period_number IS NULL)
-- ============================================================================
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
          AND a.period_number IS NULL
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


-- 10. NEW get_class_periods — teachable periods for the period selector (staff+)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_class_periods()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_rows jsonb;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN '[]'::jsonb; END IF;
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      cp.period_number,
      cp.label,
      to_char(cp.start_time, 'HH24:MI') AS start_time,
      to_char(cp.end_time,   'HH24:MI') AS end_time
    FROM public.class_periods cp
    WHERE cp.school_id = v_school_id
      AND COALESCE(cp.is_break, false) = false
    ORDER BY cp.sort_order, cp.period_number
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RETURN '[]'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_periods() TO authenticated;


-- ============================================================================
-- Verify
-- ============================================================================
-- 1) Only ONE overload of each changed function (must return 1 row each):
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname IN ('mark_attendance','get_attendance_for_date');
-- 2) Unique index present, old constraint gone:
--    SELECT indexname FROM pg_indexes WHERE tablename='attendance' AND indexname='attendance_day_period_uidx';
--    SELECT conname FROM pg_constraint WHERE conname='attendance_student_date_key';  -- expect 0 rows
-- 3) Daily behavior unchanged (period omitted):
--    SELECT public.get_attendance_for_date(CURRENT_DATE);
--    SELECT public.get_attendance_stats(CURRENT_DATE);
--    SELECT public.get_today_summary();
-- 4) Per-period:
--    SELECT public.get_class_periods();
--    SELECT public.get_attendance_for_date(CURRENT_DATE, NULL, NULL, 1);
--    -- SELECT public.mark_attendance('<student-uuid>', CURRENT_DATE, 'present', NULL, NULL, NULL, NULL, 'manual', 1);
-- 5) Confirm a period-1 mark does NOT appear in daily stats/today summary.
