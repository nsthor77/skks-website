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
    // Different events have customer_id in different places:
    //   - customer.* events:  data.id (the customer itself)
    //   - charge.* events:    data.customer
    //   - schedule.* events:  data.charge.customer (nested)
    const customerId =
      (data.object === 'customer' ? data.id : null) ||
      data.customer ||
      (data.card && data.card.customer) ||
      (data.charge && data.charge.customer);

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

    console.log('[omise/webhook] received', {
      event_id: eventId,
      event_key: eventKey,
      livemode: verifiedEvent.livemode,
      school_id: schoolId,
      customer_id: customerId
    });

    // ---- 4. Handle charge events (Sprint 6) ----
    let actionResult = null;

    if (eventKey === 'charge.complete' && schoolId) {
      // Successful charge → insert invoice + activate subscription
      try {
        // Get subscription info for plan/cycle context
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id, plan_id, billing_cycle, billing_cycle')
          .eq('school_id', schoolId)
          .single();

        // Insert paid invoice via RPC (auto-generates invoice number)
        const { data: invoiceResult, error: invoiceErr } = await supabase.rpc('insert_paid_invoice', {
          p_school_id: schoolId,
          p_omise_charge_id: data.id,
          p_amount_satang: data.amount,
          p_plan_id: sub?.plan_id || null,
          p_billing_cycle: sub?.billing_cycle || null
        });

        if (invoiceErr) {
          console.error('[omise/webhook] insert_paid_invoice failed', invoiceErr);
        } else {
          console.log('[omise/webhook] invoice created', invoiceResult);
        }

        // Update subscription status to active + extend period
        // (For monthly: +1 month; for yearly: +12 months. Compute from current_period_end)
        const cycleMonths = sub?.billing_cycle === 'yearly' ? 12 : 1;
        const now = new Date();
        const newPeriodEnd = new Date(now);
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + cycleMonths);

        const { error: subUpdateErr } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: newPeriodEnd.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('school_id', schoolId);

        if (subUpdateErr) {
          console.error('[omise/webhook] subscription update failed', subUpdateErr);
        }

        // Update school status
        await supabase
          .from('schools')
          .update({ status: 'active' })
          .eq('id', schoolId);

        actionResult = {
          type: 'charge.complete',
          invoice: invoiceResult,
          new_period_end: newPeriodEnd.toISOString()
        };
      } catch (err) {
        console.error('[omise/webhook] charge.complete handler exception', err);
      }
    }

    else if (eventKey === 'charge.failed' && schoolId) {
      // Failed charge → mark subscription past_due + insert failed invoice
      try {
        // Insert failed invoice record (uses insert_paid_invoice + then patch status)
        const { data: invoiceResult } = await supabase.rpc('insert_paid_invoice', {
          p_school_id: schoolId,
          p_omise_charge_id: data.id,
          p_amount_satang: data.amount,
          p_plan_id: null,
          p_billing_cycle: null
        });

        if (invoiceResult?.invoice_id) {
          await supabase
            .from('invoices')
            .update({
              status: 'failed',
              paid_at: null,
              metadata: {
                ...invoiceResult.metadata,
                failure_message: data.failure_message || data.failure_code || 'unknown',
                failed_at: new Date().toISOString()
              }
            })
            .eq('id', invoiceResult.invoice_id);
        }

        // Mark subscription past_due (grace period handling in Sprint 6.5)
        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString()
          })
          .eq('school_id', schoolId);

        await supabase
          .from('schools')
          .update({ status: 'past_due' })
          .eq('id', schoolId);

        actionResult = {
          type: 'charge.failed',
          failure_message: data.failure_message,
          invoice_id: invoiceResult?.invoice_id
        };

        console.log('[omise/webhook] charge.failed handled', actionResult);
      } catch (err) {
        console.error('[omise/webhook] charge.failed handler exception', err);
      }
    }

    // ---- 5. Always return 200 OK fast ----
    return res.status(200).json({
      received: true,
      event_id: eventId,
      event_key: eventKey,
      school_id: schoolId,
      action: actionResult
    });

  } catch (err) {
    console.error('[omise/webhook] handler error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
