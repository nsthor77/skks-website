-- ============================================================================
-- Sprint 7.D — Grace Period + Suspend Flow
-- ============================================================================
-- Flow:
--   1. charge.failed → status='past_due', updated_at = NOW()
--   2. After 2 days past_due → send WARNING email (once)
--   3. After 7 days past_due → status='suspended' + send SUSPENDED email
--   4. User adds new card → webhook reactivates to 'active'
--
-- Run this once in Supabase SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add warning_sent_at column to subscriptions (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS warning_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN subscriptions.warning_sent_at IS
  'When suspend-warning email was sent (NULL if not sent). Cleared on recovery.';

-- ---------------------------------------------------------------------------
-- 2. RPC: find_subscriptions_needing_warning
-- ---------------------------------------------------------------------------
-- Find subscriptions that are 2+ days past_due AND haven't received warning email yet.
-- Cron will call this daily and send warning emails for any rows returned.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_subscriptions_needing_warning(
  p_min_days INTEGER DEFAULT 2,
  p_grace_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  subscription_id UUID,
  school_id UUID,
  school_name TEXT,
  school_slug TEXT,
  contact_email TEXT,
  custom_domain TEXT,
  plan_id TEXT,
  past_due_since TIMESTAMPTZ,
  days_until_suspend INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS subscription_id,
    sch.id AS school_id,
    sch.name AS school_name,
    sch.slug AS school_slug,
    sch.contact_email,
    sch.custom_domain,
    s.plan_id::TEXT,
    s.updated_at AS past_due_since,
    GREATEST(0, p_grace_days - EXTRACT(DAY FROM NOW() - s.updated_at)::INTEGER) AS days_until_suspend
  FROM subscriptions s
  JOIN schools sch ON sch.id = s.school_id
  WHERE s.status = 'past_due'
    AND s.updated_at < NOW() - (p_min_days || ' days')::INTERVAL
    AND s.warning_sent_at IS NULL
    AND sch.status != 'suspended'
    AND sch.status != 'cancelled';
END;
$$;

COMMENT ON FUNCTION find_subscriptions_needing_warning IS
  'Returns subscriptions that are past_due for p_min_days+ days and need a warning email. Cron job uses this.';

-- ---------------------------------------------------------------------------
-- 3. RPC: mark_warning_sent
-- ---------------------------------------------------------------------------
-- Called by cron after warning email is successfully sent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_warning_sent(p_subscription_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE subscriptions
  SET warning_sent_at = NOW()
  WHERE id = p_subscription_id;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC: check_past_due_subscriptions (the BIG one)
-- ---------------------------------------------------------------------------
-- Finds subscriptions past_due > grace_days AND suspends them.
-- Returns list of newly-suspended schools (for cron to send emails).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_past_due_subscriptions(
  p_grace_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  subscription_id UUID,
  school_id UUID,
  school_name TEXT,
  school_slug TEXT,
  contact_email TEXT,
  custom_domain TEXT,
  plan_id TEXT,
  past_due_since TIMESTAMPTZ,
  days_past_due INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  -- Find candidates first
  FOR v_sub IN
    SELECT
      s.id AS sub_id,
      sch.id AS school_id,
      sch.name AS school_name,
      sch.slug AS school_slug,
      sch.contact_email,
      sch.custom_domain,
      s.plan_id::TEXT AS plan_id,
      s.updated_at AS past_due_since,
      EXTRACT(DAY FROM NOW() - s.updated_at)::INTEGER AS days_past_due
    FROM subscriptions s
    JOIN schools sch ON sch.id = s.school_id
    WHERE s.status = 'past_due'
      AND s.updated_at < NOW() - (p_grace_days || ' days')::INTERVAL
      AND sch.status NOT IN ('suspended', 'cancelled')
  LOOP
    -- Suspend the subscription
    UPDATE subscriptions
    SET status = 'suspended',
        updated_at = NOW()
    WHERE id = v_sub.sub_id;

    -- Suspend the school
    UPDATE schools
    SET status = 'suspended',
        suspended_at = NOW()
    WHERE id = v_sub.school_id;

    -- Log the suspension
    INSERT INTO audit_logs (school_id, event_type, event_data, created_at)
    VALUES (
      v_sub.school_id,
      'subscription.auto_suspended',
      jsonb_build_object(
        'subscription_id', v_sub.sub_id,
        'past_due_since', v_sub.past_due_since,
        'days_past_due', v_sub.days_past_due,
        'reason', 'Past_due exceeded grace period of ' || p_grace_days || ' days'
      ),
      NOW()
    );

    -- Return this row to the caller
    subscription_id := v_sub.sub_id;
    school_id := v_sub.school_id;
    school_name := v_sub.school_name;
    school_slug := v_sub.school_slug;
    contact_email := v_sub.contact_email;
    custom_domain := v_sub.custom_domain;
    plan_id := v_sub.plan_id;
    past_due_since := v_sub.past_due_since;
    days_past_due := v_sub.days_past_due;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION check_past_due_subscriptions IS
  'Suspends subscriptions that have been past_due > p_grace_days days. Returns list of newly-suspended for email notification.';

-- ---------------------------------------------------------------------------
-- 5. Add suspended_at column to schools (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

COMMENT ON COLUMN schools.suspended_at IS
  'When school was auto-suspended due to non-payment. Cleared when reactivated.';

-- ---------------------------------------------------------------------------
-- 6. RPC: reactivate_subscription (for recovery flow)
-- ---------------------------------------------------------------------------
-- Called when a user adds a new card after suspension. Resets state.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reactivate_subscription(p_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  -- Find the subscription
  SELECT id INTO v_sub_id
  FROM subscriptions
  WHERE school_id = p_school_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No subscription found');
  END IF;

  -- Reactivate the subscription
  UPDATE subscriptions
  SET status = 'active',
      warning_sent_at = NULL,
      updated_at = NOW()
  WHERE id = v_sub_id;

  -- Reactivate the school
  UPDATE schools
  SET status = 'active',
      suspended_at = NULL
  WHERE id = p_school_id;

  -- Log
  INSERT INTO audit_logs (school_id, event_type, event_data, created_at)
  VALUES (p_school_id, 'subscription.reactivated',
          jsonb_build_object('subscription_id', v_sub_id), NOW());

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id
  );
END;
$$;

COMMENT ON FUNCTION reactivate_subscription IS
  'Reactivates a suspended subscription (e.g., after user adds new card). Resets warning_sent_at.';

-- ---------------------------------------------------------------------------
-- 7. Grant execute permission (so service role can call these)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION find_subscriptions_needing_warning(INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_warning_sent(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_past_due_subscriptions(INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reactivate_subscription(UUID) TO authenticated, service_role;

-- ============================================================================
-- DONE — Sprint 7.D SQL setup
-- ============================================================================
