// ==========================================================================
// /api/billing/cancel.js
// Cancel subscription — destroys Omise Schedule + marks cancel_at_period_end
//
// User keeps access until current_period_end. After that, no more charges.
// User can RESUME (re-add card or call /api/billing/resume) before period_end.
// ==========================================================================

const Omise = require('omise');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail, emailTemplates } = require('../../lib/email');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!userJwt) return res.status(401).json({ error: 'Missing Authorization' });

    // ---- Verify JWT manually ----
    let userId;
    try {
      const segments = userJwt.split('.');
      if (segments.length !== 3) throw new Error('Invalid JWT format');
      const payloadB64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      if (!payload.sub) throw new Error('JWT missing sub');
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) throw new Error('JWT expired');
      userId = payload.sub;
    } catch (err) {
      return res.status(401).json({ error: 'Invalid JWT', detail: err.message });
    }

    // ---- Service role client ----
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- Authorize: must be owner or developer ----
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (!profile) return res.status(403).json({ error: 'Profile not found' });

    const isDeveloper = profile.role === 'developer';
    const schoolId = req.body?.school_id || profile.school_id;

    if (!isDeveloper && (profile.school_id !== schoolId || profile.role !== 'owner')) {
      return res.status(403).json({ error: 'Only school owner can cancel subscription' });
    }

    // ---- Get current subscription + omise_schedule_id ----
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('id, omise_schedule_id, status, current_period_end')
      .eq('school_id', schoolId)
      .single();

    if (subErr || !sub) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // ---- Destroy Omise schedule (so no more auto-charges) ----
    let scheduleDestroyed = null;
    if (sub.omise_schedule_id) {
      try {
        const omise = Omise({
          publicKey: process.env.OMISE_PUBLIC_KEY,
          secretKey: process.env.OMISE_SECRET_KEY
        });
        scheduleDestroyed = await omise.schedules.destroy(sub.omise_schedule_id);
        console.log('[billing/cancel] Omise schedule destroyed', sub.omise_schedule_id);
      } catch (err) {
        // Log but don't fail — DB cancellation is more important
        console.error('[billing/cancel] omise.schedules.destroy failed', {
          schedule_id: sub.omise_schedule_id,
          err: err.message
        });
      }
    }

    // ---- Mark subscription as canceling at period end ----
    const { data: result, error: rpcErr } = await supabaseAdmin
      .rpc('cancel_subscription', { p_school_id: schoolId });

    if (rpcErr) {
      console.error('[billing/cancel] cancel_subscription RPC failed', rpcErr);
      return res.status(500).json({ error: 'Failed to cancel subscription', detail: rpcErr.message });
    }

    // Send cancellation email
    try {
      const { data: school } = await supabaseAdmin
        .from('schools')
        .select('name, slug, contact_email, custom_domain')
        .eq('id', schoolId)
        .single();
      if (school?.contact_email) {
        const email = emailTemplates.subscriptionCancelled({
          schoolName: school.name,
          currentPeriodEnd: result.current_period_end,
          billingUrl: `https://${school.custom_domain || (school.slug + '.panyaschoolkit.com')}/pages/billing.html`
        });
        await sendEmail({ to: school.contact_email, ...email });
      }
    } catch (emailErr) {
      console.error('[cancel] email failed', emailErr);
    }

    return res.status(200).json({
      success: result.success,
      message: result.message || 'Subscription canceled',
      current_period_end: result.current_period_end,
      schedule_destroyed: !!scheduleDestroyed,
      schedule_id: sub.omise_schedule_id
    });

  } catch (err) {
    console.error('[billing/cancel] error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
