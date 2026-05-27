-- ============================================================================
-- Sprint 12: Attendance + LINE Messaging
-- ============================================================================
-- Daily attendance records per student. Includes status (present/absent/late/excused/leave),
-- check-in/out time, and optional notes. LINE notification status tracked separately.
-- Created: 2026-05-27
-- ============================================================================

-- 1. attendance table — defensive (works with legacy SKKS schema too)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  status text DEFAULT 'present',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensive: ensure all columns exist (legacy or new)
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS attendance_date date;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS classroom text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status text DEFAULT 'present';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_at timestamptz;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_at timestamptz;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_method text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS line_sent_at timestamptz;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS line_message_id text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS line_send_status text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS line_error text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Drop old CHECK constraint if any (legacy may have different status values)
DO $$
BEGIN
  -- Add CHECK constraints safely
  BEGIN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check
      CHECK (status IS NULL OR status IN ('present','absent','late','excused','leave','sick','event','half_day_am','half_day_pm'));
  EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_method_check
      CHECK (check_in_method IS NULL OR check_in_method IN ('manual','qr','rfid','face','line','app'));
  EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_line_status_check
      CHECK (line_send_status IS NULL OR line_send_status IN ('queued','sent','failed','skipped'));
  EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
  END;
END$$;

-- Unique constraint (one record per student per day)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_date_key UNIQUE (student_id, attendance_date);
  EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN OTHERS THEN NULL;
  END;
END$$;

CREATE INDEX IF NOT EXISTS att_school_date_idx ON public.attendance (school_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS att_student_date_idx ON public.attendance (student_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS att_school_class_date_idx ON public.attendance (school_id, classroom, attendance_date DESC);
CREATE INDEX IF NOT EXISTS att_school_status_idx ON public.attendance (school_id, status, attendance_date DESC);
CREATE INDEX IF NOT EXISTS att_custom_data_idx ON public.attendance USING gin (custom_data);

COMMENT ON TABLE public.attendance IS 'Sprint 12: Daily attendance records per student (defensive — works with legacy)';


-- 2. Trigger updated_at
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'attendance_set_updated_at') THEN
    CREATE TRIGGER attendance_set_updated_at
      BEFORE UPDATE ON public.attendance
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;


-- 3. RLS
-- ============================================================================
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Staff can read all attendance for their school
DROP POLICY IF EXISTS att_select_staff ON public.attendance;
CREATE POLICY att_select_staff ON public.attendance
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- Students can read their own; parents can read their kids'
DROP POLICY IF EXISTS att_select_self_or_parent ON public.attendance;
CREATE POLICY att_select_self_or_parent ON public.attendance
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id() AND (
      student_id = ANY(public.my_student_ids())
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = attendance.student_id AND s.profile_id = auth.uid()
      )
    )
  );

-- Only staff can modify
DROP POLICY IF EXISTS att_modify_staff ON public.attendance;
CREATE POLICY att_modify_staff ON public.attendance
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());


-- 4. RPC: get_attendance_for_date — list students with their attendance status for a date
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_attendance_for_date(
  p_date date,
  p_classroom text DEFAULT NULL,
  p_grade text DEFAULT NULL
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
      a.line_send_status
    FROM public.students s
    LEFT JOIN public.attendance a
      ON a.student_id = s.id AND a.attendance_date = p_date
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
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_for_date TO authenticated;


-- 5. RPC: mark_attendance — single student
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_attendance(
  p_student_id uuid,
  p_date date,
  p_status text,
  p_check_in_at timestamptz DEFAULT NULL,
  p_check_out_at timestamptz DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_method text DEFAULT 'manual'
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

  -- Upsert
  INSERT INTO public.attendance (
    school_id, student_id, attendance_date,
    academic_year, grade, classroom,
    status, check_in_at, check_out_at, check_in_method,
    reason, notes, recorded_by
  ) VALUES (
    v_school_id, p_student_id, p_date,
    v_student.academic_year, v_student.grade, v_student.classroom,
    p_status,
    COALESCE(p_check_in_at, CASE WHEN p_status IN ('present','late','half_day_am') THEN now() ELSE NULL END),
    p_check_out_at,
    COALESCE(p_method, 'manual'),
    p_reason, p_notes, v_user_id
  )
  ON CONFLICT (student_id, attendance_date) DO UPDATE SET
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

GRANT EXECUTE ON FUNCTION public.mark_attendance TO authenticated;


-- 6. RPC: bulk_mark_attendance — mark many at once
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
      COALESCE(v_row->>'method', 'manual')
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

GRANT EXECUTE ON FUNCTION public.bulk_mark_attendance TO authenticated;


-- 7. RPC: get_attendance_stats — for a date or date range
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
    AND a.status IN ('present','half_day_am','half_day_pm')
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_absent
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'absent'
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_late
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'late'
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_excused
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'excused'
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_leave
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'leave'
    AND (p_classroom IS NULL OR s.classroom = p_classroom);

  SELECT COUNT(*) INTO v_sick
  FROM public.attendance a JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = v_school_id AND a.attendance_date = p_date AND a.status = 'sick'
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

GRANT EXECUTE ON FUNCTION public.get_attendance_stats TO authenticated;


-- 8. RPC: get_my_attendance — for student/parent view
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

  -- Fetch records
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.attendance_date DESC) INTO v_rows
  FROM (
    SELECT a.* FROM public.attendance a
    WHERE a.student_id = v_target_student
      AND a.attendance_date BETWEEN p_from AND p_to
    ORDER BY a.attendance_date DESC
  ) t;

  -- Summary counts
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
    AND attendance_date BETWEEN p_from AND p_to;

  RETURN jsonb_build_object(
    'student_id', v_target_student,
    'from', p_from,
    'to', p_to,
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'summary', v_summary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_attendance TO authenticated;


-- 9. RPC: update_line_send_status — for /api/line/notify callback
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_line_send_status(
  p_attendance_id uuid,
  p_status text,
  p_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.attendance SET
    line_send_status = p_status,
    line_sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE line_sent_at END,
    line_message_id = COALESCE(p_message_id, line_message_id),
    line_error = p_error
  WHERE id = p_attendance_id
    AND school_id = public.current_school_id();

  RETURN jsonb_build_object('success', FOUND);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_line_send_status TO authenticated;


-- 10. Add LINE settings columns to schools (for per-school LINE OA setup)
-- ============================================================================
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS line_settings jsonb DEFAULT '{}'::jsonb;
-- Expected shape:
-- {
--   "channel_access_token": "...",   -- LINE Official Account Messaging API token
--   "channel_id": "...",
--   "channel_secret": "...",
--   "enabled": true,
--   "default_message_template": "นักเรียน {student_name} {action} เวลา {time}"
-- }
COMMENT ON COLUMN public.schools.line_settings IS 'Per-school LINE Messaging API configuration (Sprint 12)';


-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.get_attendance_stats(CURRENT_DATE);
-- SELECT public.get_attendance_for_date(CURRENT_DATE);
