// ==========================================================================
// /api/schedule/timetable-pdf.js
// Sprint 14.5: Class / Teacher timetable PDF
//
// Query (one of):
//   ?classroom=<text>&year=<text>&term=<text>     (class view)
//   ?teacher_id=<uuid>&year=<text>&term=<text>    (teacher view)
// Auth: requires user JWT (Bearer token)
// Returns: application/pdf (A4 landscape — weekly grid)
// ==========================================================================

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');

const FONT_URLS = {
  regular: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Regular.ttf',
  bold:    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Bold.ttf',
  medium:  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Medium.ttf'
};
const FONT_LOCAL_PATHS = {
  regular: path.join(process.cwd(), 'lib/fonts/Sarabun-Regular.ttf'),
  bold:    path.join(process.cwd(), 'lib/fonts/Sarabun-Bold.ttf'),
  medium:  path.join(process.cwd(), 'lib/fonts/Sarabun-Medium.ttf')
};
const fontMemoryCache = {};

async function loadFont(name) {
  if (fontMemoryCache[name]) return fontMemoryCache[name];
  try {
    if (fs.existsSync(FONT_LOCAL_PATHS[name])) {
      const buf = fs.readFileSync(FONT_LOCAL_PATHS[name]);
      fontMemoryCache[name] = buf;
      return buf;
    }
  } catch {}
  const tmpPath = `/tmp/sarabun-${name}.ttf`;
  try {
    if (fs.existsSync(tmpPath)) {
      const buf = fs.readFileSync(tmpPath);
      fontMemoryCache[name] = buf;
      return buf;
    }
  } catch {}
  const res = await fetch(FONT_URLS[name]);
  if (!res.ok) throw new Error(`Font download failed: ${name}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fontMemoryCache[name] = buf;
  try { fs.writeFileSync(tmpPath, buf); } catch {}
  return buf;
}

async function setupFonts(doc) {
  const [reg, bold, med] = await Promise.all([loadFont('regular'), loadFont('bold'), loadFont('medium')]);
  doc.registerFont('Sarabun', reg);
  doc.registerFont('Sarabun-Bold', bold);
  doc.registerFont('Sarabun-Medium', med);
}

const COLOR = {
  text: '#0F1A36', textMuted: '#4B5670', textLight: '#7B8497',
  primary: '#1E40AF', primaryDk: '#1E3A8A', primaryBg: '#DBE5FF', primaryLight: '#EEF3FF',
  border: '#D8DEE9', breakBg: '#FFF7E6', breakBorder: '#F59E0B', breakFg: '#92400E',
  panelBg: '#EBF0FA'
};

// A4 landscape
const PAGE = { width: 841.89, height: 595.28, margin: 30 };
const CONTENT_W = PAGE.width - 2 * PAGE.margin;

const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAYS_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

function n(v) { return (v === null || v === undefined || v === '') ? '—' : String(v); }
function tm(s) { return (s || '').toString().slice(0, 5); }

// ============================================================
// Build PDF
// ============================================================
async function buildPDF({ school, mode, title, subtitle, periods, slots, year, term, res }) {
  const doc = new PDFDocument({
    size: 'A4', layout: 'landscape', margin: PAGE.margin,
    info: {
      Title: `Timetable — ${title}`,
      Author: school?.name_th || 'PanyaSchoolKit',
      Subject: `Weekly Timetable ${year} Term ${term}`,
      Creator: 'PanyaSchoolKit'
    }
  });

  await setupFonts(doc);
  doc.font('Sarabun');
  doc.pipe(res);

  const x0 = PAGE.margin;
  let y = PAGE.margin;

  // ============ HEADER ============
  doc.rect(x0, y, CONTENT_W, 60).fill(COLOR.primaryDk);
  doc.fillColor('#FFFFFF').font('Sarabun-Bold').fontSize(18)
     .text(school?.name_th || school?.name_en || 'PanyaSchoolKit', x0 + 18, y + 10);
  doc.font('Sarabun-Medium').fontSize(11)
     .text(`Weekly Timetable · ตารางเรียน · ${title}`, x0 + 18, y + 36);
  doc.font('Sarabun').fontSize(10).fillColor('#FFFFFF')
     .text(`${subtitle || ''}`, x0 + 18, y + 50);

  // Top-right meta
  doc.font('Sarabun-Medium').fontSize(11).fillColor('#FFFFFF')
     .text(`Year ${n(year)} · Term ${n(term)}`, x0, y + 18, { width: CONTENT_W - 18, align: 'right' });
  doc.font('Sarabun').fontSize(9)
     .text(new Date().toLocaleDateString('th-TH'), x0, y + 36, { width: CONTENT_W - 18, align: 'right' });

  y += 76;

  // ============ TIMETABLE GRID ============
  // Layout: left col = period info (110), 5 day cols equal share
  const periodColW = 110;
  const dayColW = (CONTENT_W - periodColW) / DAYS_EN.length;

  // Day header row
  const headerH = 32;
  doc.fillColor(COLOR.text).font('Sarabun-Bold').fontSize(11);
  doc.rect(x0, y, periodColW, headerH).fillAndStroke(COLOR.panelBg, COLOR.border);
  doc.fillColor(COLOR.textMuted).font('Sarabun-Medium').fontSize(10)
     .text('คาบ / Period', x0, y + 11, { width: periodColW, align: 'center' });

  for (let i = 0; i < DAYS_EN.length; i++) {
    const cx = x0 + periodColW + i * dayColW;
    doc.rect(cx, y, dayColW, headerH).fillAndStroke(COLOR.primaryBg, COLOR.border);
    doc.fillColor(COLOR.primaryDk).font('Sarabun-Bold').fontSize(11)
       .text(DAYS_TH[i] + ' / ' + DAYS_EN[i], cx, y + 10, { width: dayColW, align: 'center' });
  }
  y += headerH;

  // Period rows
  const rowH = Math.max(46, Math.min(70, Math.floor((PAGE.height - PAGE.margin - y - 30) / Math.max(1, periods.length))));

  doc.fontSize(9);
  for (const p of periods) {
    if (y + rowH > PAGE.height - PAGE.margin - 20) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: PAGE.margin });
      y = PAGE.margin;
    }

    const label = p.label || ('Period ' + p.period_number);

    // Period left column
    doc.rect(x0, y, periodColW, rowH).fillAndStroke(COLOR.panelBg, COLOR.border);
    doc.fillColor(COLOR.text).font('Sarabun-Medium').fontSize(10)
       .text(label, x0 + 4, y + 8, { width: periodColW - 8, align: 'center', lineBreak: false, ellipsis: true });
    doc.fillColor(COLOR.textLight).font('Sarabun').fontSize(9)
       .text(`${tm(p.start_time)}–${tm(p.end_time)}`, x0 + 4, y + 24, { width: periodColW - 8, align: 'center' });

    // Each day
    for (let i = 0; i < DAYS_EN.length; i++) {
      const day = i + 1;
      const cx = x0 + periodColW + i * dayColW;

      if (p.is_break) {
        doc.rect(cx, y, dayColW, rowH).fillAndStroke(COLOR.breakBg, COLOR.breakBorder);
        doc.fillColor(COLOR.breakFg).font('Sarabun-Medium').fontSize(9)
           .text(label, cx + 4, y + rowH / 2 - 6, { width: dayColW - 8, align: 'center' });
        continue;
      }

      const slot = slots.find(s => s.day_of_week === day && s.period_number === p.period_number);
      if (slot) {
        doc.rect(cx, y, dayColW, rowH).fillAndStroke('#FFFFFF', COLOR.border);
        // Top accent stripe (left-side blue)
        doc.rect(cx, y, 3, rowH).fill(COLOR.primary);

        // Mode-specific content
        let line1, line2, line3;
        if (mode === 'teacher') {
          // For teacher view: classroom (big) + subject + room
          line1 = n(slot.classroom);
          line2 = (slot.subject_code || '') + ' ' + (slot.subject_name || '');
          line3 = slot.room || '';
        } else {
          // For class view: subject (big) + teacher + room
          line1 = (slot.subject_code || '') + ' ' + (slot.subject_name || '');
          line2 = slot.teacher_name || '';
          line3 = slot.room || '';
        }

        doc.fillColor(COLOR.primaryDk).font('Sarabun-Bold').fontSize(11)
           .text(line1 || '—', cx + 8, y + 6, { width: dayColW - 14, lineBreak: false, ellipsis: true });
        doc.fillColor(COLOR.textMuted).font('Sarabun').fontSize(9)
           .text(line2 || '', cx + 8, y + 22, { width: dayColW - 14, lineBreak: false, ellipsis: true });
        if (line3) {
          doc.fillColor(COLOR.textLight).font('Sarabun').fontSize(8)
             .text('📍 ' + line3, cx + 8, y + 36, { width: dayColW - 14, lineBreak: false, ellipsis: true });
        }
      } else {
        doc.rect(cx, y, dayColW, rowH).fillAndStroke('#FAFAFA', COLOR.border);
        doc.fillColor(COLOR.textLight).font('Sarabun').fontSize(9)
           .text('—', cx, y + rowH / 2 - 6, { width: dayColW, align: 'center' });
      }
    }

    y += rowH;
  }

  // Footer
  const footY = PAGE.height - PAGE.margin - 12;
  doc.font('Sarabun').fontSize(8).fillColor(COLOR.textLight)
     .text(`Generated by PanyaSchoolKit · ${new Date().toLocaleDateString('th-TH')}`,
           x0, footY, { width: CONTENT_W, align: 'right' });

  doc.end();
}

// ============================================================
// Handler
// ============================================================
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!userJwt) return res.status(401).json({ error: 'unauthorized' });

    let userId;
    try {
      const segs = userJwt.split('.');
      const padded = segs[1] + '='.repeat((4 - segs[1].length % 4) % 4);
      const payload = JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      userId = payload.sub;
    } catch { return res.status(401).json({ error: 'invalid_jwt' }); }

    const { classroom, teacher_id, year, term } = req.query;
    if (!year || !term) return res.status(400).json({ error: 'missing_year_term' });
    if (!classroom && !teacher_id) return res.status(400).json({ error: 'need_classroom_or_teacher' });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { autoRefreshToken: false, persistSession: false } }
    );

    let data, mode, title, subtitle;
    if (teacher_id) {
      const { data: r, error } = await supabase.rpc('get_teacher_timetable', {
        p_teacher_id: teacher_id, p_academic_year: year, p_term: term
      });
      if (error) return res.status(500).json({ error: 'rpc_failed', detail: error.message });
      if (!r || r.error) return res.status(404).json({ error: r?.error || 'no_data' });
      data = r;
      mode = 'teacher';
      const t = r.teacher || {};
      const nameTh = ((t.first_name_th || '') + ' ' + (t.last_name_th || '')).trim();
      const nameEn = ((t.first_name_en || '') + ' ' + (t.last_name_en || '')).trim();
      title = nameTh || nameEn || 'Teacher';
      subtitle = nameTh && nameEn ? nameEn : '';
    } else {
      const { data: r, error } = await supabase.rpc('get_class_timetable', {
        p_classroom: classroom, p_academic_year: year, p_term: term
      });
      if (error) return res.status(500).json({ error: 'rpc_failed', detail: error.message });
      if (!r || r.error) return res.status(404).json({ error: r?.error || 'no_data' });
      data = r;
      mode = 'class';
      title = `Class ${classroom}`;
      subtitle = '';
    }

    // Fetch school info via service role for header
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('school_id').eq('id', userId).single();
    const { data: school } = profile?.school_id
      ? await supabaseAdmin.from('schools').select('id, name_th, name_en').eq('id', profile.school_id).single()
      : { data: null };

    const fnamePart = teacher_id ? `teacher-${teacher_id}` : `class-${classroom}`;
    const fname = `timetable-${fnamePart}-${year}-${term}.pdf`.replace(/[\/\\]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);

    await buildPDF({
      school, mode, title, subtitle,
      periods: data.periods || [],
      slots: data.slots || [],
      year, term, res
    });

  } catch (err) {
    console.error('[timetable-pdf] error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'server_error', detail: err.message });
  }
};
