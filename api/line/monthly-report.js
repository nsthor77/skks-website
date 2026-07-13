// ==========================================================================
// /api/line/monthly-report.js
// Push the monthly summary report (รายงานประจำเดือน) to the school's linked
// principals (ผอ./ผู้บริหาร) via the school's OWN LINE OA.
//
// POST { year, month }        Auth: Bearer <supabase user JWT> (staff+)
//   year  = ค.ศ. (Gregorian), month = 1-12
//
// Principals link themselves in the OA chat with "ผอ <CODE>" (see
// /api/line/webhook.js); their LINE userIds live at
// schools.line_settings.principal_line_user_ids (max 5).
//
// The report numbers come from the get_monthly_report(p_year,p_month) RPC,
// called with an ANON client + the USER's JWT so auth.uid()/RLS see the real
// caller (same pattern as /api/grades/popor-1-pdf.js).
//
// Always returns 200 with { success, ... } — never a raw 500 to the page.
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');
const { pushText, fmtAmount, logNotification } = require('../../lib/line');

const ALLOWED_ROLES = ['staff', 'admin', 'owner', 'developer'];

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    // ---- Auth: require user JWT (same decode pattern as /api/line/notify.js) ----
    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!userJwt) return res.status(401).json({ error: 'unauthorized' });

    let userId;
    try {
      const segs = userJwt.split('.');
      const payloadB64 = segs[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      userId = payload.sub;
      if (!userId) throw new Error('no sub');
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired');
    } catch (e) {
      return res.status(401).json({ error: 'invalid_jwt', detail: e.message });
    }

    // ---- Parse body ----
    let body;
    try {
      if (typeof req.body === 'string') body = JSON.parse(req.body);
      else if (Buffer.isBuffer(req.body)) body = JSON.parse(req.body.toString('utf8'));
      else body = req.body || {};
    } catch (e) {
      return res.status(400).json({ error: 'invalid_json' });
    }

    const year = parseInt(body.year, 10);
    const month = parseInt(body.month, 10);
    if (!year || !month || month < 1 || month > 12 || year < 2000 || year > 2200) {
      return res.status(200).json({ success: false, error: 'เดือน/ปีไม่ถูกต้อง' });
    }

    // ---- Supabase (service role): verify role + load school ----
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const schoolId = profile.school_id;
    if (!schoolId) return res.status(403).json({ error: 'no_school' });

    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, name, name_th, name_en, line_settings')
      .eq('id', schoolId)
      .single();

    const settings = (school && school.line_settings) || {};
    if (!settings.enabled || !settings.channel_access_token) {
      return res.status(200).json({ success: false, error: 'ยังไม่ได้เชื่อมต่อ LINE OA' });
    }

    const principalIds = [...new Set(
      (Array.isArray(settings.principal_line_user_ids) ? settings.principal_line_user_ids : [])
        .filter(Boolean)
    )];
    if (!principalIds.length) {
      return res.status(200).json({
        success: false,
        error: 'ยังไม่มีผู้บริหารเชื่อมต่อ (ใช้รหัสเชื่อมในหน้ารายงาน)'
      });
    }

    // ---- Report numbers: ANON client + user's JWT → auth.uid() = real caller ----
    const supabaseAsUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        global: { headers: { Authorization: `Bearer ${userJwt}` } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    const { data: report, error: rpcErr } = await supabaseAsUser.rpc('get_monthly_report', {
      p_year: year,
      p_month: month
    });
    if (rpcErr || !report || report.error) {
      console.error('[line/monthly-report] rpc error:', rpcErr ? rpcErr.message : (report && report.error));
      return res.status(200).json({
        success: false,
        error: 'ดึงข้อมูลรายงานไม่สำเร็จ กรุณาลองใหม่'
      });
    }

    // ---- Format the Thai message (plain text, no markdown) ----
    const att = report.attendance || {};
    const money = report.money || {};
    const students = report.students || {};
    const hw = report.homework || {};
    const beh = report.behavior || {};

    const schoolName = (school && (school.name_th || school.name || school.name_en)) || 'โรงเรียน';
    const monthName = THAI_MONTHS[month - 1];
    const buddhistYear = year + 543;
    const rate = (att.attendance_rate === null || att.attendance_rate === undefined)
      ? '—' : att.attendance_rate + '%';

    const text =
      '📊 รายงานประจำเดือน ' + monthName + ' ' + buddhistYear + '\n' +
      '🏫 ' + schoolName + '\n\n' +
      '👥 นักเรียน ' + fmtAmount(students.total_active || 0) + ' คน (+' + fmtAmount(students.new_this_month || 0) + ' ใหม่)\n' +
      '✅ มาเรียนเฉลี่ย ' + rate + '\n' +
      '❌ ขาดรวม ' + fmtAmount(att.absent || 0) + ' ครั้ง\n' +
      '💰 รับชำระ ฿' + fmtAmount(money.paid_total || 0) + '\n' +
      '📄 ค้างชำระ ฿' + fmtAmount(money.unpaid_total || 0) + ' (' + fmtAmount(money.unpaid_count || 0) + ' รายการ)\n' +
      '📚 การบ้าน ' + fmtAmount(hw.assigned || 0) + ' ชิ้น ตรวจแล้ว ' + fmtAmount(hw.graded || 0) + '\n' +
      '⚠️ พฤติกรรมหัก ' + fmtAmount(beh.negative_records || 0) + ' ครั้ง\n\n' +
      'ดูรายละเอียด: https://app.panyaschoolkit.com/pages/monthly-report.html';

    // ---- Push to each linked principal (school's own quota) ----
    let sent = 0;
    const errors = [];
    for (const uid of principalIds) {
      const r = await pushText(settings.channel_access_token, uid, text);
      if (r.ok) sent++; else errors.push(r.error || ('HTTP ' + r.status));
    }

    await logNotification(supabaseAdmin, {
      school_id: schoolId,
      feature: 'monthly_report',
      recipient_count: sent,
      message: text,
      status: errors.length ? (sent > 0 ? 'partial' : 'failed') : 'sent',
      sent_by: userId,
      error: errors.length ? errors.slice(0, 3).join(' | ') : null
    });

    if (!sent) {
      return res.status(200).json({ success: false, error: 'ส่งไม่สำเร็จ กรุณาลองใหม่' });
    }
    return res.status(200).json({
      success: true,
      sent,
      ...(errors.length ? { partial: true, error: errors.slice(0, 3).join(' | ') } : {})
    });
  } catch (err) {
    console.error('[line/monthly-report] error:', err);
    return res.status(200).json({ success: false, error: 'ส่งไม่สำเร็จ กรุณาลองใหม่' });
  }
};
