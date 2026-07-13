-- ============================================================================
-- Sprint Tier 3: ถังขยะนักเรียน (Recycle Bin, 30-day restore) — STUDENTS only
-- ============================================================================
-- Soft-delete: status='deleted' + deleted_at/deleted_by/prev_status.
-- Lazy purge inside get_trash(): rows older than 30 days are hard-deleted.
-- Idempotent: safe to run multiple times.
-- Created: 2026-07-13
--
-- NOTE on permissions:
--   is_staff_or_higher() on prod INCLUDES 'teacher' (sprint-roles-4tier).
--   Trash actions are ADMIN-tier (staff+), so these RPCs check the role
--   list explicitly: ('staff','admin','owner','developer') — same pattern
--   as bulk_insert_students. purge_student uses is_owner_or_higher().
-- ============================================================================


-- 1. Columns
-- ============================================================================
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_by  uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS prev_status text;

-- Partial index for the trash list + lazy purge
CREATE INDEX IF NOT EXISTS students_trash_idx
  ON public.students (school_id, deleted_at)
  WHERE status = 'deleted';


-- 2. If a CHECK constraint restricts students.status, extend it with 'deleted'
-- ============================================================================
-- No status CHECK exists in the repo's sprint files, but prod may have one.
-- This finds any CHECK on public.students that mentions status (and not the
-- gender check), and — if it doesn't already allow 'deleted' — rebuilds it
-- with 'deleted' injected. Handles the normalized `= ANY (ARRAY[...])` form
-- that Postgres produces for `status IN (...)`. Safe no-op on re-run.
DO $$
DECLARE
  v_con record;
  v_def text;
BEGIN
  FOR v_con IN
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.conrelid = 'public.students'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%deleted%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%gender%'
  LOOP
    -- Only rebuild the form we can safely rewrite; otherwise leave untouched.
    IF position('ARRAY[' IN v_con.def) > 0 THEN
      v_def := replace(v_con.def, 'ARRAY[', 'ARRAY[''deleted''::text, ');
      EXECUTE format('ALTER TABLE public.students DROP CONSTRAINT %I', v_con.conname);
      EXECUTE format('ALTER TABLE public.students ADD CONSTRAINT %I %s', v_con.conname, v_def);
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL; -- never block the migration on constraint juggling
END$$;


-- 3. RPC: trash_student — move a student to the recycle bin (staff+)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trash_student(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_school_id uuid;
  v_status text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('staff','admin','owner','developer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'คุณไม่มีสิทธิ์');
  END IF;

  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียนของคุณ');
  END IF;

  SELECT status INTO v_status
  FROM public.students
  WHERE id = p_id AND school_id = v_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบนักเรียนคนนี้ในโรงเรียนของคุณ');
  END IF;

  IF v_status = 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'นักเรียนคนนี้อยู่ในถังขยะแล้ว');
  END IF;

  BEGIN
    UPDATE public.students
    SET prev_status = status,
        status      = 'deleted',
        deleted_at  = now(),
        deleted_by  = auth.uid()
    WHERE id = p_id AND school_id = v_school_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'ย้ายไปถังขยะไม่สำเร็จ: ' || SQLERRM);
  END;

  RETURN jsonb_build_object('success', true, 'message', 'ย้ายไปถังขยะแล้ว กู้คืนได้ภายใน 30 วัน');
END;
$$;

GRANT EXECUTE ON FUNCTION public.trash_student(uuid) TO authenticated;


-- 4. RPC: restore_student — restore from the recycle bin (staff+)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.restore_student(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_school_id uuid;
  v_status text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('staff','admin','owner','developer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'คุณไม่มีสิทธิ์');
  END IF;

  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียนของคุณ');
  END IF;

  SELECT status INTO v_status
  FROM public.students
  WHERE id = p_id AND school_id = v_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบนักเรียนคนนี้ในโรงเรียนของคุณ');
  END IF;

  IF v_status IS DISTINCT FROM 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'นักเรียนคนนี้ไม่ได้อยู่ในถังขยะ');
  END IF;

  BEGIN
    UPDATE public.students
    SET status      = COALESCE(prev_status, 'active'),
        deleted_at  = NULL,
        deleted_by  = NULL,
        prev_status = NULL
    WHERE id = p_id AND school_id = v_school_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'กู้คืนไม่สำเร็จ: ' || SQLERRM);
  END;

  RETURN jsonb_build_object('success', true, 'message', 'กู้คืนนักเรียนเรียบร้อยแล้ว');
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_student(uuid) TO authenticated;


-- 5. RPC: get_trash — list recycle bin + lazy purge of rows older than 30 days
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_trash()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_school_id uuid;
  v_rows jsonb;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('staff','admin','owner','developer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'คุณไม่มีสิทธิ์');
  END IF;

  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียนของคุณ');
  END IF;

  -- Lazy purge: hard-delete anything in this school's trash older than 30 days.
  -- Wrapped so a FK RESTRICT on one row never breaks the listing.
  BEGIN
    DELETE FROM public.students
    WHERE school_id = v_school_id
      AND status = 'deleted'
      AND deleted_at < now() - interval '30 days';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      s.id,
      s.student_number,
      COALESCE(
        NULLIF(trim(COALESCE(s.first_name_th,'') || ' ' || COALESCE(s.last_name_th,'')), ''),
        NULLIF(trim(COALESCE(s.first_name_en,'') || ' ' || COALESCE(s.last_name_en,'')), ''),
        '—'
      ) AS name,
      s.classroom,
      s.grade,
      s.deleted_at,
      GREATEST(0, 30 - EXTRACT(DAY FROM (now() - COALESCE(s.deleted_at, now())))::int) AS days_left,
      COALESCE(pr.display_name, '—') AS deleted_by_name
    FROM public.students s
    LEFT JOIN public.profiles pr ON pr.id = s.deleted_by
    WHERE s.school_id = v_school_id
      AND s.status = 'deleted'
    ORDER BY s.deleted_at DESC NULLS LAST
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trash() TO authenticated;


-- 6. RPC: purge_student — permanent delete, OWNER ONLY (owner/developer)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.purge_student(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_status text;
  v_number text;
BEGIN
  IF NOT public.is_owner_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'เฉพาะเจ้าของโรงเรียนเท่านั้น');
  END IF;

  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียนของคุณ');
  END IF;

  SELECT status, student_number INTO v_status, v_number
  FROM public.students
  WHERE id = p_id AND school_id = v_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบนักเรียนคนนี้ในโรงเรียนของคุณ');
  END IF;

  -- Safety: only rows already in the trash can be purged.
  IF v_status IS DISTINCT FROM 'deleted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ต้องย้ายไปถังขยะก่อน จึงจะลบถาวรได้');
  END IF;

  BEGIN
    DELETE FROM public.students
    WHERE id = p_id AND school_id = v_school_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'ลบถาวรไม่สำเร็จ: ' || SQLERRM);
  END;

  -- Audit (best-effort)
  BEGIN
    INSERT INTO public.audit_logs (action, metadata)
    VALUES ('students.purge', jsonb_build_object(
      'school_id', v_school_id,
      'student_id', p_id,
      'student_number', v_number,
      'purged_by', auth.uid()
    ));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'message', 'ลบถาวรเรียบร้อยแล้ว');
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_student(uuid) TO authenticated;


-- 7. PATCH: get_students_paginated — hide status='deleted' unless explicitly
--    requested with p_status = 'deleted'. Signature unchanged (sprint-10).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_students_paginated(
  p_search text DEFAULT NULL,
  p_program text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_total int;
  v_rows jsonb;
BEGIN
  -- Get current user's school
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_school');
  END IF;

  -- Count total matching (trash excluded unless p_status = 'deleted')
  SELECT COUNT(*) INTO v_total
  FROM public.students s
  WHERE s.school_id = v_school_id
    AND (CASE WHEN p_status IS NULL THEN s.status IS DISTINCT FROM 'deleted'
              ELSE s.status = p_status END)
    AND (p_program IS NULL OR s.program = p_program)
    AND (p_grade IS NULL OR s.grade ILIKE '%' || p_grade || '%')
    AND (p_classroom IS NULL OR s.classroom ILIKE '%' || p_classroom || '%')
    AND (p_search IS NULL OR p_search = '' OR (
      COALESCE(s.first_name_th,'') || ' ' ||
      COALESCE(s.last_name_th,'') || ' ' ||
      COALESCE(s.first_name_en,'') || ' ' ||
      COALESCE(s.last_name_en,'') || ' ' ||
      COALESCE(s.nickname,'') || ' ' ||
      COALESCE(s.student_number,'')
    ) ILIKE '%' || p_search || '%');

  -- Fetch page (trash excluded unless p_status = 'deleted')
  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT s.*
    FROM public.students s
    WHERE s.school_id = v_school_id
      AND (CASE WHEN p_status IS NULL THEN s.status IS DISTINCT FROM 'deleted'
                ELSE s.status = p_status END)
      AND (p_program IS NULL OR s.program = p_program)
      AND (p_grade IS NULL OR s.grade ILIKE '%' || p_grade || '%')
      AND (p_classroom IS NULL OR s.classroom ILIKE '%' || p_classroom || '%')
      AND (p_search IS NULL OR p_search = '' OR (
        COALESCE(s.first_name_th,'') || ' ' ||
        COALESCE(s.last_name_th,'') || ' ' ||
        COALESCE(s.first_name_en,'') || ' ' ||
        COALESCE(s.last_name_en,'') || ' ' ||
        COALESCE(s.nickname,'') || ' ' ||
        COALESCE(s.student_number,'')
      ) ILIKE '%' || p_search || '%')
    ORDER BY s.classroom NULLS LAST, s.student_number NULLS LAST, s.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_students_paginated TO authenticated;


-- ============================================================================
-- Verify (run manually after applying)
-- ============================================================================
-- 1) Columns exist:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='students'
--      AND column_name IN ('deleted_at','deleted_by','prev_status');
-- 2) Status CHECK (if any) now allows 'deleted':
--    SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='public.students'::regclass AND contype='c';
-- 3) Round trip (replace <uuid> with a test student id):
--    SELECT public.trash_student('<uuid>');
--    SELECT public.get_trash();
--    SELECT public.restore_student('<uuid>');
-- 4) Deleted students are hidden from the normal list:
--    SELECT public.get_students_paginated(NULL,NULL,NULL,NULL,NULL,10,0);       -- no 'deleted'
--    SELECT public.get_students_paginated(NULL,NULL,NULL,NULL,'deleted',10,0);  -- trash only
-- 5) Purge guard (as non-owner should refuse):
--    SELECT public.purge_student('<uuid>');

-- ============================================================================
-- Leak fixes: keep trashed students out of stats, search, and the plan cap
-- (these re-emit existing functions — supersede sprint-10 / tier2 / cap-server)
-- ============================================================================

-- get_students_stats: 'total' no longer counts trashed students
CREATE OR REPLACE FUNCTION public.get_students_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  v_total int; v_active int; v_inactive int; v_graduated int; v_male int; v_female int;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('error', 'no_school'); END IF;

  SELECT COUNT(*) INTO v_total FROM public.students
    WHERE school_id = v_school_id AND status IS DISTINCT FROM 'deleted';
  SELECT COUNT(*) INTO v_active FROM public.students WHERE school_id = v_school_id AND status = 'active';
  SELECT COUNT(*) INTO v_inactive FROM public.students WHERE school_id = v_school_id AND status = 'inactive';
  SELECT COUNT(*) INTO v_graduated FROM public.students WHERE school_id = v_school_id AND status = 'graduated';
  SELECT COUNT(*) INTO v_male FROM public.students WHERE school_id = v_school_id AND gender = 'male' AND status = 'active';
  SELECT COUNT(*) INTO v_female FROM public.students WHERE school_id = v_school_id AND gender = 'female' AND status = 'active';

  RETURN jsonb_build_object(
    'total', v_total, 'active', v_active, 'inactive', v_inactive,
    'graduated', v_graduated, 'male', v_male, 'female', v_female
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_students_stats TO authenticated;

-- global_search: trashed students no longer appear in results
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
      'type', 'student', 'id', s.id,
      'title', coalesce(s.first_name_th,s.first_name_en,'') || ' ' || coalesce(s.last_name_th,s.last_name_en,''),
      'subtitle', coalesce(s.student_number,'') ||
        CASE WHEN s.classroom IS NOT NULL THEN ' · ' || s.classroom ELSE '' END,
      'href', 'student-detail.html?id=' || s.id
    ) AS x
    FROM public.students s
    WHERE s.school_id = sid
      AND s.status IS DISTINCT FROM 'deleted'
      AND (
        s.first_name_th ILIKE '%'||q||'%' OR s.last_name_th ILIKE '%'||q||'%'
        OR s.first_name_en ILIKE '%'||q||'%' OR s.last_name_en ILIKE '%'||q||'%'
        OR s.nickname ILIKE '%'||q||'%' OR s.student_number ILIKE '%'||q||'%'
      )
    ORDER BY s.student_number NULLS LAST LIMIT 8
  ) t;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_teachers FROM (
    SELECT jsonb_build_object(
      'type', 'teacher', 'id', te.id,
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

-- plan cap: trashed students no longer consume the 150/800 seat limit
CREATE OR REPLACE FUNCTION public.enforce_student_plan_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan text; v_cap int; v_count int;
BEGIN
  IF NEW.school_id IS NULL THEN RETURN NEW; END IF;

  SELECT lower(coalesce(plan, 'premium')) INTO v_plan
  FROM public.schools WHERE id = NEW.school_id;

  v_cap := CASE v_plan WHEN 'starter' THEN 150 WHEN 'pro' THEN 800 ELSE NULL END;
  IF v_cap IS NULL THEN RETURN NEW; END IF;  -- premium/unknown → unlimited

  SELECT count(*) INTO v_count FROM public.students
    WHERE school_id = NEW.school_id AND status IS DISTINCT FROM 'deleted';
  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'ถึงขีดจำกัดแพกเกจแล้ว (% คน) — อัปเกรดแพกเกจเพื่อเพิ่มนักเรียนได้มากขึ้น', v_cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
