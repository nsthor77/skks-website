-- ============================================================================
-- Pricing update → 1,990 / 3,990 / 6,990 บาท/เดือน (yearly = 20% off)
-- ----------------------------------------------------------------------------
-- The marketing site + upgrade popup already show the new prices. This updates
-- get_plan_amount_satang() — the function the Omise auto-charge schedule uses —
-- so the amount actually charged matches what customers see.
--   starter : 1,990/mo · 19,104/yr   →   199,000 / 1,910,400 satang
--   pro     : 3,990/mo · 38,304/yr   →   399,000 / 3,830,400 satang
--   premium : 6,990/mo · 67,104/yr   →   699,000 / 6,710,400 satang
-- Existing Omise schedules keep their old amount (all current schools are comp,
-- so none are affected). New signups / plan changes use the new prices.
-- Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_plan_amount_satang(text, text);

CREATE OR REPLACE FUNCTION public.get_plan_amount_satang(p_plan_id text, p_billing_cycle text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE lower(coalesce(p_plan_id, ''))
    WHEN 'starter' THEN CASE WHEN lower(coalesce(p_billing_cycle,'monthly')) = 'yearly' THEN 1910400 ELSE 199000 END
    WHEN 'pro'     THEN CASE WHEN lower(coalesce(p_billing_cycle,'monthly')) = 'yearly' THEN 3830400 ELSE 399000 END
    WHEN 'premium' THEN CASE WHEN lower(coalesce(p_billing_cycle,'monthly')) = 'yearly' THEN 6710400 ELSE 699000 END
    ELSE NULL
  END;
END $$;

GRANT EXECUTE ON FUNCTION public.get_plan_amount_satang(text, text) TO authenticated, service_role;

-- Verify:
--   SELECT public.get_plan_amount_satang('pro', 'monthly');   -- 399000
--   SELECT public.get_plan_amount_satang('starter', 'yearly');-- 1910400
