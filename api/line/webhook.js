// ==========================================================================
// /api/line/webhook.js
// LINE webhook for PARENT SELF-LINKING. Each school points its own LINE OA
// webhook here:  https://app.panyaschoolkit.com/api/line/webhook?school=<uuid>
//
// Parents add the school's LINE OA as a friend, then type:
//   "<เลขประจำตัวนักเรียน> <วันเกิด>"   e.g.  12345 25/10/2015
// → we match students.student_number + birth_date (Buddhist years OK) and
//   store this LINE userId at students.custom_data.parent_line_user_id
//   (second parent → parent_line_user_id2). "ยกเลิก <เลขประจำตัว>" unlinks.
//
// Everything here uses replyText only → replies are FREE (no quota cost).
// LINE requires 2xx — we ALWAYS return 200, even on bad signature/errors.
//
// Signature: x-line-signature = base64(HMAC-SHA256(channel_secret, rawBody))
// → bodyParser is DISABLED so we can hash the exact raw bytes.
// ==========================================================================

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { replyText } = require('../../lib/line');

const MSG_WELCOME =
  'สวัสดีค่ะ 🙏 ขอบคุณที่เพิ่มเพื่อน\n' +
  'หากต้องการรับแจ้งเตือนของบุตรหลาน พิมพ์:\n' +
  'เลขประจำตัวนักเรียน เว้นวรรค วันเกิด\n' +
  'เช่น: 12345 25/10/2015';

const MSG_HELP =
  'รูปแบบไม่ถูกต้องค่ะ 🙏\n' +
  'หากต้องการรับแจ้งเตือนของบุตรหลาน พิมพ์:\n' +
  'เลขประจำตัวนักเรียน เว้นวรรค วันเกิด\n' +
  'เช่น: 12345 25/10/2015\n\n' +
  'หากต้องการยกเลิกการแจ้งเตือน พิมพ์:\n' +
  'ยกเลิก ตามด้วยเลขประจำตัว เช่น: ยกเลิก 12345';

const MSG_NOT_FOUND =
  'ไม่พบนักเรียน หรือวันเกิดไม่ตรงกับข้อมูลในระบบค่ะ\n' +
  'กรุณาตรวจสอบเลขประจำตัวและวันเกิดอีกครั้ง\n' +
  '(วันเกิดใช้รูปแบบ วัน/เดือน/ปี เช่น 25/10/2015 หรือ 25/10/2558)\n' +
  'หากยังไม่สำเร็จ กรุณาติดต่อโรงเรียนค่ะ';

const MSG_FULL =
  'บัญชี LINE สำหรับนักเรียนคนนี้ถูกผูกครบ 2 ท่านแล้วค่ะ\n' +
  'กรุณาติดต่อโรงเรียนหากต้องการเปลี่ยนแปลง';

module.exports = async (req, res) => {
  // LINE's "Verify" button and health checks → just say OK
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    // ---- raw body (signature must be computed over the exact bytes) ----
    const rawBody = await readRawBody(req);

    // ---- which school? (?school=<uuid> set by the school in LINE Developers) ----
    const schoolId = getSchoolParam(req);
    if (!schoolId) return res.status(200).json({ ok: true });

    // ---- load that school's LINE credentials ----
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: school } = await supabase
      .from('schools')
      .select('id, line_settings')
      .eq('id', schoolId)
      .single();

    const settings = (school && school.line_settings) || {};
    const secret = settings.channel_secret;
    const token = settings.channel_access_token;
    if (!secret || !token) return res.status(200).json({ ok: true });

    // ---- verify x-line-signature ----
    const sig = String(req.headers['x-line-signature'] || '');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    if (!valid) return res.status(200).json({ ok: true }); // LINE requires 2xx

    // ---- parse + handle events ----
    let body;
    try { body = JSON.parse(rawBody.toString('utf8')); }
    catch (e) { return res.status(200).json({ ok: true }); }

    for (const ev of (body.events || [])) {
      try {
        await handleEvent(supabase, schoolId, token, ev);
      } catch (e) {
        console.error('[line/webhook] event error:', e.message);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[line/webhook] error:', err);
    return res.status(200).json({ ok: true }); // never non-2xx to LINE
  }
};

// Vercel: disable the default JSON body parser — the signature must be
// computed over the raw request bytes. (Must come AFTER the handler export.)
module.exports.config = { api: { bodyParser: false } };

// ---- helpers ---------------------------------------------------------------

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getSchoolParam(req) {
  if (req.query && req.query.school) return String(req.query.school);
  try {
    const u = new URL(req.url, 'http://localhost');
    return u.searchParams.get('school') || null;
  } catch (e) { return null; }
}

// 'd/m/yyyy' or 'yyyy-mm-dd' (also d-m-yyyy / d.m.yyyy). Buddhist year > 2400
// → minus 543. Returns ISO 'yyyy-mm-dd' or null.
function parseBirthDate(str) {
  const s = String(str || '').trim();
  let d, m, y;

  let match = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);   // d/m/yyyy
  if (match) { d = +match[1]; m = +match[2]; y = +match[3]; }
  else {
    match = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);     // yyyy-mm-dd
    if (match) { y = +match[1]; m = +match[2]; d = +match[3]; }
    else return null;
  }

  if (y > 2400) y -= 543; // Buddhist → Gregorian
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function studentDisplayName(s) {
  return ((s.first_name_th || s.first_name || '') + ' ' + (s.last_name_th || s.last_name || '')).trim()
    || s.nickname || 'นักเรียน';
}

async function findStudent(supabase, schoolId, studentNumber) {
  const { data } = await supabase
    .from('students')
    .select('id, first_name_th, last_name_th, first_name, last_name, nickname, birth_date, custom_data')
    .eq('school_id', schoolId)
    .eq('student_number', String(studentNumber))
    .or('status.eq.active,status.is.null')
    .limit(1);
  return (data && data[0]) || null;
}

// Principal (ผอ.) self-linking: verify the code against
// schools.line_settings->>'principal_link_code', then append this LINE userId
// into line_settings.principal_line_user_ids (deduped, max 5).
// Replies only (FREE — no quota cost). Never throws (caller catches anyway).
async function handlePrincipalLink(supabase, schoolId, token, ev, userId, code) {
  const { data: school } = await supabase
    .from('schools')
    .select('line_settings')
    .eq('id', schoolId)
    .single();

  const settings = (school && school.line_settings) || {};
  const expected = String(settings.principal_link_code || '').trim().toUpperCase();

  if (!expected || expected !== code) {
    await replyText(token, ev.replyToken, 'รหัสเชื่อมต่อไม่ถูกต้อง');
    return;
  }

  const ids = Array.isArray(settings.principal_line_user_ids)
    ? settings.principal_line_user_ids.filter(Boolean)
    : [];

  if (!ids.includes(userId)) {
    if (ids.length >= 5) {
      await replyText(token, ev.replyToken,
        'มีผู้บริหารเชื่อมต่อครบ 5 บัญชีแล้วค่ะ กรุณาติดต่อเจ้าของโรงเรียน');
      return;
    }
    ids.push(userId);
    const newSettings = Object.assign({}, settings, { principal_line_user_ids: ids });
    const { error: upErr } = await supabase
      .from('schools')
      .update({ line_settings: newSettings })
      .eq('id', schoolId);
    if (upErr) {
      console.error('[line/webhook] principal link error:', upErr.message);
      await replyText(token, ev.replyToken, 'ขออภัยค่ะ ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง');
      return;
    }
  }

  await replyText(token, ev.replyToken,
    '✅ เชื่อมบัญชีผู้บริหารสำเร็จ ระบบจะส่งรายงานสรุปให้ทาง LINE นี้');
}

async function handleEvent(supabase, schoolId, token, ev) {
  // ---- new friend → welcome + how to link ----
  if (ev.type === 'follow' && ev.replyToken) {
    await replyText(token, ev.replyToken, MSG_WELCOME);
    return;
  }

  // ---- text message → link / unlink / help ----
  if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text' || !ev.replyToken) return;
  const userId = ev.source && ev.source.userId;
  if (!userId) return;

  const text = String(ev.message.text || '').trim();

  // "ผอ <CODE>" / "ADMIN <CODE>" → link this LINE account as a principal
  // (ผู้บริหาร) who receives the monthly summary report. The code comes from
  // ensure_principal_link_code() shown on pages/monthly-report.html.
  // MUST run before the generic "<number> <birthdate>" parent-link matcher.
  const principalMatch = text.match(/^(?:ผอ|ADMIN)[\s-]*([A-Z0-9]{6})$/i);
  if (principalMatch) {
    await handlePrincipalLink(supabase, schoolId, token, ev, userId, principalMatch[1].toUpperCase());
    return;
  }

  // "ยกเลิก <student_number>" → unlink this LINE account from that student
  const unlinkMatch = text.match(/^ยกเลิก\s+(\S+)$/);
  if (unlinkMatch) {
    const student = await findStudent(supabase, schoolId, unlinkMatch[1]);
    if (!student) {
      await replyText(token, ev.replyToken, MSG_NOT_FOUND);
      return;
    }
    const cd = Object.assign({}, student.custom_data || {});
    let removed = false;
    if (cd.parent_line_user_id === userId) { delete cd.parent_line_user_id; removed = true; }
    if (cd.parent_line_user_id2 === userId) { delete cd.parent_line_user_id2; removed = true; }
    if (!removed) {
      await replyText(token, ev.replyToken, 'บัญชี LINE นี้ไม่ได้ผูกกับนักเรียนเลขประจำตัวนี้ค่ะ');
      return;
    }
    await supabase.from('students').update({ custom_data: cd }).eq('id', student.id);
    await replyText(token, ev.replyToken,
      'ยกเลิกการรับแจ้งเตือนของ ' + studentDisplayName(student) + ' เรียบร้อยแล้วค่ะ');
    return;
  }

  // "<student_number> <birthdate>" → link this LINE account to the student
  const linkMatch = text.match(/^(\S+)\s+(\S+)$/);
  const birthIso = linkMatch ? parseBirthDate(linkMatch[2]) : null;
  if (!linkMatch || !birthIso) {
    await replyText(token, ev.replyToken, MSG_HELP);
    return;
  }

  const student = await findStudent(supabase, schoolId, linkMatch[1]);
  const dbBirth = student && student.birth_date ? String(student.birth_date).slice(0, 10) : null;
  if (!student || !dbBirth || dbBirth !== birthIso) {
    await replyText(token, ev.replyToken, MSG_NOT_FOUND);
    return;
  }

  const cd = Object.assign({}, student.custom_data || {});
  if (cd.parent_line_user_id === userId || cd.parent_line_user_id2 === userId) {
    await replyText(token, ev.replyToken,
      'บัญชี LINE นี้ผูกกับ ' + studentDisplayName(student) + ' ไว้แล้วค่ะ ✅');
    return;
  }
  if (!cd.parent_line_user_id) cd.parent_line_user_id = userId;
  else if (!cd.parent_line_user_id2) cd.parent_line_user_id2 = userId;
  else {
    await replyText(token, ev.replyToken, MSG_FULL);
    return;
  }

  const { error: upErr } = await supabase
    .from('students')
    .update({ custom_data: cd })
    .eq('id', student.id);

  if (upErr) {
    console.error('[line/webhook] link update error:', upErr.message);
    await replyText(token, ev.replyToken, 'ขออภัยค่ะ ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง');
    return;
  }

  await replyText(token, ev.replyToken,
    '✅ ผูกบัญชีกับ ' + studentDisplayName(student) + ' เรียบร้อย\n' +
    'จะได้รับแจ้งเตือน เช็คชื่อ/ค่าเทอม/การบ้าน ทาง LINE นี้ค่ะ');
}
