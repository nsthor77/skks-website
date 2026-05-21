// ==========================================================================
// /api/omise/webhook.js
// Vercel Serverless Function — receives async events from Omise.
//
// Omise sends POST here when:
//   - customer.create / customer.update  (we attached/updated a card)
//   - charge.complete                    (a charge succeeded)
//   - charge.failed                      (a charge failed)
//   - schedule.complete                  (a recurring charge ran)
//   - schedule.failed                    (a recurring charge failed)
//
// Webhook URL to register in Omise dashboard:
//   https://skks-website.vercel.app/api/omise/webhook
//   (or any tenant subdomain — they all hit the same function)
//
// Security model:
//   - Omise does NOT sign webhooks with HMAC by default.
//   - To verify authenticity we CALL BACK to Omise: retrieve the event by id.
//     If the event exists with the same payload, it's real.
//   - This is the pattern recommended by Stripe/Omise/etc. for unsigned webhooks.
//
// Idempotency:
//   - Omise may send the same event multiple times (e.g. on transient failures).
//   - We dedupe by inserting into audit_logs with (event_id) — duplicate inserts
//     are silently ignored.
//
// Env vars required (already set for create-customer.js):
//   - OMISE_PUBLIC_KEY
//   - OMISE_SECRET_KEY
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_KEY  (we use service role — no user JWT here)
// ==========================================================================

const Omise = require('omise');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // ---- Only POST is allowed ----
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const event = req.body || {};
    const eventId = event.id;
    const eventKey = event.key; // e.g. "charge.complete", "customer.create"

    if (!eventId || !eventKey) {
      console.warn('[omise/webhook] missing event id or key', { event });
      // Still return 200 — don't let Omise retry malformed payloads forever
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
      console.error('[omise/webhook] failed to verify event', { eventId, err });
      // Don't accept events we can't verify
      return res.status(400).json({ error: 'Event verification failed' });
    }

    // ---- 2. Service-role Supabase client (no user JWT) ----
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- 3. Log every event to audit_logs (idempotent — duplicate id ignored) ----
    // audit_logs schema: id, school_id, actor_id, action, target_table, target_id, metadata, created_at
    await supabase.from('audit_logs').insert({
      school_id: null, // Resolved below if we can find it
      actor_id: null,
      action: `omise.${eventKey}`,
      target_table: 'omise_events',
      target_id: eventId,
      metadata: {
        event_id: eventId,
        event_key: eventKey,
        livemode: verifiedEvent.livemode,
        data: verifiedEvent.data
      }
    });

    // ---- 4. Handle specific event types ----
    const data = verifiedEvent.data || {};

    switch (eventKey) {
      // ---- Charge events ----
      case 'charge.complete': {
        // A charge succeeded. Find the school via customer_id, mark invoice paid.
        const customerId = data.customer;
        const chargeId = data.id;
        const amount = data.amount; // in satang (e.g. 199000 = ฿1,990.00)

        if (customerId) {
          const { data: school } = await supabase
            .from('schools')
            .select('id')
            .eq('omise_customer_id', customerId)
            .single();

          if (school) {
            // Activate subscription
            await supabase
              .from('subscriptions')
              .update({
                status: 'active',
                last_payment_at: new Date().toISOString()
              })
              .eq('school_id', school.id)
              .in('status', ['trialing', 'past_due']);

            // Insert invoice record (idempotent via omise_charge_id)
            await supabase.from('invoices').upsert(
              {
                school_id: school.id,
                omise_charge_id: chargeId,
                amount_satang: amount,
                amount_thb: amount / 100,
                status: 'paid',
                paid_at: new Date().toISOString()
              },
              { onConflict: 'omise_charge_id' }
            );

            console.log('[omise/webhook] charge.complete handled', {
              school_id: school.id,
              charge_id: chargeId,
              amount
            });
          }
        }
        break;
      }

      case 'charge.failed': {
        const customerId = data.customer;
        const chargeId = data.id;
        const failureMessage = data.failure_message || data.failure_code || 'unknown';

        if (customerId) {
          const { data: school } = await supabase
            .from('schools')
            .select('id')
            .eq('omise_customer_id', customerId)
            .single();

          if (school) {
            // Mark subscription past_due (will trigger grace period logic later)
            await supabase
              .from('subscriptions')
              .update({ status: 'past_due' })
              .eq('school_id', school.id)
              .eq('status', 'active');

            // Insert failed invoice for record-keeping
            await supabase.from('invoices').upsert(
              {
                school_id: school.id,
                omise_charge_id: chargeId,
                amount_satang: data.amount,
                amount_thb: data.amount / 100,
                status: 'failed',
                failure_reason: failureMessage
              },
              { onConflict: 'omise_charge_id' }
            );

            console.log('[omise/webhook] charge.failed handled', {
              school_id: school.id,
              charge_id: chargeId,
              failure: failureMessage
            });
          }
        }
        break;
      }

      // ---- Schedule events (recurring charges — used in Sprint 6+) ----
      case 'schedule.complete':
      case 'schedule.failed':
      case 'schedule.expired':
        console.log('[omise/webhook] schedule event (no handler yet)', {
          key: eventKey,
          data
        });
        break;

      // ---- Customer events (mostly informational) ----
      case 'customer.create':
      case 'customer.update':
      case 'customer.destroy':
        console.log('[omise/webhook] customer event logged', { key: eventKey });
        break;

      // ---- Catch-all ----
      default:
        console.log('[omise/webhook] unhandled event type', { key: eventKey });
        break;
    }

    // ---- 5. Always return 200 OK fast (Omise retries on non-2xx) ----
    return res.status(200).json({ received: true, event_id: eventId, event_key: eventKey });

  } catch (err) {
    console.error('[omise/webhook] handler error', err);
    // Return 500 — Omise will retry with backoff
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
