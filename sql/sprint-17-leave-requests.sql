-- ============================================================================
-- Sprint 17: Leave Requests (ระบบขอลาออนไลน์)
-- ============================================================================
-- Parent/student submits a leave request → staff approve/reject.
-- On approve → auto-mark attendance 'leave' for each date in range.
-- Created: 2026-05-28
-- ============================================================================

-- 1. Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  leave_type text NOT NULL DEFAULT 'sick',   -- sick / personal / activity / other
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  attachment_url text,                        -- doctor note / evidence

  status text NOT NULL DEFAULT 'pending',     -- pending / approved / rejected
  review_note text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensive ADD COLUMN
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS leave_type text DEFAULT 'sick';
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS lr_school_status_idx ON public.leave_requests (school_id, status, start_date);
CREATE INDEX IF NOT EXISTS lr_student_idx ON public.leave_requests (student_id, start_date);

COMMENT ON TABLE public.leave_requests IS 'Sprint 17: student leave requests (parent submit → staff approve → marks attendance)';

-- 2. Trigger updated_at
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'lr_set_updated_at') THEN
    CREATE TRIGGER lr_set_updated_at BEFORE UPDATE ON public.leave_requests
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 3. RLS
-- ============================================================================
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lr_select_staff ON public.leave_requests;
CREATE POLICY lr_select_staff ON public.leave_requests
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS lr_select_own ON public.leave_requests;
CREATE POLICY lr_select_own ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND (
      student_id = ANY(public.my_student_ids())
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = leave_requests.student_id AND s.profile_id = auth.uid())
      OR requested_by = auth.uid()
    )
  );

-- parent/student can INSERT for their own children; staff can do anything
DROP POLICY IF EXISTS lr_insert_own ON public.leave_requests;
CREATE POLICY lr_insert_own ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.current_school_id()
    AND (
      public.is_staff_or_higher()
      OR student_id = ANY(public.my_student_ids())
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = leave_requests.student_id AND s.profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS lr_modify_staff ON public.leave_requests;
CREATE POLICY lr_modify_staff ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- 4. RPC: submit_leave_request
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_leave_request(
  p_student_id uuid,
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text DEFAULT NULL,
  p_attachment_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_can boolean;
  v_id uuid;
BEGIN
  v_user_id := auth.uid();
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_school'); END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_dates');
  END IF;

  v_can := public.is_staff_or_higher()
    OR p_student_id = ANY(public.my_student_ids())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = p_student_id AND s.profile_id = v_user_id);
  IF NOT v_can THEN RETURN jsonb_build_object('success', false, 'error', 'no_access'); END IF;

  INSERT INTO public.leave_requests (school_id, student_id, requested_by, leave_type, start_date, end_date, reason, attachment_url, status)
  VALUES (v_school_id, p_student_id, v_user_id, COALESCE(p_leave_type,'sick'), p_start_date, p_end_date, p_reason, p_attachment_url, 'pending')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_leave_request TO authenticated;

-- 5. RPC: get_leave_requests (role-aware)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_leave_requests(
  p_status text DEFAULT NULL,
  p_student_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC) INTO v_rows
  FROM (
    SELECT lr.*,
           s.student_number, s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en,
           s.nickname, s.classroom, s.grade
    FROM public.leave_requests lr
    JOIN public.students s ON s.id = lr.student_id
    WHERE lr.school_id = v_school_id
      AND (p_status IS NULL OR lr.status = p_status)
      AND (p_student_id IS NULL OR lr.student_id = p_student_id)
      AND (
        public.is_staff_or_higher()
        OR lr.student_id = ANY(public.my_student_ids())
        OR EXISTS (SELECT 1 FROM public.students s2 WHERE s2.id = lr.student_id AND s2.profile_id = auth.uid())
        OR lr.requested_by = auth.uid()
      )
    ORDER BY lr.created_at DESC
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_leave_requests TO authenticated;

-- 6. RPC: review_leave_request — approve/reject (staff) + auto-mark attendance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.review_leave_request(
  p_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_lr RECORD;
  v_student RECORD;
  v_d date;
  v_marked int := 0;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();

  SELECT * INTO v_lr FROM public.leave_requests WHERE id = p_id AND school_id = v_school_id;
  IF v_lr.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;

  UPDATE public.leave_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      review_note = p_note,
      reviewed_by = v_user_id,
      reviewed_at = now()
  WHERE id = p_id;

  -- On approve → mark attendance 'leave' for each date in range (best-effort)
  IF p_approve THEN
    SELECT id, classroom, grade, academic_year INTO v_student
    FROM public.students WHERE id = v_lr.student_id;

    v_d := v_lr.start_date;
    WHILE v_d <= v_lr.end_date LOOP
      BEGIN
        INSERT INTO public.attendance (school_id, student_id, attendance_date, status, classroom, grade, reason, recorded_by)
        VALUES (v_school_id, v_lr.student_id, v_d, 'leave', v_student.classroom, v_student.grade,
                COALESCE(v_lr.reason, 'Approved leave'), v_user_id)
        ON CONFLICT (student_id, attendance_date) DO UPDATE SET
          status = 'leave',
          reason = COALESCE(EXCLUDED.reason, attendance.reason);
        v_marked := v_marked + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- skip a date that fails, keep going
      END;
      v_d := v_d + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, 'attendance_marked', v_marked);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_leave_request TO authenticated;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.submit_leave_request('<student>','sick','2569-06-01','2569-06-02','ไข้หวัด',NULL);
-- SELECT public.get_leave_requests('pending', NULL);
-- SELECT public.review_leave_request('<id>', true, 'อนุมัติ');
