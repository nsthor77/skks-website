// ==========================================================================
// /api/admin/create-school.js  (DEVELOPER ONLY)
// Platform-admin onboarding: create a tenant school + its owner account in one
// step, with optional comp (free) activation + special discount %.
// Lets the founder add trial / discounted schools without touching Supabase.
//
// Body: { schoolName, schoolNameEn?, slug, ownerEmail, ownerPassword,
//         ownerFirstName?, ownerLastName?, discountPercent?, comp?, notes? }
// Auth: Bearer <user JWT> — caller MUST be role 'developer'.
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');
const { addDomainToVercel, dnsInstructionsFor, isValidDomain, normDomain } = require('../../lib/vercel-domains');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    // ---- decode caller JWT (same pattern as billing/cancel.js) ----
    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!userJwt) return res.status(401).json({ error: 'Missing Authorization' });
    let userId;
    try {
      const seg = userJwt.split('.');
      const payloadB64 = seg[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      if (!payload.sub) throw new Error('no sub');
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired');
      userId = payload.sub;
    } catch (e) { return res.status(401).json({ error: 'Invalid JWT', detail: e.message }); }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- authorize: developer only ----
    const { data: me } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).single();
    if (!me || me.role !== 'developer') {
      return res.status(403).json({ error: 'Developer only' });
    }

    // ---- validate input ----
    const b = req.body || {};
    const schoolName = (b.schoolName || '').trim();
    const slug = (b.slug || '').trim().toLowerCase();
    const ownerEmail = (b.ownerEmail || '').trim().toLowerCase();
    const ownerPassword = b.ownerPassword || '';
    if (!schoolName || !slug || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ error: 'Required: schoolName, slug, ownerEmail, ownerPassword' });
    }
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
      return res.status(400).json({ error: 'slug must be 3-40 chars: a-z 0-9 -' });
    }
    if (ownerPassword.length < 8) {
      return res.status(400).json({ error: 'ownerPassword must be at least 8 chars' });
    }

    // ---- 1) provision school ----
    const { data: prov, error: provErr } = await supabaseAdmin.rpc('provision_school', {
      p_school_name: schoolName,
      p_school_slug: slug,
      p_contact_email: ownerEmail,
      p_school_name_en: (b.schoolNameEn || '').trim() || null
    });
    if (provErr) return res.status(500).json({ error: 'provision_school failed: ' + provErr.message });
    if (!prov || prov.success === false) return res.status(400).json({ error: (prov && prov.error) || 'provision failed (slug taken?)' });
    const schoolId = prov.school_id;

    // ---- 2) create owner auth user (no login switch — uses admin API) ----
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: {
        first_name: (b.ownerFirstName || '').trim(),
        last_name: (b.ownerLastName || '').trim(),
        school_id: schoolId,
        role: 'owner'
      }
    });
    if (cErr) {
      return res.status(500).json({ error: 'School created but owner account failed: ' + cErr.message, school_id: schoolId });
    }
    const ownerId = created.user.id;

    // ---- 3) ensure profile linked (trigger usually makes it; upsert minimal cols) ----
    try {
      await supabaseAdmin.from('profiles').upsert(
        { id: ownerId, school_id: schoolId, role: 'owner' },
        { onConflict: 'id' }
      );
    } catch (e) { /* trigger likely handled it */ }

    // ---- 4) comp-activate + store discount (in billing_info jsonb, no schema change) ----
    let billing = {};
    try {
      const { data: sch } = await supabaseAdmin.from('schools').select('billing_info').eq('id', schoolId).single();
      billing = (sch && sch.billing_info) || {};
    } catch (e) {}
    billing.comp = b.comp !== false;                       // default true (trial/comp)
    billing.discount_percent = Number(b.discountPercent) || 0;
    billing.onboarded_by = userId;
    billing.onboarded_at = new Date().toISOString();
    if (b.notes) billing.onboard_notes = String(b.notes);

    // website mode + package tier
    const allowedModes = ['managed', 'external', 'app_only'];
    const siteMode = allowedModes.includes(b.siteMode) ? b.siteMode : 'managed';
    const allowedPlans = ['starter', 'pro', 'premium'];
    const plan = allowedPlans.includes(b.plan) ? b.plan : 'pro';

    const { error: upErr } = await supabaseAdmin.from('schools')
      .update({ status: 'active', billing_info: billing, site_mode: siteMode, plan: plan })
      .eq('id', schoolId);
    if (upErr) console.error('[create-school] school update failed', upErr.message);

    // best-effort: activate subscription row if present
    try { await supabaseAdmin.from('subscriptions').update({ status: 'active' }).eq('school_id', schoolId); } catch (e) {}

    // best-effort: if approved from a waitlist entry, mark it converted (service role → bypasses RLS)
    if (b.waitlistId) {
      try { await supabaseAdmin.from('waitlist').update({ status: 'converted' }).eq('id', b.waitlistId); } catch (e) {}
    }

    // best-effort: register the default {slug}.panyaschoolkit.com with Vercel so it gets SSL
    // automatically (DNS wildcard already resolves; Vercel needs each subdomain added to issue a cert).
    // Avoids the risky NS migration (#66) — no effect on email/marketing DNS.
    let subdomainResult = null;
    try {
      subdomainResult = await addDomainToVercel(slug + '.panyaschoolkit.com');
    } catch (e) { subdomainResult = { ok: false, error: e.message }; }

    // ---- 5) optional custom domain (set in DB + register with Vercel, auto SSL) ----
    let customDomain = null;
    let domainResult = null;
    const reqDomain = normDomain(b.customDomain);
    if (reqDomain) {
      if (!isValidDomain(reqDomain)) {
        domainResult = { ok: false, error: 'รูปแบบโดเมนไม่ถูกต้อง (ข้ามการตั้ง custom domain) — ตั้งทีหลังได้ที่หน้า tenant' };
      } else {
        try {
          await supabaseAdmin.from('schools').update({ custom_domain: reqDomain }).eq('id', schoolId);
          customDomain = reqDomain;
          domainResult = await addDomainToVercel(reqDomain);
          domainResult.dns = dnsInstructionsFor(reqDomain);
        } catch (e) {
          domainResult = { ok: false, error: 'ตั้ง custom domain ไม่สำเร็จ: ' + e.message };
        }
      }
    }

    return res.status(200).json({
      success: true,
      school_id: schoolId,
      owner_id: ownerId,
      slug,
      login_email: ownerEmail,
      comp: billing.comp,
      discount_percent: billing.discount_percent,
      custom_domain: customDomain,
      domain: domainResult,
      subdomain: subdomainResult
    });
  } catch (err) {
    console.error('[admin/create-school] error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
