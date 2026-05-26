// ==========================================================================
// /api/waitlist/join.js
// Sprint 9.B: Public waitlist signup endpoint
//
// POST { email, school_name, school_size, contact_name, phone, notes, source }
// → Insert to public.waitlist via join_waitlist RPC
// → Send confirm email via Resend
// → Return { success, duplicate }
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');
const { sendEmail, emailTemplates } = require('../../lib/email');

// Basic anti-spam: rate-limit by IP (in-memory, resets per Vercel invocation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 submissions/min/IP

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // ---- Rate limiting ----
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
      .toString().split(',')[0].trim();
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Try again in 1 minute.' });
    }

    // ---- Parse body (works for application/json, text/plain, or raw string) ----
    let body;
    try {
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else if (Buffer.isBuffer(req.body)) {
        body = JSON.parse(req.body.toString('utf8'));
      } else {
        body = req.body || {};
      }
    } catch (e) {
      return res.status(400).json({ error: 'invalid_json', detail: e.message });
    }
    const {
      email,
      school_name,
      school_size,
      contact_name,
      phone,
      notes,
      source
    } = body;

    // ---- Validate ----
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email_required' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (school_size && !['small', 'medium', 'large', 'unknown'].includes(school_size)) {
      return res.status(400).json({ error: 'invalid_school_size' });
    }

    // ---- Supabase client (service role) ----
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- Call RPC ----
    const { data, error } = await supabase.rpc('join_waitlist', {
      p_email: email.trim().toLowerCase(),
      p_school_name: school_name || null,
      p_school_size: school_size || 'unknown',
      p_contact_name: contact_name || null,
      p_phone: phone || null,
      p_notes: notes || null,
      p_source: source || 'marketing'
    });

    if (error) {
      console.error('[waitlist/join] RPC error:', error);
      return res.status(500).json({ error: 'rpc_error', detail: error.message });
    }

    if (!data?.success) {
      return res.status(400).json({ error: data?.error || 'unknown' });
    }

    // ---- Send confirm email (don't block response if fails) ----
    if (!data.duplicate) {
      try {
        const tpl = emailTemplates.waitlistConfirm({
          email: email.trim(),
          schoolName: school_name || ''
        });
        await sendEmail({
          to: email.trim(),
          subject: tpl.subject,
          html: tpl.html
        });
      } catch (emailErr) {
        // Email failure shouldn't fail signup
        console.error('[waitlist/join] email send failed:', emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      duplicate: !!data.duplicate,
      message: data.duplicate
        ? 'อีเมลนี้อยู่ในคิวอยู่แล้ว เราจะแจ้งคุณเมื่อเปิดให้ใช้งาน'
        : 'จองคิวสำเร็จ! ตรวจสอบอีเมลเพื่อยืนยัน'
    });
  } catch (err) {
    console.error('[waitlist/join] error:', err);
    return res.status(500).json({ error: 'server_error', detail: err.message });
  }
};
