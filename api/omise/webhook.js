// ==========================================================================
// /api/omise/webhook.js
// Vercel Serverless Function — receives async events from Omise.
//
// Sprint 5 scope (minimal):
//   1. Verify the event is real by calling back to Omise
//   2. Log every event to audit_logs (idempotent via metadata.event_id)
//   3. Return 200 OK fast
//
// Sprint 6+ will add:
//   - charge.complete → update subscription status, insert invoice
//   - charge.failed   → mark past_due, log failure
//   - schedule.*      → handle recurring billing events
//   - Resolve school_id from Omise customer_id to set audit_logs.school_id
//
// Webhook URL to register in Omise dashboard (Sprint 5.F):
//   https://skks-website.vercel.app/api/omise/webhook
//
// Security:
//   - Omise doesn't sign webhooks by default
//   - We verify by calling omise.events.retrieve(eventId) to confirm it exists
//
// Env vars (already set):
//   - OMISE_PUBLIC_KEY, OMISE_SECRET_KEY
//   - SUPABASE_URL, SUPABASE_SERVICE_KEY
// ==========================================================================

const Omise = require('omise');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const event = req.body || {};
    const eventId = event.id;
    const eventKey = event.key; // e.g. "charge.complete"

    if (!eventId || !eventKey) {
      console.warn('[omise/webhook] malformed event', { event });
      // Still return 200 — don't let Omise retry malformed payloads
      return res.status(200).json({ received: true, skipped: 'missing id/key' });
    }

    // ---- 1. Verify event by calling back to Omise ----
    const omise = Omise({
      publicKey: process.env.OMISE_PUBLIC_KEY,
      secretKey: process.env.OMISE_SECRET_KEY
    });

    let verifiedEvent;
    try {
      verifiedEvent = await omise.events.retrieve(eventId);
    } catch (err) {
      console.error('[omise/webhook] event verification failed', { eventId, err: err.message });
      return res.status(400).json({ error: 'Event verification failed' });
    }

    // ---- 2. Try to resolve school_id from event data (if customer present) ----
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const data = verifiedEvent.data || {};
    let schoolId = null;
    const customerId = data.customer || (data.card && data.card.customer);

    if (customerId) {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('omise_customer_id', customerId)
        .maybeSingle();
      if (school) schoolId = school.id;
    }

    // ---- 3. Log event to audit_logs (matches real schema) ----
    // Schema: school_id, user_id, action, resource_type, resource_id, metadata, ...
    const { error: logErr } = await supabase.from('audit_logs').insert({
      school_id: schoolId,
      user_id: null, // No user — this is a system event from Omise
      action: `omise.${eventKey}`,
      resource_type: 'omise_event',
      resource_id: eventId,
      metadata: {
        event_id: eventId,
        event_key: eventKey,
        livemode: verifiedEvent.livemode,
        omise_customer_id: customerId || null,
        data: data
      }
    });

    if (logErr) {
      console.error('[omise/webhook] audit_logs insert failed', logErr);
      // Don't fail the webhook — log error and continue
    }

    // ---- 4. Sprint 5: log specific event types but don't act on them yet ----
    // (Sprint 6 will add subscription/invoice updates here)
    console.log('[omise/webhook] received', {
      event_id: eventId,
      event_key: eventKey,
      livemode: verifiedEvent.livemode,
      school_id: schoolId,
      customer_id: customerId
    });

    // ---- 5. Always return 200 OK fast ----
    return res.status(200).json({
      received: true,
      event_id: eventId,
      event_key: eventKey,
      school_id: schoolId
    });

  } catch (err) {
    console.error('[omise/webhook] handler error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
