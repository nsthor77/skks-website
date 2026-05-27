// ==========================================================================
// /api/grades/popor-5-pdf.js
// Sprint 13.7: ปพ.5 — แบบบันทึกผลการเรียนประจำรายวิชา (Class Grade Summary)
//
// Thai Ministry of Education official document format:
// - Per-classroom roster of all students with their grades for a subject+term
// - Used internally by school for grade records
//
// Query: ?classroom=<text>&year=<text>&term=<text>[&subject_code=<text>][&issue=true]
// Auth: requires user JWT (Bearer token); staff only
// Returns: application/pdf binary stream (A4 LANDSCAPE - more horizontal space)
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
  text: '#000000', textMuted: '#444444', textLight: '#808080',
  rule: '#000000', ruleLight: '#888888',
  panelBg: '#F5F5F5', headerBg: '#EAEAEA', stripe: '#FAFAFA',
  stamp: '#7A0000'
};

// LANDSCAPE A4
const PAGE = { width: 841.89, height: 595.28, margin: 32 };
const CONTENT_W = PAGE.width - 2 * PAGE.margin;

function fmtThaiDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch { return '—'; }
}
function n(v) { return (v === null || v === undefined || v === '') ? '—' : String(v); }
function num(v, decimals = 1) {
  if (v === null || v === undefined || v === '') return '—';
  const x = Number(v);
  if (Number.isNaN(x)) return '—';
  return x.toFixed(decimals);
}

// ============================================================
// PDF builder
// ============================================================
async function buildPDF({ data, serial, res }) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: PAGE.margin,
    info: {
      Title: `ปพ.5 — ${data.classroom} ${data.academic_year}/${data.term}`,
      Author: data.school?.name_th || 'PanyaSchoolKit',
      Subject: 'ปพ.5 แบบบันทึกผลการเรียนประจำรายวิชา',
      Creator: 'PanyaSchoolKit'
    }
  });

  await setupFonts(doc);
  doc.font('Sarabun');
  doc.pipe(res);

  const x0 = PAGE.margin;
  let y = PAGE.margin;

  // Outer decorative border
  doc.rect(x0 - 4, y - 4, CONTENT_W + 8, PAGE.height - 2 * PAGE.margin + 8)
     .lineWidth(1.5).strokeColor(COLOR.stamp).stroke();
  doc.rect(x0 - 2, y - 2, CONTENT_W + 4, PAGE.height - 2 * PAGE.margin + 4)
     .lineWidth(0.5).strokeColor(COLOR.stamp).stroke();

  // ============ HEADER ============
  // Serial on right
  doc.fillColor(COLOR.text).font('Sarabun').fontSize(10)
     .text(`เลขที่ ${n(serial?.serial_text || '—')}`, x0, y + 2, { width: CONTENT_W, align: 'right' });

  // Title
  doc.font('Sarabun-Bold').fontSize(16).fillColor(COLOR.text)
     .text('แบบบันทึกผลการเรียนประจำรายวิชา', x0, y + 18, { width: CONTENT_W, align: 'center' });
  doc.font('Sarabun-Medium').fontSize(10).fillColor(COLOR.textMuted)
     .text('Class Grade Summary · ปพ.5', x0, y + 40, { width: CONTENT_W, align: 'center' });
  y += 60;

  // School name
  doc.font('Sarabun-Bold').fontSize(12).fillColor(COLOR.text)
     .text(data.school?.name_th || data.school?.name_en || '—', x0, y, { width: CONTENT_W, align: 'center' });
  y += 18;

  // ============ META BAR ============
  doc.rect(x0, y, CONTENT_W, 30).fillAndStroke(COLOR.panelBg, COLOR.rule);

  doc.font('Sarabun').fontSize(9).fillColor(COLOR.textMuted);
  doc.text('ห้องเรียน (Classroom)', x0 + 10, y + 4);
  doc.text('ปีการศึกษา (Year)', x0 + 180, y + 4);
  doc.text('ภาคเรียน (Term)', x0 + 320, y + 4);
  doc.text('รายวิชา (Subject)', x0 + 440, y + 4);
  doc.text('จำนวนนักเรียน (Students)', x0 + 660, y + 4);

  doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text);
  doc.text(n(data.classroom), x0 + 10, y + 16);
  doc.text(n(data.academic_year), x0 + 180, y + 16);
  doc.text(n(data.term), x0 + 320, y + 16);
  doc.text(n(data.subject_code) + (data.subject_code ? ' — ' + n((data.subjects || [])[0]?.subject_name || '') : 'ทุกวิชา (All Subjects)'),
           x0 + 440, y + 16, { width: 220, lineBreak: false, ellipsis: true });
  doc.text(String((data.students || []).length), x0 + 660, y + 16);

  y += 40;

  // ============ TABLE ============
  // If subject_code is set: per-student row with [#, ID, Name, Mid, Final, Assignment, Total, Grade, Pass]
  // If subject_code is null: per-student row with [#, ID, Name] + dynamic columns per subject (grade only) + GPA
  const isSingleSubject = !!data.subject_code;

  // Index grades by (student_id, subject_code)
  const gradeByStuSub = {};
  for (const g of (data.grades || [])) {
    gradeByStuSub[`${g.student_id}|${g.subject_code}`] = g;
  }

  if (isSingleSubject) {
    const COLS = [
      { key: 'idx', label: 'ที่', w: 30, align: 'center' },
      { key: 'sid', label: 'รหัสประจำตัว', w: 80, align: 'center' },
      { key: 'name', label: 'ชื่อ - นามสกุล', w: 220, align: 'left' },
      { key: 'mid', label: 'กลางภาค', w: 70, align: 'center' },
      { key: 'final', label: 'ปลายภาค', w: 70, align: 'center' },
      { key: 'asgn', label: 'งาน', w: 60, align: 'center' },
      { key: 'total', label: 'รวม', w: 60, align: 'center' },
      { key: 'grade', label: 'เกรด', w: 60, align: 'center' },
      { key: 'pass', label: 'ผ่าน/ไม่ผ่าน', w: CONTENT_W - 30 - 80 - 220 - 70 - 70 - 60 - 60 - 60, align: 'center' }
    ];

    // Header
    let cx = x0;
    doc.rect(x0, y, CONTENT_W, 22).fillAndStroke(COLOR.headerBg, COLOR.rule);
    doc.font('Sarabun-Bold').fontSize(9).fillColor(COLOR.text);
    for (const c of COLS) {
      doc.text(c.label, cx + 2, y + 7, { width: c.w - 4, align: c.align });
      cx += c.w;
    }
    y += 22;

    for (let i = 0; i < data.students.length; i++) {
      if (y > PAGE.height - PAGE.margin - 90) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: PAGE.margin });
        doc.rect(x0 - 4, PAGE.margin - 4, CONTENT_W + 8, PAGE.height - 2 * PAGE.margin + 8)
           .lineWidth(1.5).strokeColor(COLOR.stamp).stroke();
        y = PAGE.margin;
        // re-draw header
        cx = x0;
        doc.rect(x0, y, CONTENT_W, 22).fillAndStroke(COLOR.headerBg, COLOR.rule);
        doc.font('Sarabun-Bold').fontSize(9).fillColor(COLOR.text);
        for (const c of COLS) {
          doc.text(c.label, cx + 2, y + 7, { width: c.w - 4, align: c.align });
          cx += c.w;
        }
        y += 22;
      }

      const stu = data.students[i];
      const g = gradeByStuSub[`${stu.id}|${data.subject_code}`] || {};

      if (i % 2 === 1) doc.rect(x0, y, CONTENT_W, 18).fill(COLOR.stripe);

      const fullTh = ((stu.first_name_th || '') + ' ' + (stu.last_name_th || '')).trim();
      const fullEn = ((stu.first_name_en || '') + ' ' + (stu.last_name_en || '')).trim();
      const name = fullTh || fullEn || '—';

      cx = x0;
      doc.fillColor(COLOR.text).font('Sarabun').fontSize(9);
      doc.text(String(i + 1), cx + 2, y + 5, { width: COLS[0].w - 4, align: 'center' }); cx += COLS[0].w;
      doc.text(n(stu.student_number), cx + 2, y + 5, { width: COLS[1].w - 4, align: 'center' }); cx += COLS[1].w;
      doc.text(name, cx + 4, y + 5, { width: COLS[2].w - 8, lineBreak: false, ellipsis: true }); cx += COLS[2].w;
      doc.text(num(g.score_midterm, 1), cx + 2, y + 5, { width: COLS[3].w - 4, align: 'center' }); cx += COLS[3].w;
      doc.text(num(g.score_final, 1), cx + 2, y + 5, { width: COLS[4].w - 4, align: 'center' }); cx += COLS[4].w;
      doc.text(num(g.score_assignment, 1), cx + 2, y + 5, { width: COLS[5].w - 4, align: 'center' }); cx += COLS[5].w;
      doc.text(num(g.score_total, 1), cx + 2, y + 5, { width: COLS[6].w - 4, align: 'center' }); cx += COLS[6].w;
      doc.font('Sarabun-Bold').text(n(g.grade_label), cx + 2, y + 5, { width: COLS[7].w - 4, align: 'center' }); cx += COLS[7].w;
      doc.font('Sarabun').text(n(g.pass_status), cx + 2, y + 5, { width: COLS[8].w - 4, align: 'center' });

      y += 18;
    }
  } else {
    // All-subjects pivot: students as rows, subjects as columns
    const subjects = (data.subjects || []);
    const fixedW = 30 + 80 + 200;
    const subjW = Math.max(40, Math.min(70, Math.floor((CONTENT_W - fixedW - 80) / Math.max(1, subjects.length))));
    const gpaW = 80;

    // Header
    let cx = x0;
    doc.rect(x0, y, CONTENT_W, 30).fillAndStroke(COLOR.headerBg, COLOR.rule);
    doc.font('Sarabun-Bold').fontSize(8).fillColor(COLOR.text);
    doc.text('ที่', cx + 2, y + 10, { width: 26, align: 'center' }); cx += 30;
    doc.text('รหัส', cx + 2, y + 10, { width: 76, align: 'center' }); cx += 80;
    doc.text('ชื่อ - นามสกุล', cx + 4, y + 10, { width: 192, align: 'left' }); cx += 200;
    for (const s of subjects) {
      doc.text(n(s.subject_code), cx + 1, y + 4, { width: subjW - 2, align: 'center', lineBreak: false, ellipsis: true });
      doc.font('Sarabun').fontSize(7).fillColor(COLOR.textMuted)
         .text(n(s.subject_name), cx + 1, y + 16, { width: subjW - 2, align: 'center', lineBreak: false, ellipsis: true });
      doc.font('Sarabun-Bold').fontSize(8).fillColor(COLOR.text);
      cx += subjW;
    }
    doc.text('GPA', cx + 2, y + 10, { width: gpaW - 4, align: 'center' });
    y += 30;

    // Compute per-student GPA from given grades
    const gpaByStu = {};
    for (const g of (data.grades || [])) {
      if (g.grade_value === null || g.grade_value === undefined) continue;
      const credits = Number(g.credit_hours || 1);
      if (!gpaByStu[g.student_id]) gpaByStu[g.student_id] = { sum: 0, cred: 0 };
      gpaByStu[g.student_id].sum += Number(g.grade_value) * credits;
      gpaByStu[g.student_id].cred += credits;
    }

    for (let i = 0; i < data.students.length; i++) {
      if (y > PAGE.height - PAGE.margin - 90) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: PAGE.margin });
        doc.rect(x0 - 4, PAGE.margin - 4, CONTENT_W + 8, PAGE.height - 2 * PAGE.margin + 8)
           .lineWidth(1.5).strokeColor(COLOR.stamp).stroke();
        y = PAGE.margin;
      }
      const stu = data.students[i];
      const fullTh = ((stu.first_name_th || '') + ' ' + (stu.last_name_th || '')).trim();
      const fullEn = ((stu.first_name_en || '') + ' ' + (stu.last_name_en || '')).trim();
      const name = fullTh || fullEn || '—';

      if (i % 2 === 1) doc.rect(x0, y, CONTENT_W, 18).fill(COLOR.stripe);

      let cx2 = x0;
      doc.fillColor(COLOR.text).font('Sarabun').fontSize(9);
      doc.text(String(i + 1), cx2 + 2, y + 5, { width: 26, align: 'center' }); cx2 += 30;
      doc.text(n(stu.student_number), cx2 + 2, y + 5, { width: 76, align: 'center' }); cx2 += 80;
      doc.text(name, cx2 + 4, y + 5, { width: 192, lineBreak: false, ellipsis: true }); cx2 += 200;
      for (const s of subjects) {
        const g = gradeByStuSub[`${stu.id}|${s.subject_code}`];
        doc.font('Sarabun-Bold').fontSize(9).fillColor(COLOR.text)
           .text(g ? n(g.grade_label) : '—', cx2 + 1, y + 5, { width: subjW - 2, align: 'center', lineBreak: false });
        cx2 += subjW;
      }
      const ginfo = gpaByStu[stu.id];
      const gpaVal = ginfo && ginfo.cred > 0 ? (ginfo.sum / ginfo.cred) : null;
      doc.font('Sarabun-Bold').fontSize(9).fillColor(COLOR.text)
         .text(gpaVal !== null ? gpaVal.toFixed(2) : '—', cx2 + 2, y + 5, { width: gpaW - 4, align: 'center' });

      y += 18;
    }
  }

  // ============ FOOTER / SIGNATURES ============
  const sigY = PAGE.height - PAGE.margin - 60;
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.text);
  doc.text(`บันทึก ณ วันที่ ${fmtThaiDate(new Date().toISOString())}`,
           x0, sigY - 14, { width: CONTENT_W, align: 'right' });

  doc.moveTo(x0 + 60, sigY + 24).lineTo(x0 + 280, sigY + 24).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
  doc.moveTo(x0 + CONTENT_W - 280, sigY + 24).lineTo(x0 + CONTENT_W - 60, sigY + 24).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.text);
  doc.text('ครูผู้สอน (Subject Teacher)', x0 + 60, sigY + 30, { width: 220, align: 'center' });
  doc.text('หัวหน้ากลุ่มสาระ / ผู้อำนวยการ', x0 + CONTENT_W - 280, sigY + 30, { width: 220, align: 'center' });

  // Footer
  const footY = PAGE.height - PAGE.margin - 14;
  doc.font('Sarabun').fontSize(8).fillColor(COLOR.textLight)
     .text(`ปพ.5 · เลขที่ ${n(serial?.serial_text || '—')}`, x0, footY)
     .text(`Generated by PanyaSchoolKit`, x0, footY, { width: CONTENT_W, align: 'right' });

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

    const { classroom, year, term, subject_code, issue } = req.query;
    if (!classroom || !year || !term) {
      return res.status(400).json({ error: 'missing_params', detail: 'classroom, year, term required' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: summary, error: rpcErr } = await supabase.rpc('get_class_grade_summary', {
      p_classroom: classroom,
      p_academic_year: year,
      p_term: term,
      p_subject_code: subject_code || null
    });

    if (rpcErr) {
      console.error('[popor-5-pdf] rpc error:', rpcErr);
      return res.status(500).json({ error: 'rpc_failed', detail: rpcErr.message });
    }
    if (!summary || summary.error) {
      return res.status(403).json({ error: summary?.error || 'no_data' });
    }

    // Optionally issue serial (1 doc per classroom+term)
    let serial = null;
    if (issue === 'true' || issue === '1') {
      const { data: issued } = await supabase.rpc('issue_popor_document', {
        p_student_id: null,
        p_doc_type: 'popor5',
        p_academic_year: year,
        p_term: term,
        p_grade_level: null,
        p_classroom: classroom,
        p_snapshot: { subject_code: subject_code || null, student_count: (summary.students || []).length }
      });
      if (issued && issued.success) {
        serial = { serial_text: issued.serial_text, serial_number: issued.serial_number };
      }
    }

    const fname = `popor5-${classroom}-${year}-${term}${subject_code ? '-' + subject_code : ''}.pdf`.replace(/[\/\\]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);

    await buildPDF({ data: summary, serial, res });

  } catch (err) {
    console.error('[popor-5-pdf] error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'server_error', detail: err.message });
  }
};
