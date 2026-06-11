-- ============================================================================
-- payment_settings — tenant isolation (CRITICAL before school #2 goes live)
-- ----------------------------------------------------------------------------
-- PROBLEM: payment_settings (the school's PromptPay / bank account for tuition)
-- had no school_id scoping in the app queries. With a 2nd school:
--   - parent-bills.html `.eq('active',true).single()` would ERROR (multiple
--     rows) or worse, show ANOTHER school's PromptPay QR → money to the wrong
--     bank account.
--   - payment-settings.html `.limit(1).single()` could read/overwrite another
--     school's account.
-- FIX (defense in depth): add school_id + backfill SKKS + tenant-scoped RLS.
-- The app pages are updated in the same commit to filter by school_id and to
-- create the row for new schools. Idempotent — safe to re-run.
-- ============================================================================

-- 1) school_id column + backfill existing (SKKS-era) rows ---------------------
ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

UPDATE public.payment_settings
SET school_id = (
  SELECT id FROM public.schools
  WHERE slug = 'skks' OR lower(coalesce(custom_domain, '')) LIKE '%suansonkk%'
  ORDER BY created_at LIMIT 1
)
WHERE school_id IS NULL;

CREATE INDEX IF NOT EXISTS payment_settings_school_idx ON public.payment_settings (school_id);

-- 2) RLS: drop whatever policies exist, recreate tenant-scoped ----------------
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'payment_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_settings', p.policyname);
  END LOOP;
END $$;

-- read: any signed-in member of the SAME school (parents need it for the QR)
CREATE POLICY ps_tenant_read ON public.payment_settings
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());

-- write: staff/admin/owner of the SAME school only
CREATE POLICY ps_tenant_write ON public.payment_settings
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id()
         AND public.current_user_role() IN ('staff','admin','owner','developer'))
  WITH CHECK (school_id = public.current_school_id()
              AND public.current_user_role() IN ('staff','admin','owner','developer'));

-- Verify:
--   SELECT school_id, bank_name, promptpay_id FROM public.payment_settings;
--   SELECT policyname FROM pg_policies WHERE tablename = 'payment_settings';
