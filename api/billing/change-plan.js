// ==========================================================================
// /api/billing/change-plan.js
// Change subscription plan/cycle.
//
// Flow:
//   1. Verify user is owner/developer of the school
//   2. Call change_plan RPC (updates plan_id + billing_cycle in DB)
//   3. Destroy old Omise schedule (if any)
//   4. Create new Omise schedule with new amount
//   5. Return result
//
// Note: No proration in MVP. New amount applies at next billing cycle.
//       (User keeps their current_period_end. Next charge uses new amount.)
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
    const { new_plan_id, new_billing_cycle, school_id: school_id_input } = req.body || {};
    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

    if (!userJwt) return res.status(401).json({ error: 'Missing Authorization' });
    if (!new_plan_id || !new_billing_cycle) {
      return res.status(400).json({ error: 'Missing new_plan_id or new_billing_cycle' });
    }
    if (!['starter', 'pro', 'premium'].includes(new_plan_id)) {
      return res.status(400).json({ error: 'Invalid new_plan_id' });
    }
    if (!['monthly', 'yearly'].includes(new_billing_cycle)) {
      return res.status(400).json({ error: 'Invalid new_billing_cycle' });
    }

    // ---- Verify JWT ----
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

    // ---- Authorize ----
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (!profile) return res.status(403).json({ error: 'Profile not found' });

    const isDeveloper = profile.role === 'developer';
    const schoolId = school_id_input || profile.school_id;

    if (!isDeveloper && (profile.school_id !== schoolId || profile.role !== 'owner')) {
      return res.status(403).json({ error: 'Only school owner can change plan' });
    }

    // ---- Get school + customer info ----
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, name, slug, contact_email, custom_domain, omise_customer_id, trial_ends_at')
      .eq('id', schoolId)
      .single();

    if (!school?.omise_customer_id) {
      return res.status(400).json({ error: 'No payment method on file' });
    }

    // ---- Call change_plan RPC ----
    const { data: result, error: rpcErr } = await supabaseAdmin
      .rpc('change_plan', {
        p_school_id: schoolId,
        p_new_plan_id: new_plan_id,
        p_new_billing_cycle: new_billing_cycle
      });

    if (rpcErr || !result?.success) {
      return res.status(400).json({
        error: result?.error || rpcErr?.message || 'change_plan failed'
      });
    }

    // ---- Destroy old Omise schedule (if any) ----
    const omise = Omise({
      publicKey: process.env.OMISE_PUBLIC_KEY,
      secretKey: process.env.OMISE_SECRET_KEY
    });

    let oldScheduleDestroyed = null;
    if (result.old_omise_schedule_id) {
      try {
        oldScheduleDestroyed = await omise.schedules.destroy(result.old_omise_schedule_id);
        console.log('[billing/change-plan] old schedule destroyed', result.old_omise_schedule_id);
      } catch (err) {
        console.error('[billing/change-plan] omise.schedules.destroy failed', {
          schedule_id: result.old_omise_schedule_id,
          err: err.message
        });
      }
    }

    // ---- Get subscription's current_period_end (= when new schedule should start) ----
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('current_period_end, omise_schedule_id')
      .eq('school_id', schoolId)
      .single();

    // ---- Create new Omise schedule ----
    let newScheduleResult = null;
    try {
      // Schedule starts when current period ends (next billing cycle)
      const startDate = new Date(sub.current_period_end);
      // Sanity check: if period_end is in the past (e.g. expired trial), use tomorrow
      if (startDate < new Date()) {
        startDate.setDate(new Date().getDate() + 1);
      }
      const startDateStr = startDate.toISOString().split('T')[0];

      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 4); // Omise max 4-year window
      const endDateStr = endDate.toISOString().split('T')[0];

      const dayOfMonth = startDate.getUTCDate();
      const everyN = new_billing_cycle === 'yearly' ? 12 : 1;

      const newSchedule = await omise.schedules.create({
        every: everyN,
        period: 'month',
        start_date: startDateStr,
        end_date: endDateStr,
        on: { days_of_month: [dayOfMonth] },
        charge: {
          customer: school.omise_customer_id,
          amount: result.new_amount_satang,
          description: `SchoolKit ${new_plan_id} ${new_billing_cycle}`
        }
      });

      // Save new schedule_id to subscription
      await supabaseAdmin
        .from('subscriptions')
        .update({
          omise_schedule_id: newSchedule.id,
          updated_at: new Date().toISOString()
        })
        .eq('school_id', schoolId);

      newScheduleResult = {
        schedule_id: newSchedule.id,
        start_date: startDateStr,
        amount_satang: result.new_amount_satang
      };
      console.log('[billing/change-plan] new schedule created', newSchedule.id);
    } catch (err) {
      console.error('[billing/change-plan] omise.schedules.create failed', err);
      newScheduleResult = { error: err.message };
    }

    // Send plan changed email
    try {
      if (school?.contact_email) {
        const email = emailTemplates.planChanged({
          schoolName: school.name,
          oldPlanId: result.old_plan_id,
          oldCycle: result.old_billing_cycle,
          newPlanId: result.new_plan_id,
          newCycle: result.new_billing_cycle,
          newAmountBaht: result.new_amount_satang / 100,
          billingUrl: `https://${school.custom_domain || (school.slug + '.panyaschoolkit.com')}/pages/billing.html`
        });
        await sendEmail({ to: school.contact_email, ...email });
      }
    } catch (emailErr) {
      console.error('[change-plan] email failed', emailErr);
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      old: {
        plan_id: result.old_plan_id,
        billing_cycle: result.old_billing_cycle,
        amount_satang: result.old_amount_satang,
        schedule_destroyed: !!oldScheduleDestroyed
      },
      new: {
        plan_id: result.new_plan_id,
        billing_cycle: result.new_billing_cycle,
        amount_satang: result.new_amount_satang,
        schedule: newScheduleResult
      }
    });

  } catch (err) {
    console.error('[billing/change-plan] error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
