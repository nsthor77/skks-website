-- ============================================================================
-- Roles: 4-tier staff model  (owner > admin > teacher > student/parent)
-- ============================================================================
-- Goal:
--   owner   = everything incl. finance            (DB role: 'owner' / 'developer')
--   admin   = manages whole site EXCEPT finance    (DB role: 'staff'  ← labelled "Admin" in UI)
--   teacher = teaching only (attendance/grades/homework/leave/schedule)  (DB role: 'teacher'  ← NEW)
--   student / parent = own data
--
-- We KEEP the existing 'staff' value (= Admin) so current users need no migration,
-- and ADD a new 'teacher' value.
--
-- ⚠️ SECURITY-SENSITIVE. Run section 0 FIRST and check the output before section 2.
-- Run in Supabase → SQL Editor. (Staging first if you have one.)
-- Created: 2026-05-28
-- ============================================================================


-- ── SECTION 0 — DIAGNOSTIC (run this alone first, read the results) ──────────
-- 0a) Current definition of is_staff_or_higher (we will extend it in section 2):
SELECT pg_get_functiondef('public.is_staff_or_higher()'::regprocedure) AS current_is_staff_or_higher;

-- 0b) What kind of column is profiles.role? (text vs enum)
SELECT data_type, udt_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles' AND column_name='role';

-- 0c) Any CHECK constraint restricting role values?
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid='public.profiles'::regclass AND contype='c';

-- → If 0b shows udt_name like 'user_role' (USER-DEFINED / enum)  → do SECTION 1A.
-- → If 0b shows 'text' and 0c shows a CHECK listing roles        → do SECTION 1B.
-- → If 0b shows 'text' and 0c shows NO role check                → skip section 1 entirely.


-- ── SECTION 1A — only if role is an ENUM type ───────────────────────────────
-- Replace <ENUM_NAME> with the udt_name from 0b (e.g. user_role).
-- (ADD VALUE cannot run inside a transaction block — run this line by itself.)
--
--   ALTER TYPE public.<ENUM_NAME> ADD VALUE IF NOT EXISTS 'teacher';


-- ── SECTION 1B — only if role is TEXT with a CHECK constraint ────────────────
-- Replace <CONNAME> + the value list with what 0c returned, adding 'teacher'.
--
--   ALTER TABLE public.profiles DROP CONSTRAINT <CONNAME>;
--   ALTER TABLE public.profiles ADD CONSTRAINT <CONNAME>
--     CHECK (role IN ('student','parent','teacher','staff','owner','developer'));


-- ── SECTION 2 — let teachers use teaching RPCs ──────────────────────────────
-- Teaching RPCs (attendance / grades / homework / leave / schedule) gate on
-- is_staff_or_higher(). Extend it to include 'teacher'.
-- ✅ Safe to run IF section 0a showed the standard "role IN (...) from profiles" body.
--    If your body is different, tell Claude the 0a output before running.
CREATE OR REPLACE FUNCTION public.is_staff_or_higher()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('teacher','staff','owner','developer')
  );
$$;

-- Helper used by future finance hardening (admin/teacher must NOT touch money).
CREATE OR REPLACE FUNCTION public.is_owner_or_higher()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('owner','developer')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_or_higher  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_or_higher  TO authenticated;


-- ── SECTION 3 — (LATER / optional) lock finance RPCs to owner only ──────────
-- Right now finance pages are blocked for admin/teacher at the PAGE level
-- (role-guard requireOwner). For full server-side enforcement, change finance
-- RPCs to gate on is_owner_or_higher() instead of is_staff_or_higher().
-- Do this in a follow-up once we list every finance RPC. (Ask Claude.)


-- ── VERIFY ──────────────────────────────────────────────────────────────────
-- Make a test teacher:  UPDATE public.profiles SET role='teacher' WHERE email='...';
-- Then log in as them → should reach attendance/grades/homework, NOT finance.
