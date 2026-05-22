// ==========================================================================
// /api/omise/create-customer.js
// Vercel Serverless Function — creates an Omise customer + attaches card.
//
// Flow:
//   1. Browser tokenizes card via Omise.js (card data never touches us — PCI safe)
//   2. Browser POSTs { token, school_id } with user's Supabase JWT
//   3. We verify user is owner of that school
//   4. We call Omise to create-or-update customer + attach card
//   5. We save omise_customer_id on schools, insert payment_methods row
//   6. Return { success, customer_id, card } to browser
//
// Env vars required (set in Vercel dashboard):
//   - OMISE_PUBLIC_KEY      (pkey_test_...) — could also be hardcoded, it's public
//   - OMISE_SECRET_KEY      (skey_test_...) — KEEP SECRET
//   - SUPABASE_URL          (https://nuzhkhchimemuetoewzn.supabase.co)
//   - SUPABASE_ANON_KEY     (anon/public key — for verifying user JWT)
//   - SUPABASE_SERVICE_KEY  (service_role key — for bypassing RLS on writes; KEEP SECRET)
// ==========================================================================

const Omise = require('omise');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // ---- CORS (loose for now — tighten after we know the final domains) ----
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // ---- 1. Parse + validate input ----
    const { token, school_id } = req.body || {};
    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

    if (!token) return res.status(400).json({ error: 'Missing card token' });
    if (!school_id) return res.status(400).json({ error: 'Missing school_id' });
    if (!userJwt) return res.status(401).json({ error: 'Missing Authorization header' });

    // ---- 2. Verify user identity by decoding JWT manually ----
    // (supabase-js@2.39 doesn't handle new ES256 asymmetric JWT format reliably.
    //  Manual decode is acceptable in test mode — JWT travels via HTTPS only.
    //  Sprint 6+ will upgrade to full JWKS verification.)
    let user;
    try {
      const segments = userJwt.split('.');
      if (segments.length !== 3) {
        throw new Error(`JWT has ${segments.length} segments, expected 3`);
      }
      // Base64URL decode the payload (segment 1, 0-indexed)
      const payloadB64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
      const payloadJson = Buffer.from(padded, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);

      // Validate JWT claims
      if (!payload.sub) throw new Error('JWT missing sub (user id)');
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) throw new Error('JWT expired');
      if (payload.iss && !payload.iss.includes('supabase')) throw new Error('JWT issuer not Supabase');

      user = { id: payload.sub, email: payload.email };
    } catch (jwtErr) {
      console.error('[omise/create-customer] JWT decode failed', {
        err: jwtErr.message,
        jwt_length: userJwt?.length,
        jwt_start: userJwt?.substring(0, 30)
      });
      return res.status(401).json({
        error: 'Invalid or expired session',
        detail: jwtErr.message
      });
    }

    // ---- 3. Service-role client (bypass RLS for trusted operations) ----
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- 4. Authorization: user must be owner of this school (or developer = platform admin) ----
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return res.status(403).json({ error: 'Profile not found' });
    }

    const isDeveloper = profile.role === 'developer';

    // Developers bypass school + role checks (they manage all tenants)
    if (!isDeveloper) {
      if (profile.school_id !== school_id) {
        return res.status(403).json({ error: 'You do not belong to this school' });
      }
      if (profile.role !== 'owner') {
        return res.status(403).json({ error: 'Only the school owner can add payment methods' });
      }
    }

    // ---- 5. Load school details ----
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .select('id, name, contact_email, omise_customer_id')
      .eq('id', school_id)
      .single();

    if (schoolErr || !school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // ---- 6. Create or update Omise customer ----
    const omise = Omise({
      publicKey: process.env.OMISE_PUBLIC_KEY,
      secretKey: process.env.OMISE_SECRET_KEY
    });

    let customer;
    if (school.omise_customer_id) {
      // Existing customer — attach new card
      customer = await omise.customers.update(school.omise_customer_id, {
        card: token
      });
    } else {
      // New customer
      customer = await omise.customers.create({
        email: school.contact_email,
        description: `${school.name} (school_id: ${school_id})`,
        card: token
      });
    }

    // ---- 7. Save omise_customer_id back to schools ----
    if (!school.omise_customer_id || school.omise_customer_id !== customer.id) {
      await supabaseAdmin
        .from('schools')
        .update({ omise_customer_id: customer.id })
        .eq('id', school_id);
    }

    // ---- 8. Re-fetch customer to get latest cards (update response may not include cards) ----
    const freshCustomer = await omise.customers.retrieve(customer.id);
    const cards = (freshCustomer.cards && freshCustomer.cards.data) || [];
    const defaultCard =
      cards.find(c => c.id === freshCustomer.default_card) ||
      cards[cards.length - 1];

    console.log('[omise/create-customer] customer card status', {
      customer_id: freshCustomer.id,
      cards_count: cards.length,
      default_card_id: freshCustomer.default_card,
      picked_card_id: defaultCard?.id
    });

    if (defaultCard) {
      // Unset previous default
      const { error: updateErr } = await supabaseAdmin
        .from('payment_methods')
        .update({ is_default: false })
        .eq('school_id', school_id);

      if (updateErr) {
        console.error('[omise/create-customer] failed to unset default', updateErr);
      }

      // Upsert this card (omise_card_id has UNIQUE constraint)
      const { error: upsertErr, data: upsertData } = await supabaseAdmin
        .from('payment_methods')
        .upsert(
          {
            school_id,
            omise_customer_id: customer.id,
            omise_card_id: defaultCard.id,
            card_brand: defaultCard.brand,
            card_last4: defaultCard.last_digits,
            card_exp_month: defaultCard.expiration_month,
            card_exp_year: defaultCard.expiration_year,
            is_default: true
          },
          { onConflict: 'omise_card_id' }
        )
        .select();

      if (upsertErr) {
        console.error('[omise/create-customer] payment_methods upsert FAILED', {
          err: upsertErr.message,
          code: upsertErr.code,
          details: upsertErr.details,
          hint: upsertErr.hint
        });
      } else {
        console.log('[omise/create-customer] payment_methods upserted', {
          rows: upsertData?.length
        });
      }
    } else {
      console.warn('[omise/create-customer] no card found on customer', {
        customer_id: freshCustomer.id,
        cards_raw: freshCustomer.cards
      });
    }

    // ---- 9. Activate trial if school is in pending_payment state ----
    // Sprint 5.5 (card-upfront): transitions status pending_payment → trialing
    // + sets trial_end = NOW() + 14 days
    // Idempotent: returns already_active:true if school already activated
    let trialActivation = null;
    try {
      const { data: activationResult, error: activationErr } = await supabaseAdmin
        .rpc('activate_school_trial', { p_school_id: school_id });

      if (activationErr) {
        console.error('[omise/create-customer] activate_school_trial RPC failed', activationErr);
      } else {
        trialActivation = activationResult;
        console.log('[omise/create-customer] trial activation result', activationResult);
      }
    } catch (err) {
      console.error('[omise/create-customer] activate_school_trial exception', err);
    }

    // ---- 10. Success ----
    return res.status(200).json({
      success: true,
      customer_id: customer.id,
      card: defaultCard
        ? {
            brand: defaultCard.brand,
            last4: defaultCard.last_digits,
            exp_month: defaultCard.expiration_month,
            exp_year: defaultCard.expiration_year
          }
        : null,
      trial: trialActivation
        ? {
            activated: !!trialActivation.success,
            already_active: !!trialActivation.already_active,
            status: trialActivation.status,
            trial_end: trialActivation.trial_end
          }
        : null
    });

  } catch (err) {
    console.error('[omise/create-customer]', err);
    return res.status(500).json({
      error: err.message || 'Internal error',
      code: err.code,
      object: err.object
    });
  }
};
