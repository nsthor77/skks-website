// ==========================================================================
// /api/line/notify-attendance.js
// Sprint 12: Send LINE message to parent when student attendance is marked.
//
// Per-school LINE Messaging API config stored in schools.line_settings (jsonb):
//   {
//     "channel_access_token": "...",  // From LINE Developers Console
//     "enabled": true,
//     "default_template": "..."        // optional
//   }
//
// Body:
//   { attendance_id, student_id, status }
//
// Returns:
//   { success, line_message_id?, error? }
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    // ---- Auth: require user JWT ----
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

    const { attendance_id, student_id, status } = body;
    if (!attendance_id || !student_id || !status) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // ---- Supabase (service role) ----
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- Verify staff role + fetch context ----
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (!profile || !['staff','owner','developer'].includes(profile.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // ---- Fetch school LINE settings ----
    const { data: school } = await supabase
      .from('schools')
      .select('id, name_th, name_en, line_settings')
      .eq('id', profile.school_id)
      .single();

    const lineSettings = school?.line_settings || {};
    if (!lineSettings.enabled || !lineSettings.channel_access_token) {
      // School doesn't have LINE enabled — mark as skipped
      await supabase.rpc('update_line_send_status', {
        p_attendance_id: attendance_id,
        p_status: 'skipped',
        p_error: 'line_not_configured'
      });
      return res.status(200).json({ success: false, skipped: true, reason: 'line_not_configured' });
    }

    // ---- Fetch student + parent ----
    const { data: student } = await supabase
      .from('students')
      .select('id, first_name_th, last_name_th, nickname, parent1_phone, parent2_phone, classroom, custom_data')
      .eq('id', student_id)
      .single();

    if (!student) {
      return res.status(404).json({ error: 'student_not_found' });
    }

    // Resolve LINE User ID from custom_data.line_user_id (parents register via LINE Login)
    const parentLineUserId =
      student.custom_data?.parent_line_user_id ||
      student.custom_data?.line_user_id ||
      null;

    if (!parentLineUserId) {
      await supabase.rpc('update_line_send_status', {
        p_attendance_id: attendance_id,
        p_status: 'skipped',
        p_error: 'no_parent_line_id'
      });
      return res.status(200).json({ success: false, skipped: true, reason: 'no_parent_line_id' });
    }

    // ---- Build message ----
    const studentName = ((student.first_name_th || '') + ' ' + (student.last_name_th || '')).trim() || student.nickname || 'นักเรียน';
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const statusTextMap = {
      present: '✅ มาเรียนเรียบร้อย',
      absent:  '❗ ขาดเรียน',
      late:    '⏰ มาสาย',
      excused: '📝 ขาด (มีใบลา)',
      leave:   '🏠 ลา',
      sick:    '🤒 ลาป่วย'
    };
    const statusText = statusTextMap[status] || status;

    let message;
    if (lineSettings.default_template) {
      message = lineSettings.default_template
        .replace('{student_name}', studentName)
        .replace('{action}', statusText)
        .replace('{time}', timeStr)
        .replace('{classroom}', student.classroom || '');
    } else if (status === 'absent') {
      // Dedicated safety message for absences (no custom template set)
      message = `🎓 ${school.name_th || school.name_en || 'PanyaSchoolKit'}\n\n❗ แจ้งเตือน: ${studentName} (ห้อง ${student.classroom || '—'}) ไม่มาโรงเรียนวันนี้ (ขาดเรียน)\nหากบุตรหลานของท่านออกจากบ้านมาแล้ว หรือมีข้อสงสัย กรุณาติดต่อครูประจำชั้นทันที`;
    } else {
      message = `🎓 ${school.name_th || school.name_en || 'PanyaSchoolKit'}\n\n${studentName} (ห้อง ${student.classroom || '—'})\n${statusText}\nเวลา ${timeStr}`;
    }

    // ---- Send via LINE Messaging API ----
    const lineResp = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + lineSettings.channel_access_token
      },
      body: JSON.stringify({
        to: parentLineUserId,
        messages: [{ type: 'text', text: message }]
      })
    });

    if (!lineResp.ok) {
      const errText = await lineResp.text();
      await supabase.rpc('update_line_send_status', {
        p_attendance_id: attendance_id,
        p_status: 'failed',
        p_error: `${lineResp.status}: ${errText.slice(0, 200)}`
      });
      return res.status(200).json({ success: false, error: 'line_api_failed', status: lineResp.status, detail: errText });
    }

    const lineData = await lineResp.json();
    await supabase.rpc('update_line_send_status', {
      p_attendance_id: attendance_id,
      p_status: 'sent',
      p_message_id: lineData?.sentMessages?.[0]?.id || null
    });

    return res.status(200).json({
      success: true,
      line_message_id: lineData?.sentMessages?.[0]?.id
    });
  } catch (err) {
    console.error('[line/notify-attendance] error:', err);
    return res.status(500).json({ error: 'server_error', detail: err.message });
  }
};
