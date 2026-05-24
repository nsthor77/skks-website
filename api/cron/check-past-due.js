// ==========================================================================
// /api/cron/check-past-due.js
// Daily cron job — checks for past_due subscriptions and:
//   1. Sends warning email (2+ days past_due, not yet warned)
//   2. Suspends subscriptions past_due > 7 days (configurable)
//   3. Sends suspension email
//
// Called by Vercel Cron daily (see vercel.json "crons" config).
//
// Security:
//   - Vercel Cron sends Authorization: Bearer <CRON_SECRET>
//   - We verify this matches process.env.CRON_SECRET to reject random callers
//
// Manual testing:
//   GET /api/cron/check-past-due?secret=<CRON_SECRET>
//   (passing via query param works for manual cURL tests too)
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, emailTemplates } = require('../../lib/email');

// Config (can be overridden via env vars)
const WARNING_DAYS = parseInt(process.env.PAST_DUE_WARNING_DAYS || '2', 10);
const GRACE_DAYS   = parseInt(process.env.PAST_DUE_GRACE_DAYS   || '7', 10);

module.exports = async (req, res) => {
  // ---- Auth: only allow Vercel Cron or manual call with secret ----
  const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const querySecret = req.query.secret || '';
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('[cron/check-past-due] CRON_SECRET not configured in env');
    return res.status(500).json({ error: 'Cron secret not configured' });
  }
  if (authHeader !== expectedSecret && querySecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const summary = {
    started_at: new Date().toISOString(),
    warnings: { found: 0, sent: 0, failed: 0 },
    suspensions: { found: 0, emailed: 0, failed: 0 },
    errors: []
  };

  // ============================================================
  // STEP 1 — Find subscriptions needing WARNING email
  // ============================================================
  try {
    const { data: warningRows, error: warnErr } = await supabase.rpc(
      'find_subscriptions_needing_warning',
      { p_min_days: WARNING_DAYS, p_grace_days: GRACE_DAYS }
    );

    if (warnErr) throw warnErr;
    summary.warnings.found = warningRows?.length || 0;
    console.log(`[cron] found ${summary.warnings.found} subscriptions needing warning`);

    for (const row of warningRows || []) {
      try {
        if (!row.contact_email) {
          console.warn(`[cron] no contact_email for school ${row.school_id} — skipping warning`);
          continue;
        }

        const billingUrl = `https://${row.custom_domain || (row.school_slug + '.panyaschoolkit.com')}/pages/billing.html`;
        const addPaymentUrl = `https://${row.custom_domain || (row.school_slug + '.panyaschoolkit.com')}/pages/add-payment.html`;

        const email = emailTemplates.suspendWarning({
          schoolName: row.school_name,
          daysUntilSuspend: row.days_until_suspend || (GRACE_DAYS - WARNING_DAYS),
          addPaymentUrl,
          billingUrl
        });

        const result = await sendEmail({ to: row.contact_email, ...email });

        if (result.sent) {
          // Mark warning_sent_at so we don't send again
          await supabase.rpc('mark_warning_sent', { p_subscription_id: row.subscription_id });
          summary.warnings.sent++;
        } else {
          summary.warnings.failed++;
          summary.errors.push({
            stage: 'warning_email',
            school: row.school_slug,
            error: result.error
          });
        }
      } catch (err) {
        summary.warnings.failed++;
        summary.errors.push({
          stage: 'warning_loop',
          school: row.school_slug,
          error: err.message
        });
      }
    }
  } catch (err) {
    console.error('[cron] warning stage failed', err);
    summary.errors.push({ stage: 'warning_rpc', error: err.message });
  }

  // ============================================================
  // STEP 2 — Find + SUSPEND past_due subscriptions over grace period
  // ============================================================
  try {
    const { data: suspendedRows, error: suspErr } = await supabase.rpc(
      'check_past_due_subscriptions',
      { p_grace_days: GRACE_DAYS }
    );

    if (suspErr) throw suspErr;
    summary.suspensions.found = suspendedRows?.length || 0;
    console.log(`[cron] suspended ${summary.suspensions.found} subscriptions`);

    for (const row of suspendedRows || []) {
      try {
        if (!row.contact_email) {
          console.warn(`[cron] no contact_email for suspended school ${row.school_id}`);
          continue;
        }

        const addPaymentUrl = `https://${row.custom_domain || (row.school_slug + '.panyaschoolkit.com')}/pages/add-payment.html`;

        const email = emailTemplates.accountSuspended({
          schoolName: row.school_name,
          daysPastDue: row.days_past_due,
          addPaymentUrl
        });

        const result = await sendEmail({ to: row.contact_email, ...email });
        if (result.sent) {
          summary.suspensions.emailed++;
        } else {
          summary.suspensions.failed++;
          summary.errors.push({
            stage: 'suspended_email',
            school: row.school_slug,
            error: result.error
          });
        }
      } catch (err) {
        summary.suspensions.failed++;
        summary.errors.push({
          stage: 'suspended_loop',
          school: row.school_slug,
          error: err.message
        });
      }
    }
  } catch (err) {
    console.error('[cron] suspension stage failed', err);
    summary.errors.push({ stage: 'suspend_rpc', error: err.message });
  }

  summary.finished_at = new Date().toISOString();
  console.log('[cron] check-past-due summary', JSON.stringify(summary));

  return res.status(200).json(summary);
};
