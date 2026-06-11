-- ============================================================================
-- Server-side student cap per plan (Starter 150 / Pro 800 / Premium unlimited)
-- ----------------------------------------------------------------------------
-- The client already blocks adding/importing students past the package limit
-- (students.html + smart-import.js), but that is UI-level only. This trigger
-- enforces the same cap AT THE DATABASE, so even a direct API/RPC call cannot
-- exceed it.
--
-- Behavior:
--  - BEFORE INSERT on public.students: look up the school's plan and count its
--    current students; if at/over the cap → raise a Thai-language error.
--  - bulk_insert_students already wraps each row in BEGIN/EXCEPTION, so an
--    over-cap import reports the remaining rows as per-row errors instead of
--    aborting the whole batch (matches the client message).
--  - FAIL-OPEN: plan NULL/unknown → treated as premium (unlimited). Existing
--    schools were backfilled to 'premium', so nothing currently live is locked.
--  - UPDATEs are not affected (editing an existing student always works).
-- Idempotent & safe to re-run. Run on prod "School Kit".
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_student_plan_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_plan text; v_cap int; v_count int;
BEGIN
  IF NEW.school_id IS NULL THEN RETURN NEW; END IF;

  SELECT lower(coalesce(plan, 'premium')) INTO v_plan
  FROM public.schools WHERE id = NEW.school_id;

  v_cap := CASE v_plan WHEN 'starter' THEN 150 WHEN 'pro' THEN 800 ELSE NULL END;
  IF v_cap IS NULL THEN RETURN NEW; END IF;  -- premium/unknown → unlimited

  SELECT count(*) INTO v_count FROM public.students WHERE school_id = NEW.school_id;
  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'ถึงขีดจำกัดแพกเกจแล้ว (% คน) — อัปเกรดแพกเกจเพื่อเพิ่มนักเรียนได้มากขึ้น', v_cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS students_plan_cap ON public.students;
CREATE TRIGGER students_plan_cap
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_plan_cap();

-- Verify:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.students'::regclass AND tgname = 'students_plan_cap';
