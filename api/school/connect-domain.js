// ==========================================================================
// /api/school/connect-domain.js   (OWNER self-serve)
// Lets a school OWNER connect/remove THEIR OWN custom domain:
//   1) save schools.custom_domain (their school only)
//   2) register the domain with the Vercel project (auto SSL)
//   3) return the exact DNS record the school must add at their registrar
//
// Security: the caller's school_id comes from THEIR profile — an owner can only
// ever touch their own school's domain (a passed school_id is ignored). Role must
// be owner (or developer). Rejects *.panyaschoolkit.com and domains used by others.
//
// Body: { custom_domain, action? }   action: 'set' (default) | 'remove'
// Auth: Bearer <user JWT>.
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');
const {
  addDomainToVercel, removeDomainFromVercel,
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

    // ---- authorize: owner (or developer) of a school ----
    const { data: me } = await supabaseAdmin.from('profiles').select('school_id, role').eq('id', userId).single();
    if (!me) return res.status(403).json({ error: 'Profile not found' });
    if (me.role !== 'owner' && me.role !== 'developer') {
      return res.status(403).json({ error: 'เฉพาะเจ้าของโรงเรียน (Owner) เท่านั้นที่ตั้งโดเมนได้' });
    }
    const schoolId = me.school_id;   // an owner can only touch their OWN school
    if (!schoolId) return res.status(400).json({ error: 'No school linked to this account' });

    const b = req.body || {};
    const action = b.action || 'set';

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
      return res.status(400).json({ error: 'รูปแบบโดเมนไม่ถูกต้อง (ห้ามลงท้าย .panyaschoolkit.com) — เช่น app.suansonkk.ac.th' });
    }

    // not already used by another school
    const { data: taken } = await supabaseAdmin
      .from('schools').select('id').eq('custom_domain', domain).neq('id', schoolId).maybeSingle();
    if (taken) return res.status(409).json({ error: 'โดเมนนี้ถูกใช้กับโรงเรียนอื่นแล้ว' });

    // 1) save to DB
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
    console.error('[school/connect-domain] error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
