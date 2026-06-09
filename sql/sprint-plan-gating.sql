-- ============================================================================
-- Plan-based Feature Gating
-- ----------------------------------------------------------------------------
-- Adds schools.plan (starter|pro|premium) + get_my_plan() so the app can show
-- which features a school's package includes. The UI locks over-tier features
-- with an "upgrade" badge (it does not hard-delete data).
--
-- SAFE ROLLOUT: every EXISTING school is backfilled to 'premium' so nothing
-- currently live (SKKS, comp/trial demos) loses any feature. New paying schools
-- get their tier set explicitly (admin/create-school) or fall back to their
-- subscription plan_id. Unknown/missing → 'premium' (fail-open, never wrongly
-- locks a customer). Idempotent & safe to re-run.
-- ============================================================================

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS plan text;

-- one-time safe backfill (only fills NULLs → re-run won't downgrade anyone)
UPDATE public.schools SET plan = 'premium' WHERE plan IS NULL;

CREATE OR REPLACE FUNCTION public.get_my_plan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_school uuid; v_plan text;
BEGIN
  v_school := public.current_school_id();
  IF v_school IS NULL THEN RETURN jsonb_build_object('plan', 'premium'); END IF;

  SELECT plan INTO v_plan FROM public.schools WHERE id = v_school;

  -- fall back to the latest subscription's plan_id if schools.plan not set
  IF v_plan IS NULL OR v_plan = '' THEN
    BEGIN
      SELECT lower(plan_id) INTO v_plan
      FROM public.subscriptions WHERE school_id = v_school
      ORDER BY created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_plan := NULL; END;
  END IF;

  IF v_plan NOT IN ('starter', 'pro', 'premium') THEN v_plan := 'premium'; END IF;
  RETURN jsonb_build_object('plan', v_plan);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('plan', 'premium');
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_plan() TO authenticated;

-- Verify:
--   SELECT public.get_my_plan();
--   SELECT slug, plan FROM public.schools ORDER BY created_at DESC LIMIT 10;
