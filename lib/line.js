// ==========================================================================
// lib/line.js
// Shared LINE Messaging API helpers (server-side ONLY).
//
// Each school uses its OWN LINE Official Account. Credentials live in
// schools.line_settings (jsonb):
//   {
//     "channel_access_token": "...",  // LINE Developers → Messaging API
//     "channel_id": "...",
//     "channel_secret": "...",        // used to verify webhook signatures
//     "enabled": true,
//     "default_template": "...",      // legacy attendance template (optional)
//     "features": { "bill_issued": false, ... },   // per-event toggle (default ON)
//     "templates": { "bill_issued": "..." }        // per-event custom template (optional)
//   }
//
// Quota note: push/multicast consume the school's OWN LINE quota
// (~300 free messages/month per OA). replyText (webhook replies) is FREE
// and does NOT count against the quota.
// ==========================================================================

const LINE_API = 'https://api.line.me';

// ---- config ---------------------------------------------------------------
// Returns schools.line_settings (jsonb) or null.
async function getLineConfig(supabaseAdmin, schoolId) {
  const { data } = await supabaseAdmin
    .from('schools')
    .select('line_settings')
    .eq('id', schoolId)
    .single();
  return (data && data.line_settings) || null;
}

// ---- low-level senders ------------------------------------------------------
async function lineApi(token, path, payload) {
  try {
    const r = await fetch(LINE_API + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return { ok: false, status: r.status, error: `${r.status}: ${errText.slice(0, 200)}` };
    }
    return { ok: true, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

// Push 1 text message to 1 LINE user (counts against the school's quota).
function pushText(token, toUserId, text) {
  return lineApi(token, '/v2/bot/message/push', {
    to: toUserId,
    messages: [{ type: 'text', text }]
  });
}

// Multicast the SAME text to many LINE users — chunks of 500 (LINE's limit).
async function multicastText(token, userIds, text) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return { ok: true, sent: 0, error: null };

  let sent = 0;
  const errors = [];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const r = await lineApi(token, '/v2/bot/message/multicast', {
      to: chunk,
      messages: [{ type: 'text', text }]
    });
    if (r.ok) sent += chunk.length;
    else errors.push(r.error || ('HTTP ' + r.status));
  }
  return { ok: errors.length === 0, sent, error: errors.length ? errors.join(' | ') : null };
}

// Reply to a webhook event. Replies are FREE — no quota cost for the school.
function replyText(token, replyToken, text) {
  return lineApi(token, '/v2/bot/message/reply', {
    replyToken,
    messages: [{ type: 'text', text }]
  });
}

// ---- templates --------------------------------------------------------------
// Replace {placeholders} with vars values; unknown/empty vars become ''.
function fillTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k) =>
    (vars && vars[k] !== undefined && vars[k] !== null) ? String(vars[k]) : ''
  );
}

// Thousand separators for THB amounts: 12345.5 → "12,345.50", 12345 → "12,345"
function fmtAmount(n) {
  const num = Number(n);
  if (!isFinite(num)) return n === undefined || n === null ? '' : String(n);
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Default Thai message builders, keyed by event. Optional parts are only
// included when the data is present.
const DEFAULT_TEMPLATES = {
  bill_issued: (v) =>
    '💰 แจ้งค่าเทอม ' + (v.student_name || '') +
    '\nยอด ' + (v.amount || '') + ' บาท' +
    (v.due_date ? '\nกำหนดชำระ ' + v.due_date : '') +
    '\nดูบิลและชำระได้ในระบบของโรงเรียน',

  payment_approved: (v) =>
    '✅ ได้รับชำระเงินของ ' + (v.student_name || '') + ' แล้ว' +
    '\nยอด ' + (v.amount || '') + ' บาท' +
    (v.receipt_number ? '\nเลขที่ใบเสร็จ ' + v.receipt_number : '') +
    '\nขอบคุณค่ะ',

  homework_posted: (v) =>
    '📚 การบ้านใหม่' + (v.subject ? ' วิชา ' + v.subject : '') +
    '\n' + (v.title || '') +
    (v.due_date ? '\nกำหนดส่ง ' + v.due_date : ''),

  leave_status: (v) => v.approved
    ? ('📝 ใบลาของ ' + (v.student_name || '') + ' ได้รับการอนุมัติแล้ว' +
       (v.start_date && v.end_date ? ' (' + v.start_date + ' - ' + v.end_date + ')' : ''))
    : ('📝 ใบลาของ ' + (v.student_name || '') + ' ไม่ได้รับการอนุมัติ กรุณาติดต่อครูประจำชั้น'),

  announcement: (v) =>
    '📢 ' + (v.title || '') + (v.body ? '\n' + v.body : ''),

  broadcast: (v) => String(v.message || '')
};

// School's custom template (line_settings.templates[event]) wins when set;
// otherwise the default Thai builder above.
function renderTemplate(event, settings, vars) {
  const custom = settings && settings.templates && settings.templates[event];
  if (custom && typeof custom === 'string') return fillTemplate(custom, vars);
  const builder = DEFAULT_TEMPLATES[event];
  return builder ? builder(vars || {}) : '';
}

// ---- logging ----------------------------------------------------------------
// Best-effort insert into notification_log — NEVER throws.
async function logNotification(supabaseAdmin, { school_id, feature, recipient_count, message, status, sent_by, error }) {
  try {
    const { error: insErr } = await supabaseAdmin.from('notification_log').insert({
      school_id,
      feature: feature || 'unknown',
      recipient_count: recipient_count || 0,
      message: String(message || '').slice(0, 500),
      status: status || 'sent',
      sent_by: sent_by || null,
      error: error || null
    });
    if (insErr) console.error('[lib/line] logNotification insert error:', insErr.message);
  } catch (e) {
    console.error('[lib/line] logNotification failed:', e.message);
  }
}

module.exports = {
  getLineConfig,
  pushText,
  multicastText,
  replyText,
  fillTemplate,
  fmtAmount,
  DEFAULT_TEMPLATES,
  renderTemplate,
  logNotification
};
