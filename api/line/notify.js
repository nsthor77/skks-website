// ==========================================================================
// /api/line/notify.js
// ONE generic LINE notification endpoint for all features.
// Uses the school's OWN LINE OA credentials from schools.line_settings.
// Parents are linked at students.custom_data.parent_line_user_id (+ _id2).
//
// POST  { event, data }   Auth: Bearer <supabase user JWT> (teacher+)
//
// Events:
//   bill_issued      data { student_ids:[], amount, due_date?, description? }
//   payment_approved data { student_id, amount, receipt_number? }
//   homework_posted  data { title, due_date?, classroom?, grade?, subject? }
//   leave_status     data { student_id, approved, leave_type?, start_date?, end_date? }
//   announcement     data { title, body? }
//   broadcast        data { message }            (also accepts top-level { message })
//
// Returns 200 { success, sent, no_line } — NEVER 500 for partial LINE
// failures (they are logged to notification_log with status 'partial').
// When LINE is disabled / feature toggled off → 200 { sent:0, skipped }.
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');
const {
  getLineConfig, pushText, multicastText,
  renderTemplate, fmtAmount, logNotification
} = require('../../lib/line');

const ALLOWED_ROLES = ['teacher', 'staff', 'admin', 'owner', 'developer'];

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

    let event = body.event;
    let data = body.data || {};
    // Accept the simple sender shape: { message } / { event:'broadcast', message }
    if (!event && body.message) event = 'broadcast';
    if (event === 'broadcast' && !data.message && body.message) data = { ...data, message: body.message };

    const KNOWN = ['bill_issued', 'payment_approved', 'homework_posted', 'leave_status', 'announcement', 'broadcast'];
    if (!event || !KNOWN.includes(event)) {
      return res.status(400).json({ error: 'unknown_event', allowed: KNOWN });
    }

    // ---- Supabase (service role) ----
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- Verify role + school ----
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const schoolId = profile.school_id;
    if (!schoolId) return res.status(403).json({ error: 'no_school' });

    // ---- LINE settings (per school) ----
    const settings = (await getLineConfig(supabase, schoolId)) || {};
    if (!settings.enabled || !settings.channel_access_token) {
      return res.status(200).json({ success: true, sent: 0, no_line: 0, skipped: 'line_disabled' });
    }
    if (settings.features && settings.features[event] === false) {
      return res.status(200).json({ success: true, sent: 0, no_line: 0, skipped: 'feature_disabled' });
    }
    const token = settings.channel_access_token;

    // ---- helpers ----
    const STUDENT_COLS = 'id, first_name_th, last_name_th, first_name, last_name, nickname, classroom, grade, custom_data';
    const activeStudents = () => supabase
      .from('students')
      .select(STUDENT_COLS)
      .eq('school_id', schoolId)
      .or('status.eq.active,status.is.null');   // coalesce(status,'active') = 'active'

    const studentName = (s) =>
      ((s.first_name_th || s.first_name || '') + ' ' + (s.last_name_th || s.last_name || '')).trim()
      || s.nickname || 'นักเรียน';

    const linkedIds = (s) => [
      s.custom_data && s.custom_data.parent_line_user_id,
      s.custom_data && s.custom_data.parent_line_user_id2
    ].filter(Boolean);

    let sent = 0;        // messages delivered to LINE OK
    let noLine = 0;      // students with no linked LINE account
    const errors = [];
    let logMessage = '';

    // ---- per-student PUSH events ----
    if (event === 'bill_issued') {
      const ids = Array.isArray(data.student_ids) ? data.student_ids.filter(Boolean)
                : (data.student_id ? [data.student_id] : []);
      if (!ids.length) return res.status(400).json({ error: 'missing_fields', need: 'data.student_ids' });

      const { data: students } = await activeStudents().in('id', ids);
      for (const s of (students || [])) {
        const linked = [...new Set(linkedIds(s))];
        if (!linked.length) { noLine++; continue; }
        const text = renderTemplate('bill_issued', settings, {
          student_name: studentName(s),
          amount: fmtAmount(data.amount),
          due_date: data.due_date || '',
          description: data.description || ''
        });
        logMessage = text;
        for (const uid of linked) {
          const r = await pushText(token, uid, text);
          if (r.ok) sent++; else errors.push(r.error);
        }
      }
    }

    else if (event === 'payment_approved' || event === 'leave_status') {
      if (!data.student_id) return res.status(400).json({ error: 'missing_fields', need: 'data.student_id' });

      const { data: students } = await activeStudents().eq('id', data.student_id).limit(1);
      const s = (students || [])[0];
      if (!s) return res.status(404).json({ error: 'student_not_found' });

      const linked = [...new Set(linkedIds(s))];
      if (!linked.length) {
        noLine = 1;
      } else {
        const vars = (event === 'payment_approved')
          ? {
              student_name: studentName(s),
              amount: fmtAmount(data.amount),
              receipt_number: data.receipt_number || ''
            }
          : {
              student_name: studentName(s),
              approved: data.approved === true || data.approved === 'true' || data.status === 'approved',
              leave_type: data.leave_type || '',
              start_date: data.start_date || '',
              end_date: data.end_date || ''
            };
        const text = renderTemplate(event, settings, vars);
        logMessage = text;
        for (const uid of linked) {
          const r = await pushText(token, uid, text);
          if (r.ok) sent++; else errors.push(r.error);
        }
      }
    }

    // ---- group MULTICAST events (same text for everyone) ----
    else if (event === 'homework_posted' || event === 'announcement' || event === 'broadcast') {
      let q = activeStudents();
      if (event === 'homework_posted') {
        if (data.classroom) q = q.eq('classroom', data.classroom);
        if (data.grade) q = q.eq('grade', data.grade);
      }
      const { data: students } = await q;

      const allIds = [];
      for (const s of (students || [])) {
        const linked = linkedIds(s);
        if (!linked.length) { noLine++; continue; }
        allIds.push(...linked);
      }
      const userIds = [...new Set(allIds)];   // dedupe (siblings share a parent)

      const vars = (event === 'homework_posted')
        ? { title: data.title || '', subject: data.subject || '', due_date: data.due_date || '', classroom: data.classroom || '', grade: data.grade || '' }
        : (event === 'announcement')
          ? { title: data.title || '', body: data.body || '' }
          : { message: data.message || '' };

      const text = renderTemplate(event, settings, vars);
      logMessage = text;
      if (!text.trim()) return res.status(400).json({ error: 'missing_fields', need: 'message/title' });

      if (userIds.length) {
        const r = await multicastText(token, userIds, text);
        sent = r.sent;
        if (r.error) errors.push(r.error);
      }
    }

    // ---- log + respond (200 even on partial failures) ----
    const status = errors.length ? (sent > 0 ? 'partial' : 'failed') : 'sent';
    await logNotification(supabase, {
      school_id: schoolId,
      feature: event,
      recipient_count: sent,
      message: logMessage,
      status,
      sent_by: userId,
      error: errors.length ? errors.slice(0, 3).join(' | ') : null
    });

    return res.status(200).json({
      success: true,
      sent,
      no_line: noLine,
      ...(errors.length ? { partial: true, error: errors.slice(0, 3).join(' | ') } : {})
    });
  } catch (err) {
    console.error('[line/notify] error:', err);
    return res.status(500).json({ error: 'server_error', detail: err.message });
  }
};
