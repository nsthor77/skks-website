-- ============================================================================
-- Phase 3: Lock FINANCE to owner-only at the DB level (server-side)
-- ============================================================================
-- Today: admin/teacher are blocked from finance at the PAGE level (role-guard
-- requireOwner) + sidebar hides the menu. But finance RPCs/RLS in the base
-- schema gate on is_staff_or_higher() — which now also includes 'teacher'.
-- So server-side, an admin/teacher could still call a finance RPC directly.
--
-- These finance functions/policies are NOT in the git repo (they were created
-- directly in the DB), so we must FIND them first, then flip each from
-- is_staff_or_higher() → is_owner_or_higher().
--
-- STEP 1: run the DIAGNOSTIC below and paste the results back to Claude.
-- STEP 2: Claude returns the exact CREATE OR REPLACE / ALTER POLICY statements.
-- ============================================================================


-- ── PREREQ — make sure is_owner_or_higher() exists (from sprint-roles-4tier) ──
CREATE OR REPLACE FUNCTION public.is_owner_or_higher()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner','developer'));
$$;
GRANT EXECUTE ON FUNCTION public.is_owner_or_higher TO authenticated;


-- ── DIAGNOSTIC 1 — finance RPCs that gate on is_staff_or_higher ─────────────
-- (functions whose body mentions money tables AND the staff check)
SELECT p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%is_staff_or_higher%'
  AND (
       pg_get_functiondef(p.oid) ILIKE '%payment%'
    OR pg_get_functiondef(p.oid) ILIKE '%tuition%'
    OR pg_get_functiondef(p.oid) ILIKE '%invoice%'
    OR pg_get_functiondef(p.oid) ILIKE '% bill%'
    OR pg_get_functiondef(p.oid) ILIKE '%finance%'
  )
ORDER BY 1;

-- ── DIAGNOSTIC 2 — RLS policies on finance tables ───────────────────────────
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename ~* '(payment|tuition|invoice|bill|finance)'
ORDER BY tablename, policyname;

-- ── DIAGNOSTIC 3 — list finance tables that have RLS enabled ────────────────
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
  AND c.relname ~* '(payment|tuition|invoice|bill|finance)'
ORDER BY 1;


-- ── TEMPLATE (Claude will fill in real names after diagnostics) ─────────────
-- For each finance RPC, replace the staff check with the owner check:
--   CREATE OR REPLACE FUNCTION public.<finance_fn>(...) ... AS $$
--     ... IF NOT public.is_owner_or_higher() THEN RETURN ...'forbidden'; END IF; ...
--   $$;
--
-- For each finance RLS write policy:
--   ALTER POLICY <policyname> ON public.<table>
--     USING (school_id = public.current_school_id() AND public.is_owner_or_higher())
--     WITH CHECK (school_id = public.current_school_id() AND public.is_owner_or_higher());
--
-- NOTE: parents/students still need to READ their own bills — keep their
-- existing "own row" SELECT policies untouched; only tighten staff-write paths.
