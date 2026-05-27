// ==========================================================================
// /api/grades/popor-1-pdf.js
// Sprint 13.7: ปพ.1 — ระเบียนแสดงผลการเรียน (Academic Transcript)
//
// Thai Ministry of Education official document format:
// - Cumulative academic record across all years/terms
// - Used for graduation, transfers, university applications
//
// Query: ?student_id=<uuid> (required)
// Optional: ?issue=true (true = allocate serial via issue_popor_document RPC; false = preview only)
// Auth: requires user JWT (Bearer token); staff or student/parent of student
// Returns: application/pdf binary stream
// ==========================================================================

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');

// ---- Font loading (same pattern as report-card-pdf.js) ----
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

// Official ปพ.1 uses muted/formal palette (black-on-white with thin rules)
const COLOR = {
  text: '#000000',
  textMuted: '#444444',
  textLight: '#808080',
  rule: '#000000',
  ruleLight: '#888888',
  panelBg: '#F5F5F5',
  stamp: '#7A0000'   // optional decorative for borders
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
function num(v, decimals = 2) {
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
      Title: `ปพ.1 — ${data.student.student_number || ''}`,
      Author: data.school?.name_th || 'PanyaSchoolKit',
      Subject: 'ปพ.1 ระเบียนแสดงผลการเรียน',
      Creator: 'PanyaSchoolKit'
    }
  });

  await setupFonts(doc);
  doc.font('Sarabun');
  doc.pipe(res);

  const x0 = PAGE.margin;
  let y = PAGE.margin;

  // ============ DOCUMENT BORDER (decorative) ============
  doc.rect(x0 - 4, y - 4, CONTENT_W + 8, PAGE.height - 2 * PAGE.margin + 8)
     .lineWidth(1.5).strokeColor(COLOR.stamp).stroke();
  doc.rect(x0 - 2, y - 2, CONTENT_W + 4, PAGE.height - 2 * PAGE.margin + 4)
     .lineWidth(0.5).strokeColor(COLOR.stamp).stroke();

  // ============ HEADER ============
  // Top-right serial number
  doc.fillColor(COLOR.text).font('Sarabun').fontSize(10)
     .text(`เลขที่ ${n(serial?.serial_text || '—')}`, x0, y + 4, { width: CONTENT_W, align: 'right' });

  // Title
  doc.font('Sarabun-Bold').fontSize(18).fillColor(COLOR.text)
     .text('ระเบียนแสดงผลการเรียน', x0, y + 22, { width: CONTENT_W, align: 'center' });
  doc.font('Sarabun-Medium').fontSize(11).fillColor(COLOR.textMuted)
     .text('Academic Transcript · ปพ.1', x0, y + 46, { width: CONTENT_W, align: 'center' });

  y += 70;

  // School name
  doc.font('Sarabun-Bold').fontSize(14).fillColor(COLOR.text)
     .text(data.school?.name_th || data.school?.name_en || '—', x0, y, { width: CONTENT_W, align: 'center' });
  y += 20;
  if (data.school?.name_en && data.school?.name_th) {
    doc.font('Sarabun').fontSize(10).fillColor(COLOR.textMuted)
       .text(data.school.name_en, x0, y, { width: CONTENT_W, align: 'center' });
    y += 14;
  }

  // School address line
  const addressLine = [
    data.school?.address_th || data.school?.address_en,
    data.school?.district_th || data.school?.district,
    data.school?.province_th || data.school?.province
  ].filter(Boolean).join(' ');
  if (addressLine) {
    doc.font('Sarabun').fontSize(9).fillColor(COLOR.textMuted)
       .text(addressLine, x0, y, { width: CONTENT_W, align: 'center' });
    y += 12;
  }

  // Horizontal divider
  y += 6;
  doc.moveTo(x0, y).lineTo(x0 + CONTENT_W, y).lineWidth(0.8).strokeColor(COLOR.rule).stroke();
  y += 10;

  // ============ STUDENT INFO ============
  const photoW = 75, photoH = 100;
  // Photo box (left)
  doc.rect(x0, y, photoW, photoH).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
  doc.font('Sarabun').fontSize(8).fillColor(COLOR.textLight)
     .text('รูปถ่าย', x0, y + photoH / 2 - 5, { width: photoW, align: 'center' });

  // Info table (right of photo)
  const infoX = x0 + photoW + 16;
  const infoW = CONTENT_W - photoW - 16;
  const s = data.student;
  const studentFullTh = ((s.title_th || '') + ' ' + (s.first_name_th || '') + ' ' + (s.last_name_th || '')).trim().replace(/\s+/g, ' ');
  const studentFullEn = ((s.first_name_en || '') + ' ' + (s.last_name_en || '')).trim();

  function infoRow(label, value, rowY, valueBold = false) {
    doc.font('Sarabun').fontSize(9.5).fillColor(COLOR.textMuted).text(label, infoX, rowY);
    doc.font(valueBold ? 'Sarabun-Bold' : 'Sarabun-Medium').fontSize(10).fillColor(COLOR.text)
       .text(n(value), infoX + 110, rowY, { width: infoW - 110 });
  }

  let infoY = y;
  infoRow('ชื่อ - นามสกุล (Name)', studentFullTh || studentFullEn || '—', infoY, true); infoY += 16;
  if (studentFullEn) { infoRow('Name (English)', studentFullEn, infoY); infoY += 16; }
  infoRow('รหัสประจำตัวนักเรียน', s.student_number, infoY); infoY += 16;
  infoRow('เลขประจำตัวประชาชน', s.national_id || s.id_card || (s.custom_data && (s.custom_data.national_id || s.custom_data.id_card)) || '—', infoY); infoY += 16;
  infoRow('วัน เดือน ปีเกิด', s.date_of_birth ? fmtThaiDate(s.date_of_birth) : '—', infoY); infoY += 16;
  infoRow('เพศ / สัญชาติ', `${n(s.gender_th || s.gender)} / ${n(s.nationality_th || s.nationality || 'ไทย')}`, infoY); infoY += 16;

  y = Math.max(infoY, y + photoH) + 10;

  // Parents row
  doc.font('Sarabun').fontSize(9.5).fillColor(COLOR.textMuted)
     .text('ชื่อบิดา (Father):', x0, y);
  doc.font('Sarabun-Medium').fontSize(10).fillColor(COLOR.text)
     .text(n(s.father_name || (s.custom_data && s.custom_data.father_name)), x0 + 90, y, { width: CONTENT_W / 2 - 90 });
  doc.font('Sarabun').fontSize(9.5).fillColor(COLOR.textMuted)
     .text('ชื่อมารดา (Mother):', x0 + CONTENT_W / 2, y);
  doc.font('Sarabun-Medium').fontSize(10).fillColor(COLOR.text)
     .text(n(s.mother_name || (s.custom_data && s.custom_data.mother_name)), x0 + CONTENT_W / 2 + 90, y, { width: CONTENT_W / 2 - 90 });

  y += 22;

  // Divider
  doc.moveTo(x0, y).lineTo(x0 + CONTENT_W, y).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
  y += 10;

  // ============ ACADEMIC RECORD HEADER ============
  doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text)
     .text('ผลการเรียน · Academic Record', x0, y);
  y += 18;

  // Group grades by academic_year+term
  const groups = {};
  for (const g of (data.grades || [])) {
    const key = `${g.academic_year}|${g.term}|${g.grade_level || ''}|${g.classroom || ''}`;
    if (!groups[key]) groups[key] = { academic_year: g.academic_year, term: g.term, grade_level: g.grade_level, classroom: g.classroom, rows: [] };
    groups[key].rows.push(g);
  }
  const sortedGroups = Object.values(groups).sort((a, b) =>
    String(a.academic_year).localeCompare(String(b.academic_year)) ||
    String(a.term).localeCompare(String(b.term))
  );

  // For each academic_year+term group, render a mini table
  const COLS = {
    code: { x: 0, w: 60, label: 'รหัสวิชา' },
    name: { x: 60, w: 230, label: 'รายวิชา' },
    credit: { x: 290, w: 55, label: 'หน่วยกิต' },
    score: { x: 345, w: 60, label: 'คะแนน' },
    grade: { x: 405, w: 55, label: 'ผลการเรียน' },
    note: { x: 460, w: CONTENT_W - 460, label: 'หมายเหตุ' }
  };

  function tableHeader(rowY) {
    doc.rect(x0, rowY, CONTENT_W, 18).fillAndStroke(COLOR.panelBg, COLOR.rule);
    doc.font('Sarabun-Bold').fontSize(9).fillColor(COLOR.text);
    Object.values(COLS).forEach(c => {
      doc.text(c.label, x0 + c.x + 4, rowY + 5, { width: c.w - 8, align: 'center' });
    });
  }

  function ensureSpace(neededHeight) {
    if (y + neededHeight > PAGE.height - PAGE.margin - 110) {
      doc.addPage();
      // Re-draw outer border
      doc.rect(x0 - 4, PAGE.margin - 4, CONTENT_W + 8, PAGE.height - 2 * PAGE.margin + 8)
         .lineWidth(1.5).strokeColor(COLOR.stamp).stroke();
      doc.rect(x0 - 2, PAGE.margin - 2, CONTENT_W + 4, PAGE.height - 2 * PAGE.margin + 4)
         .lineWidth(0.5).strokeColor(COLOR.stamp).stroke();
      y = PAGE.margin;
      doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text)
         .text('ผลการเรียน (ต่อ) · Academic Record (cont.)', x0, y);
      y += 18;
    }
  }

  for (const grp of sortedGroups) {
    ensureSpace(60);

    // Group label band
    doc.rect(x0, y, CONTENT_W, 16).fillAndStroke('#EAEAEA', COLOR.rule);
    doc.font('Sarabun-Bold').fontSize(10).fillColor(COLOR.text)
       .text(`ปีการศึกษา ${n(grp.academic_year)}  ภาคเรียนที่ ${n(grp.term)}` +
             (grp.grade_level ? `  ระดับชั้น ${grp.grade_level}` : '') +
             (grp.classroom ? `  ห้อง ${grp.classroom}` : ''),
             x0 + 6, y + 3);
    y += 16;

    tableHeader(y);
    y += 18;

    doc.font('Sarabun').fontSize(9).fillColor(COLOR.text);

    for (const g of grp.rows) {
      ensureSpace(18);
      const rowY = y;
      // alternating stripe
      if (((grp.rows.indexOf(g)) % 2) === 1) {
        doc.rect(x0, rowY, CONTENT_W, 16).fill('#FAFAFA');
      }
      doc.fillColor(COLOR.text).font('Sarabun').fontSize(9);
      doc.text(n(g.subject_code), x0 + COLS.code.x + 4, rowY + 3, { width: COLS.code.w - 8, lineBreak: false, ellipsis: true });
      doc.text(n(g.subject_name), x0 + COLS.name.x + 4, rowY + 3, { width: COLS.name.w - 8, lineBreak: false, ellipsis: true });
      doc.text(g.credit_hours ? Number(g.credit_hours).toFixed(1) : '—', x0 + COLS.credit.x + 4, rowY + 3, { width: COLS.credit.w - 8, align: 'center' });
      doc.text(num(g.score_total, 1), x0 + COLS.score.x + 4, rowY + 3, { width: COLS.score.w - 8, align: 'center' });
      doc.font('Sarabun-Bold').fillColor(COLOR.text)
         .text(n(g.grade_label), x0 + COLS.grade.x + 4, rowY + 3, { width: COLS.grade.w - 8, align: 'center' });
      doc.font('Sarabun').fontSize(8).fillColor(COLOR.textMuted)
         .text(g.pass_status || '', x0 + COLS.note.x + 4, rowY + 4, { width: COLS.note.w - 8, lineBreak: false, ellipsis: true });
      y += 16;
    }

    // Term GPA line
    const termRec = (data.terms || []).find(t =>
      String(t.academic_year) === String(grp.academic_year) && String(t.term) === String(grp.term));
    if (termRec) {
      ensureSpace(16);
      doc.rect(x0, y, CONTENT_W, 14).fill('#F0F0F0');
      doc.font('Sarabun-Medium').fontSize(9).fillColor(COLOR.text)
         .text(`GPA เทอม: ${num(termRec.term_gpa, 2)}   หน่วยกิตรวม: ${num(termRec.term_credits, 1)}   จำนวนวิชา: ${termRec.subject_count || 0}`,
                x0 + 8, y + 3);
      y += 18;
    } else {
      y += 6;
    }
  }

  // ============ CUMULATIVE SUMMARY ============
  ensureSpace(80);
  y += 6;
  doc.moveTo(x0, y).lineTo(x0 + CONTENT_W, y).lineWidth(0.8).strokeColor(COLOR.rule).stroke();
  y += 8;

  doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.text)
     .text('สรุปผลการเรียนรวม · Cumulative Summary', x0, y);
  y += 18;

  doc.rect(x0, y, CONTENT_W, 50).fillAndStroke(COLOR.panelBg, COLOR.rule);
  const sumY = y + 8;
  // 3-column summary
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.textMuted);
  doc.text('GPA สะสม (Cumulative)', x0 + 16, sumY);
  doc.text('หน่วยกิตรวม (Total Credits)', x0 + 200, sumY);
  doc.text('จำนวนวิชา (Total Subjects)', x0 + 380, sumY);

  doc.font('Sarabun-Bold').fontSize(18).fillColor(COLOR.text);
  doc.text(num(data.cumulative_gpa, 2), x0 + 16, sumY + 14);
  doc.fontSize(14);
  doc.text(num(data.total_credits, 1), x0 + 200, sumY + 18);
  doc.text(String((data.grades || []).length), x0 + 380, sumY + 18);

  y += 60;

  // ============ FOOTER / SIGNATURES ============
  const sigY = PAGE.height - PAGE.margin - 90;
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.text);

  // Issue date
  doc.text(`ออกให้ ณ วันที่ ${fmtThaiDate(new Date().toISOString())}`,
           x0, sigY - 14, { width: CONTENT_W, align: 'right' });

  // Two signature blocks
  doc.moveTo(x0 + 50, sigY + 30).lineTo(x0 + 240, sigY + 30).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
  doc.moveTo(x0 + 320, sigY + 30).lineTo(x0 + 510, sigY + 30).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.text);
  doc.text('นายทะเบียน (Registrar)', x0 + 50, sigY + 36, { width: 190, align: 'center' });
  doc.text('ผู้อำนวยการสถานศึกษา (Principal)', x0 + 320, sigY + 36, { width: 190, align: 'center' });
  doc.font('Sarabun').fontSize(8).fillColor(COLOR.textLight);
  doc.text('ลงชื่อ', x0 + 50, sigY + 16, { width: 190, align: 'left' });
  doc.text('ลงชื่อ', x0 + 320, sigY + 16, { width: 190, align: 'left' });

  // Footer serial + watermark
  const footY = PAGE.height - PAGE.margin - 16;
  doc.font('Sarabun').fontSize(8).fillColor(COLOR.textLight)
     .text(`ปพ.1 · เลขที่ ${n(serial?.serial_text || '—')}`, x0, footY)
     .text(`Generated by PanyaSchoolKit · ${fmtThaiDate(new Date().toISOString())}`, x0, footY, { width: CONTENT_W, align: 'right' });

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

    const { student_id, issue } = req.query;
    if (!student_id) return res.status(400).json({ error: 'missing_student_id' });

    // Use anon client + user JWT so the RPC sees the actual auth.uid()/RLS context
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch transcript via RPC
    const { data: transcript, error: rpcErr } = await supabase.rpc('get_student_transcript', {
      p_student_id: student_id
    });

    if (rpcErr) {
      console.error('[popor-1-pdf] rpc error:', rpcErr);
      return res.status(500).json({ error: 'rpc_failed', detail: rpcErr.message });
    }
    if (!transcript || transcript.error) {
      return res.status(403).json({ error: transcript?.error || 'no_data' });
    }

    // Optionally issue serial (log this generation in popor_documents)
    let serial = null;
    if (issue === 'true' || issue === '1') {
      const lastTerm = (transcript.terms || []).slice(-1)[0] || {};
      const { data: issued } = await supabase.rpc('issue_popor_document', {
        p_student_id: student_id,
        p_doc_type: 'popor1',
        p_academic_year: lastTerm.academic_year || null,
        p_term: lastTerm.term || null,
        p_grade_level: lastTerm.grade_level || null,
        p_classroom: lastTerm.classroom || null,
        p_snapshot: { cumulative_gpa: transcript.cumulative_gpa, total_credits: transcript.total_credits }
      });
      if (issued && issued.success) {
        serial = { serial_text: issued.serial_text, serial_number: issued.serial_number };
      }
    }

    // Set headers + build PDF
    const fname = `popor1-${transcript.student.student_number || student_id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);

    await buildPDF({ data: transcript, serial, res });

  } catch (err) {
    console.error('[popor-1-pdf] error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'server_error', detail: err.message });
  }
};
