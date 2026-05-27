// ==========================================================================
// /api/grades/popor-6-pdf.js
// Sprint 13.7: ปพ.6 — แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล
//                       (Student Progress Report Book)
//
// Thai Ministry of Education official document format:
// - Per-student comprehensive report for parents
// - Includes: term grades, attendance, behavior, desired characteristics
// - Most complete format — the "report card" parents physically receive
//
// Query: ?student_id=<uuid>&year=<text>&term=<text>[&issue=true]
// Auth: requires user JWT (Bearer token); staff or student/parent
// Returns: application/pdf binary stream (A4 portrait)
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
  good: '#0F5132', warn: '#664D03', bad: '#842029',
  stamp: '#7A0000'
};

const PAGE = { width: 595.28, height: 841.89, margin: 36 };
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
    margin: PAGE.margin,
    info: {
      Title: `ปพ.6 — ${data.student.student_number || ''} ${data.academic_year}/${data.term}`,
      Author: data.school?.name_th || 'PanyaSchoolKit',
      Subject: 'ปพ.6 รายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล',
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
  doc.fillColor(COLOR.text).font('Sarabun').fontSize(10)
     .text(`เลขที่ ${n(serial?.serial_text || '—')}`, x0, y + 2, { width: CONTENT_W, align: 'right' });

  doc.font('Sarabun-Bold').fontSize(16).fillColor(COLOR.text)
     .text('รายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล', x0, y + 18, { width: CONTENT_W, align: 'center' });
  doc.font('Sarabun-Medium').fontSize(10).fillColor(COLOR.textMuted)
     .text('Student Progress Report · ปพ.6', x0, y + 40, { width: CONTENT_W, align: 'center' });
  y += 60;

  // School
  doc.font('Sarabun-Bold').fontSize(13).fillColor(COLOR.text)
     .text(data.school?.name_th || data.school?.name_en || '—', x0, y, { width: CONTENT_W, align: 'center' });
  y += 18;
  doc.font('Sarabun-Medium').fontSize(10).fillColor(COLOR.textMuted)
     .text(`ปีการศึกษา ${n(data.academic_year)}  ภาคเรียนที่ ${n(data.term)}`,
           x0, y, { width: CONTENT_W, align: 'center' });
  y += 18;

  // Divider
  doc.moveTo(x0, y).lineTo(x0 + CONTENT_W, y).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
  y += 10;

  // ============ STUDENT INFO BAND ============
  const s = data.student;
  const studentFullTh = ((s.title_th || '') + ' ' + (s.first_name_th || '') + ' ' + (s.last_name_th || '')).trim().replace(/\s+/g, ' ');
  const studentFullEn = ((s.first_name_en || '') + ' ' + (s.last_name_en || '')).trim();

  doc.rect(x0, y, CONTENT_W, 60).fillAndStroke(COLOR.panelBg, COLOR.rule);
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.textMuted);

  // Row 1
  doc.text('ชื่อ - นามสกุล (Name)', x0 + 10, y + 6);
  doc.text('รหัสประจำตัว (ID)', x0 + 290, y + 6);
  doc.text('ระดับชั้น (Grade)', x0 + 410, y + 6);

  doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text);
  doc.text(studentFullTh || studentFullEn || '—', x0 + 10, y + 18, { width: 270, lineBreak: false, ellipsis: true });
  doc.text(n(s.student_number), x0 + 290, y + 18, { width: 110, lineBreak: false, ellipsis: true });
  doc.text(n(s.grade), x0 + 410, y + 18, { width: 100, lineBreak: false, ellipsis: true });

  // Row 2
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.textMuted);
  doc.text('English', x0 + 10, y + 36);
  doc.text('ห้องเรียน (Classroom)', x0 + 290, y + 36);
  doc.text('เลขที่ในห้อง', x0 + 410, y + 36);

  doc.font('Sarabun-Medium').fontSize(10).fillColor(COLOR.text);
  doc.text(studentFullEn || '—', x0 + 10, y + 47, { width: 270, lineBreak: false, ellipsis: true });
  doc.text(n(s.classroom), x0 + 290, y + 47, { width: 110, lineBreak: false, ellipsis: true });
  doc.text(n(s.class_number || (s.custom_data && s.custom_data.class_number)), x0 + 410, y + 47, { width: 100, lineBreak: false, ellipsis: true });

  y += 72;

  // ============ ACADEMIC RESULTS ============
  doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text)
     .text('1. ผลการเรียนรายวิชา (Academic Results)', x0, y);
  y += 16;

  // Table
  const COLS = {
    code:   { x: 0,   w: 55,  label: 'รหัส' },
    name:   { x: 55,  w: 210, label: 'รายวิชา' },
    credit: { x: 265, w: 45,  label: 'หน่วยกิต' },
    mid:    { x: 310, w: 45,  label: 'กลาง' },
    final:  { x: 355, w: 45,  label: 'ปลาย' },
    total:  { x: 400, w: 50,  label: 'รวม' },
    grade:  { x: 450, w: 35,  label: 'ผล' },
    note:   { x: 485, w: CONTENT_W - 485, label: 'หมายเหตุ' }
  };

  doc.rect(x0, y, CONTENT_W, 20).fillAndStroke(COLOR.headerBg, COLOR.rule);
  doc.font('Sarabun-Bold').fontSize(9).fillColor(COLOR.text);
  Object.values(COLS).forEach(c => {
    doc.text(c.label, x0 + c.x + 2, y + 6, { width: c.w - 4, align: 'center' });
  });
  y += 20;

  let totalCredits = 0;

  for (let i = 0; i < (data.grades || []).length; i++) {
    if (y > PAGE.height - PAGE.margin - 200) {
      doc.addPage();
      doc.rect(x0 - 4, PAGE.margin - 4, CONTENT_W + 8, PAGE.height - 2 * PAGE.margin + 8)
         .lineWidth(1.5).strokeColor(COLOR.stamp).stroke();
      y = PAGE.margin;
      doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text)
         .text('1. ผลการเรียนรายวิชา (ต่อ)', x0, y);
      y += 16;
      doc.rect(x0, y, CONTENT_W, 20).fillAndStroke(COLOR.headerBg, COLOR.rule);
      doc.font('Sarabun-Bold').fontSize(9).fillColor(COLOR.text);
      Object.values(COLS).forEach(c => {
        doc.text(c.label, x0 + c.x + 2, y + 6, { width: c.w - 4, align: 'center' });
      });
      y += 20;
    }

    const g = data.grades[i];
    if (i % 2 === 1) doc.rect(x0, y, CONTENT_W, 16).fill(COLOR.stripe);

    doc.fillColor(COLOR.text).font('Sarabun').fontSize(9);
    doc.text(n(g.subject_code), x0 + COLS.code.x + 2, y + 4, { width: COLS.code.w - 4, align: 'center', lineBreak: false, ellipsis: true });
    doc.text(n(g.subject_name), x0 + COLS.name.x + 4, y + 4, { width: COLS.name.w - 8, lineBreak: false, ellipsis: true });
    doc.text(g.credit_hours ? Number(g.credit_hours).toFixed(1) : '—', x0 + COLS.credit.x + 2, y + 4, { width: COLS.credit.w - 4, align: 'center' });
    doc.text(num(g.score_midterm, 1), x0 + COLS.mid.x + 2, y + 4, { width: COLS.mid.w - 4, align: 'center' });
    doc.text(num(g.score_final, 1), x0 + COLS.final.x + 2, y + 4, { width: COLS.final.w - 4, align: 'center' });
    doc.text(num(g.score_total, 1), x0 + COLS.total.x + 2, y + 4, { width: COLS.total.w - 4, align: 'center' });
    doc.font('Sarabun-Bold').text(n(g.grade_label), x0 + COLS.grade.x + 2, y + 4, { width: COLS.grade.w - 4, align: 'center' });
    doc.font('Sarabun').fontSize(8).fillColor(COLOR.textMuted)
       .text(g.pass_status || '', x0 + COLS.note.x + 2, y + 5, { width: COLS.note.w - 4, lineBreak: false, ellipsis: true });

    totalCredits += Number(g.credit_hours || 0);
    y += 16;
  }

  // GPA summary band
  doc.rect(x0, y, CONTENT_W, 28).fillAndStroke(COLOR.headerBg, COLOR.rule);
  doc.font('Sarabun-Medium').fontSize(9).fillColor(COLOR.textMuted)
     .text('สรุปผลการเรียน (Term Summary)', x0 + 10, y + 4);

  doc.font('Sarabun-Bold').fontSize(13).fillColor(COLOR.text);
  doc.text(`GPA: ${num(data.gpa, 2)}`, x0 + 10, y + 14, { width: 150 });
  doc.text(`หน่วยกิตรวม: ${num(data.total_credits || totalCredits, 1)}`, x0 + 170, y + 14, { width: 180 });
  doc.text(`จำนวนวิชา: ${(data.grades || []).length}`, x0 + 360, y + 14, { width: 150 });

  y += 38;

  // ============ ATTENDANCE ============
  if (y > PAGE.height - PAGE.margin - 220) {
    doc.addPage();
    doc.rect(x0 - 4, PAGE.margin - 4, CONTENT_W + 8, PAGE.height - 2 * PAGE.margin + 8)
       .lineWidth(1.5).strokeColor(COLOR.stamp).stroke();
    y = PAGE.margin;
  }

  doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text)
     .text('2. การมาเรียน (Attendance)', x0, y);
  y += 16;

  const att = data.attendance || {};
  doc.rect(x0, y, CONTENT_W, 50).fillAndStroke(COLOR.panelBg, COLOR.rule);

  const attCols = [
    { label: 'มาเรียน (Present)', val: att.present || 0, color: COLOR.good },
    { label: 'ขาด (Absent)', val: att.absent || 0, color: COLOR.bad },
    { label: 'สาย (Late)', val: att.late || 0, color: COLOR.warn },
    { label: 'ลา (Excused)', val: att.excused || 0, color: COLOR.warn },
    { label: 'รวม (Total Days)', val: att.total_days || 0, color: COLOR.text }
  ];
  const colW = CONTENT_W / attCols.length;
  attCols.forEach((c, i) => {
    const cx = x0 + i * colW;
    doc.font('Sarabun').fontSize(9).fillColor(COLOR.textMuted)
       .text(c.label, cx + 4, y + 6, { width: colW - 8, align: 'center' });
    doc.font('Sarabun-Bold').fontSize(16).fillColor(c.color)
       .text(String(c.val), cx + 4, y + 22, { width: colW - 8, align: 'center' });
  });

  y += 60;

  // ============ DESIRED CHARACTERISTICS ============
  doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text)
     .text('3. คุณลักษณะอันพึงประสงค์ (Desired Characteristics)', x0, y);
  y += 16;

  const characteristics = [
    'รักชาติ ศาสน์ กษัตริย์',
    'ซื่อสัตย์สุจริต',
    'มีวินัย',
    'ใฝ่เรียนรู้',
    'อยู่อย่างพอเพียง',
    'มุ่งมั่นในการทำงาน',
    'รักความเป็นไทย',
    'มีจิตสาธารณะ'
  ];

  // 2-column grid of characteristics with empty checkbox columns (ดีเยี่ยม/ดี/ผ่าน/ไม่ผ่าน)
  doc.rect(x0, y, CONTENT_W, 18).fillAndStroke(COLOR.headerBg, COLOR.rule);
  doc.font('Sarabun-Bold').fontSize(9).fillColor(COLOR.text);
  doc.text('รายการ (Characteristic)', x0 + 8, y + 5, { width: 340 });
  doc.text('ดีเยี่ยม', x0 + 350, y + 5, { width: 50, align: 'center' });
  doc.text('ดี', x0 + 400, y + 5, { width: 40, align: 'center' });
  doc.text('ผ่าน', x0 + 440, y + 5, { width: 40, align: 'center' });
  doc.text('ไม่ผ่าน', x0 + 480, y + 5, { width: CONTENT_W - 480, align: 'center' });
  y += 18;

  // From custom_data.characteristics (jsonb keyed by Thai name) — fallback to blank checkboxes
  const charScores = (s.custom_data && s.custom_data.characteristics) || {};

  characteristics.forEach((label, i) => {
    if (i % 2 === 1) doc.rect(x0, y, CONTENT_W, 16).fill(COLOR.stripe);
    doc.font('Sarabun').fontSize(9).fillColor(COLOR.text)
       .text(`${i + 1}. ${label}`, x0 + 8, y + 4, { width: 340 });
    const score = (charScores[label] || '').toString().toLowerCase();
    const tick = (k) => score === k ? '✓' : '☐';
    doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text);
    doc.text(tick('excellent'), x0 + 350, y + 2, { width: 50, align: 'center' });
    doc.text(tick('good'),      x0 + 400, y + 2, { width: 40, align: 'center' });
    doc.text(tick('pass'),      x0 + 440, y + 2, { width: 40, align: 'center' });
    doc.text(tick('fail'),      x0 + 480, y + 2, { width: CONTENT_W - 480, align: 'center' });
    y += 16;
  });

  y += 6;

  // ============ TEACHER COMMENTS ============
  if (y > PAGE.height - PAGE.margin - 130) {
    doc.addPage();
    doc.rect(x0 - 4, PAGE.margin - 4, CONTENT_W + 8, PAGE.height - 2 * PAGE.margin + 8)
       .lineWidth(1.5).strokeColor(COLOR.stamp).stroke();
    y = PAGE.margin;
  }

  doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text)
     .text('4. ความเห็นครูประจำชั้น (Homeroom Teacher Comments)', x0, y);
  y += 16;

  // Comments box
  const commentsHeight = 60;
  doc.rect(x0, y, CONTENT_W, commentsHeight).lineWidth(0.5).strokeColor(COLOR.rule).stroke();
  // Use teacher_comments from grades[0] (one-of) or leave blank for handwriting
  const commentText = (data.grades || []).find(g => g.comments)?.comments
                     || s.teacher_comment
                     || '';
  if (commentText) {
    doc.font('Sarabun').fontSize(10).fillColor(COLOR.text)
       .text(commentText, x0 + 8, y + 6, { width: CONTENT_W - 16, height: commentsHeight - 12 });
  }
  y += commentsHeight + 10;

  // ============ SIGNATURE BLOCKS ============
  const sigY = PAGE.height - PAGE.margin - 90;
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.text);
  doc.text(`บันทึก ณ วันที่ ${fmtThaiDate(new Date().toISOString())}`,
           x0, sigY - 14, { width: CONTENT_W, align: 'right' });

  // Three signatures: Homeroom Teacher, Parent, Principal
  const sigW = (CONTENT_W - 40) / 3;
  for (let i = 0; i < 3; i++) {
    const sx = x0 + i * (sigW + 20);
    doc.moveTo(sx + 20, sigY + 30).lineTo(sx + sigW - 20, sigY + 30).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
  }
  const labels = [
    'ครูประจำชั้น (Homeroom Teacher)',
    'ผู้ปกครอง (Parent)',
    'ผู้อำนวยการ (Principal)'
  ];
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.text);
  for (let i = 0; i < 3; i++) {
    const sx = x0 + i * (sigW + 20);
    doc.text(labels[i], sx, sigY + 36, { width: sigW, align: 'center' });
    doc.font('Sarabun').fontSize(8).fillColor(COLOR.textLight)
       .text('ลงชื่อ', sx + 20, sigY + 16);
    doc.font('Sarabun').fontSize(9).fillColor(COLOR.text);
  }

  // Footer
  const footY = PAGE.height - PAGE.margin - 14;
  doc.font('Sarabun').fontSize(8).fillColor(COLOR.textLight)
     .text(`ปพ.6 · เลขที่ ${n(serial?.serial_text || '—')}`, x0, footY)
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

    const { student_id, year, term, issue } = req.query;
    if (!student_id || !year || !term) {
      return res.status(400).json({ error: 'missing_params', detail: 'student_id, year, term required' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: report, error: rpcErr } = await supabase.rpc('get_student_progress_report', {
      p_student_id: student_id,
      p_academic_year: year,
      p_term: term
    });

    if (rpcErr) {
      console.error('[popor-6-pdf] rpc error:', rpcErr);
      return res.status(500).json({ error: 'rpc_failed', detail: rpcErr.message });
    }
    if (!report || report.error) {
      return res.status(403).json({ error: report?.error || 'no_data' });
    }

    // Optionally issue serial
    let serial = null;
    if (issue === 'true' || issue === '1') {
      const { data: issued } = await supabase.rpc('issue_popor_document', {
        p_student_id: student_id,
        p_doc_type: 'popor6',
        p_academic_year: year,
        p_term: term,
        p_grade_level: report.student?.grade || null,
        p_classroom: report.student?.classroom || null,
        p_snapshot: { gpa: report.gpa, total_credits: report.total_credits, attendance: report.attendance }
      });
      if (issued && issued.success) {
        serial = { serial_text: issued.serial_text, serial_number: issued.serial_number };
      }
    }

    const fname = `popor6-${report.student.student_number || student_id}-${year}-${term}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);

    await buildPDF({ data: report, serial, res });

  } catch (err) {
    console.error('[popor-6-pdf] error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'server_error', detail: err.message });
  }
};
