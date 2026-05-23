// ==========================================================================
// /api/omise/test-charge.js
// TESTING ONLY — manually create an Omise charge against a customer.
//
// Why this exists:
//   - Omise test mode doesn't have a "Create Charge" UI button
//   - Schedules only fire on their scheduled date (won't trigger today)
//   - Need a way to manually trigger charge.complete event for E2E testing
//
// Security:
//   - Requires developer role (not just owner)
//   - Returns 403 if school is in live mode (no live charges via this endpoint)
//   - Should be REMOVED before public launch (Sprint 8)
//
// Usage (from browser console while logged in):
//   const s = (await supabaseClient.auth.getSession()).data.session;
//   await fetch('/api/omise/test-charge', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${s.access_token}`
//     },
//     body: JSON.stringify({ amount: 199000 })  // satang
//   }).then(r => r.json());
// ==========================================================================

const Omise = require('omise');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Block in live mode (defense)
  if (process.env.OMISE_SECRET_KEY?.startsWith('skey_live_')) {
    return res.status(403).json({ error: 'test-charge endpoint disabled in live mode' });
  }

  try {
    const { amount, school_id: school_id_input } = req.body || {};
    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

    if (!userJwt) return res.status(401).json({ error: 'Missing Authorization' });
    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Missing or invalid amount (satang, min 100)' });
    }

    // ---- Verify JWT manually (same approach as create-customer.js) ----
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

    // ---- Verify user is developer ----
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (!profile || profile.role !== 'developer') {
      return res.status(403).json({ error: 'Developer role required for test-charge' });
    }

    // ---- Get school + Omise customer ID ----
    const schoolId = school_id_input || profile.school_id;
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, name, omise_customer_id')
      .eq('id', schoolId)
      .single();

    if (!school || !school.omise_customer_id) {
      return res.status(404).json({ error: 'School has no Omise customer' });
    }

    // ---- Create Omise charge ----
    const omise = Omise({
      publicKey: process.env.OMISE_PUBLIC_KEY,
      secretKey: process.env.OMISE_SECRET_KEY
    });

    console.log('[test-charge] creating charge', {
      customer_id: school.omise_customer_id,
      amount,
      school_id: schoolId
    });

    const charge = await omise.charges.create({
      amount: amount,
      currency: 'THB',
      customer: school.omise_customer_id,
      description: `Test charge for ${school.name} (manual trigger)`,
      capture: true
    });

    console.log('[test-charge] charge created', {
      charge_id: charge.id,
      status: charge.status,
      paid: charge.paid,
      amount: charge.amount
    });

    return res.status(200).json({
      success: true,
      charge: {
        id: charge.id,
        status: charge.status,
        paid: charge.paid,
        amount: charge.amount,
        amount_baht: charge.amount / 100,
        customer: charge.customer,
        description: charge.description
      },
      next_step: 'webhook should fire charge.complete within ~5 seconds — check /api/omise/webhook logs'
    });

  } catch (err) {
    console.error('[test-charge] error', err);
    return res.status(500).json({
      error: err.message || 'Internal error',
      code: err.code,
      object: err.object
    });
  }
};
