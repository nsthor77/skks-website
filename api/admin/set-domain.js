// ==========================================================================
// /api/admin/set-domain.js  (DEVELOPER ONLY)
// Attach / change / remove a tenant's CUSTOM DOMAIN in one call:
//   1) save schools.custom_domain in the DB (so tenant detection works)
//   2) register the domain with the Vercel project (auto SSL) via Vercel API
//   3) return the DNS record the school must add + verification status
//
// Body: { school_id, custom_domain, action? }   action: 'set' (default) | 'remove'
// Auth: Bearer <user JWT> — caller MUST be role 'developer'.
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');
const {
  addDomainToVercel, removeDomainFromVercel, getDomainConfig,
  dnsInstructionsFor, isValidDomain, normDomain
} = require('../../lib/vercel-domains');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    // ---- decode caller JWT ----
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
    if (!me || me.role !== 'developer') return res.status(403).json({ error: 'Developer only' });

    const b = req.body || {};
    const schoolId = b.school_id;
    const action = b.action || 'set';
    if (!schoolId) return res.status(400).json({ error: 'Required: school_id' });

    // ---- REMOVE ----
    if (action === 'remove') {
      const { data: sch } = await supabaseAdmin.from('schools').select('custom_domain').eq('id', schoolId).single();
      const old = sch && sch.custom_domain;
      await supabaseAdmin.from('schools').update({ custom_domain: null }).eq('id', schoolId);
      let vercel = { configured: false };
      if (old) { try { vercel = await removeDomainFromVercel(old); } catch (e) {} }
      return res.status(200).json({ success: true, removed: old || null, custom_domain: null, vercel });
    }

    // ---- SET / CHANGE ----
    const domain = normDomain(b.custom_domain);
    if (!isValidDomain(domain)) {
      return res.status(400).json({ error: 'รูปแบบโดเมนไม่ถูกต้อง (ห้ามเป็น *.panyaschoolkit.com) เช่น app.suansonkk.ac.th' });
    }

    // not already used by another tenant
    const { data: taken } = await supabaseAdmin
      .from('schools').select('id').eq('custom_domain', domain).neq('id', schoolId).maybeSingle();
    if (taken) return res.status(409).json({ error: 'โดเมนนี้ถูกใช้กับโรงเรียนอื่นแล้ว' });

    // 1) save to DB (tenant detection works as soon as DNS + SSL resolve)
    const { error: upErr } = await supabaseAdmin
      .from('schools').update({ custom_domain: domain }).eq('id', schoolId);
    if (upErr) return res.status(500).json({ error: 'บันทึกโดเมนไม่สำเร็จ: ' + upErr.message });

    // 2) register with Vercel (auto SSL). Degrades gracefully if token not set.
    const vercel = await addDomainToVercel(domain);

    return res.status(200).json({
      success: true,
      custom_domain: domain,
      dns: dnsInstructionsFor(domain),   // what the SCHOOL must add at their registrar
      vercel                             // { configured, ok, verified, error?, message? }
    });
  } catch (err) {
    console.error('[admin/set-domain] error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
