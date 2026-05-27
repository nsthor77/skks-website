// ==========================================================================
// /api/grades/report-card-pdf.js
// Sprint 13: Generate Report Card PDF using PDFKit + Thai Sarabun font
//
// Query: ?year=2569&term=1&student_id=<uuid> (student_id optional for owner of student)
// Auth: requires user JWT (Bearer token)
// Returns: application/pdf binary stream
// ==========================================================================

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');

// ---- Font loading (same pattern as invoices/pdf.js) ----
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

// Palette
const COLOR = {
  text: '#111111', textMuted: '#6B7280', textLight: '#9CA3AF',
  primary: '#2563EB', primaryDk: '#1E40AF', primaryBg: '#EFF6FF',
  border: '#E5E7EB', panelBg: '#F9FAFB',
  successBg: '#D1FAE5', successFg: '#065F46',
  warningBg: '#FEF3C7', warningFg: '#92400E',
  dangerBg: '#FEE2E2', dangerFg: '#991B1B'
};

const PAGE = { width: 595.28, height: 841.89, margin: 42 };
const CONTENT_W = PAGE.width - 2 * PAGE.margin;

function formatThaiDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return '—'; }
}

async function setupFonts(doc) {
  const [reg, bold, med] = await Promise.all([loadFont('regular'), loadFont('bold'), loadFont('medium')]);
  doc.registerFont('Sarabun', reg);
  doc.registerFont('Sarabun-Bold', bold);
  doc.registerFont('Sarabun-Medium', med);
}

// Grade color from label
function gradeColor(label) {
  if (!label) return COLOR.textMuted;
  const L = label.toString().toUpperCase();
  if (L.startsWith('A') || L === '4' || L === 'P') return '#065F46';
  if (L.startsWith('B') || L === '3' || L === '3.5') return '#10B981';
  if (L.startsWith('C') || L === '2' || L === '2.5') return '#F59E0B';
  if (L.startsWith('D') || L === '1' || L === '1.5') return '#EF4444';
  if (L.startsWith('F') || L === '0') return '#991B1B';
  return COLOR.primaryDk;
}

// ============================================================
// Main PDF builder
// ============================================================
async function buildPDF({ school, student, grades, summary, year, term, res }) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE.margin,
    info: {
      Title: `Report Card ${student.student_number || ''} — ${year} Term ${term}`,
      Author: school?.name_th || 'PanyaSchoolKit',
      Subject: `Report Card ${year} Term ${term}`,
      Creator: 'PanyaSchoolKit'
    }
  });

  await setupFonts(doc);
  doc.font('Sarabun');
  doc.pipe(res);

  let y = PAGE.margin;
  const x0 = PAGE.margin;

  // ============ HEADER ============
  doc.rect(x0, y, CONTENT_W, 80).fill(COLOR.primaryDk);
  doc.fillColor('#FFFFFF').font('Sarabun-Bold').fontSize(22)
     .text(school?.name_th || school?.name_en || 'PanyaSchoolKit', x0 + 18, y + 14);
  doc.font('Sarabun').fontSize(11)
     .text(school?.name_en || '', x0 + 18, y + 42);
  doc.font('Sarabun-Medium').fontSize(13)
     .text('REPORT CARD · ใบรายงานผลการเรียน', x0 + 18, y + 58);

  y += 96;
  doc.fillColor(COLOR.text);

  // ============ STUDENT INFO ============
  doc.font('Sarabun-Medium').fontSize(11).fillColor(COLOR.textMuted).text('STUDENT INFORMATION', x0, y);
  y += 16;

  doc.rect(x0, y, CONTENT_W, 90).fill(COLOR.panelBg).stroke(COLOR.border);
  const studentFullTh = ((student.first_name_th || '') + ' ' + (student.last_name_th || '')).trim();
  const studentFullEn = ((student.first_name_en || '') + ' ' + (student.last_name_en || '')).trim();

  doc.fillColor(COLOR.text).font('Sarabun-Bold').fontSize(15)
     .text(studentFullTh || studentFullEn || '—', x0 + 18, y + 14);
  if (studentFullTh && studentFullEn) {
    doc.font('Sarabun').fontSize(11).fillColor(COLOR.textMuted)
       .text(studentFullEn, x0 + 18, y + 36);
  }

  // Info grid: ID / Year-Term / Grade / Classroom
  doc.font('Sarabun').fontSize(10).fillColor(COLOR.textMuted);
  const infoY = y + 56;
  doc.text('Student ID', x0 + 18, infoY);
  doc.text('Year / Term', x0 + 140, infoY);
  doc.text('Grade Level', x0 + 280, infoY);
  doc.text('Classroom', x0 + 400, infoY);

  doc.fillColor(COLOR.text).font('Sarabun-Bold').fontSize(11);
  doc.text(student.student_number || '—', x0 + 18, infoY + 14);
  doc.text(`${year} / ${term}`, x0 + 140, infoY + 14);
  doc.text(student.grade || '—', x0 + 280, infoY + 14);
  doc.text(student.classroom || '—', x0 + 400, infoY + 14);

  y += 106;

  // ============ GRADES TABLE ============
  doc.font('Sarabun-Medium').fontSize(11).fillColor(COLOR.textMuted).text('GRADES', x0, y);
  y += 16;

  // Table header
  doc.rect(x0, y, CONTENT_W, 22).fill(COLOR.primaryBg);
  doc.fillColor(COLOR.primaryDk).font('Sarabun-Bold').fontSize(10);
  doc.text('Code', x0 + 10, y + 6);
  doc.text('Subject', x0 + 60, y + 6);
  doc.text('Mid', x0 + 280, y + 6);
  doc.text('Final', x0 + 320, y + 6);
  doc.text('Total', x0 + 365, y + 6);
  doc.text('Grade', x0 + 420, y + 6);
  doc.text('Credit', x0 + 480, y + 6);
  y += 22;

  doc.font('Sarabun').fontSize(10).fillColor(COLOR.text);

  // Rows
  if (!grades.length) {
    doc.fillColor(COLOR.textMuted).text('No grades available', x0 + 10, y + 8);
    y += 30;
  } else {
    for (const g of grades) {
      // Stripe
      if (((grades.indexOf(g)) % 2) === 1) {
        doc.rect(x0, y, CONTENT_W, 20).fill('#FAFAFA');
      }
      doc.fillColor(COLOR.text).font('Sarabun-Medium').fontSize(10);
      doc.text(g.subject_code || '—', x0 + 10, y + 5, { width: 45, lineBreak: false });
      doc.font('Sarabun').fontSize(10);
      doc.text(g.subject_name || '—', x0 + 60, y + 5, { width: 210, lineBreak: false, ellipsis: true });

      doc.font('Sarabun-Medium').fillColor(COLOR.textDark || COLOR.text);
      doc.text(formatScore(g.score_midterm), x0 + 280, y + 5);
      doc.text(formatScore(g.score_final), x0 + 320, y + 5);
      doc.text(formatScore(g.score_total), x0 + 365, y + 5);

      // Grade badge
      const grCol = gradeColor(g.grade_label);
      doc.fillColor(grCol).font('Sarabun-Bold');
      doc.text(g.grade_label || '—', x0 + 420, y + 5);

      doc.fillColor(COLOR.text).font('Sarabun').fontSize(10);
      doc.text(g.credit_hours ? Number(g.credit_hours).toFixed(1) : '—', x0 + 480, y + 5);

      y += 20;

      if (y > PAGE.height - 200) {
        doc.addPage();
        y = PAGE.margin;
      }
    }
  }

  // Divider
  y += 8;
  doc.moveTo(x0, y).lineTo(x0 + CONTENT_W, y).strokeColor(COLOR.border).stroke();
  y += 16;

  // ============ SUMMARY ============
  doc.rect(x0, y, CONTENT_W, 70).fill(COLOR.primaryBg);
  doc.fillColor(COLOR.primaryDk).font('Sarabun-Bold').fontSize(11);
  doc.text('TERM SUMMARY', x0 + 18, y + 12);

  const sumY = y + 32;
  doc.font('Sarabun').fontSize(10).fillColor(COLOR.textMuted);
  doc.text('GPA (this term)', x0 + 18, sumY);
  doc.text('Total Credits', x0 + 170, sumY);
  doc.text('Subjects', x0 + 310, sumY);
  doc.text('Status', x0 + 430, sumY);

  doc.font('Sarabun-Bold').fontSize(18).fillColor(COLOR.primaryDk);
  doc.text(summary.gpa !== null && summary.gpa !== undefined ? Number(summary.gpa).toFixed(2) : '—', x0 + 18, sumY + 14);
  doc.fontSize(14).fillColor(COLOR.text);
  doc.text(summary.total_credits ? Number(summary.total_credits).toFixed(1) : '—', x0 + 170, sumY + 16);
  doc.text(String(grades.length), x0 + 310, sumY + 16);

  // Pass/Fail status
  const passStatus = summary.gpa !== null && summary.gpa !== undefined && Number(summary.gpa) >= 1.0 ? 'PASS' : 'REVIEW';
  const passColor = passStatus === 'PASS' ? COLOR.successFg : COLOR.warningFg;
  doc.fillColor(passColor).fontSize(14).text(passStatus, x0 + 430, sumY + 16);

  y += 86;

  // ============ TEACHER COMMENTS PLACEHOLDER ============
  doc.font('Sarabun-Medium').fontSize(11).fillColor(COLOR.textMuted).text('TEACHER COMMENTS', x0, y);
  y += 16;
  doc.rect(x0, y, CONTENT_W, 60).fill(COLOR.panelBg).stroke(COLOR.border);
  doc.fillColor(COLOR.textMuted).font('Sarabun').fontSize(10).text('(Teacher comments will appear here when added)', x0 + 14, y + 22);
  y += 76;

  // ============ FOOTER / SIGNATURES ============
  const sigY = PAGE.height - PAGE.margin - 80;
  doc.moveTo(x0 + 60, sigY).lineTo(x0 + 220, sigY).strokeColor(COLOR.text).stroke();
  doc.moveTo(x0 + 360, sigY).lineTo(x0 + 520, sigY).strokeColor(COLOR.text).stroke();
  doc.font('Sarabun').fontSize(10).fillColor(COLOR.textMuted);
  doc.text('Homeroom Teacher', x0 + 60, sigY + 6, { width: 160, align: 'center' });
  doc.text('Principal', x0 + 360, sigY + 6, { width: 160, align: 'center' });
  doc.fontSize(9).fillColor(COLOR.textLight);
  doc.text('ครูประจำชั้น', x0 + 60, sigY + 20, { width: 160, align: 'center' });
  doc.text('ผู้อำนวยการ', x0 + 360, sigY + 20, { width: 160, align: 'center' });

  // Footer date
  const footY = PAGE.height - PAGE.margin - 20;
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.textMuted)
     .text(`Generated: ${formatThaiDate(new Date().toISOString())}`, x0, footY)
     .text(`Powered by PanyaSchoolKit`, x0, footY, { width: CONTENT_W, align: 'right' });

  doc.end();
}

function formatScore(s) {
  if (s === null || s === undefined) return '—';
  return Number(s).toFixed(1);
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
    // Auth
    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!userJwt) return res.status(401).json({ error: 'unauthorized' });
    let userId;
    try {
      const segs = userJwt.split('.');
      const padded = segs[1] + '='.repeat((4 - segs[1].length % 4) % 4);
      const payload = JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      userId = payload.sub;
    } catch { return res.status(401).json({ error: 'invalid_jwt' }); }

    const { year, term, student_id } = req.query;
    if (!year || !term) return res.status(400).json({ error: 'missing_year_or_term' });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get profile + school
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, school_id, role')
      .eq('id', userId)
      .single();
    if (!profile) return res.status(403).json({ error: 'forbidden' });

    const { data: school } = await supabase
      .from('schools')
      .select('id, name_th, name_en, custom_domain, slug')
      .eq('id', profile.school_id)
      .single();

    // Resolve student
    let targetStudentId = student_id;
    if (!targetStudentId) {
      const { data: ownStudent } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', userId)
        .eq('school_id', profile.school_id)
        .single();
      targetStudentId = ownStudent?.id;
    }

    if (!targetStudentId) return res.status(404).json({ error: 'student_not_found' });

    // Get student
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('id', targetStudentId)
      .single();
    if (!student) return res.status(404).json({ error: 'student_not_found' });

    // Access check: must be staff OR own student OR parent
    const isStaff = ['staff','owner','developer'].includes(profile.role);
    const isSelf = student.profile_id === userId;
    if (!isStaff && !isSelf) {
      // Check parent relationship
      const { data: relation } = await supabase
        .from('parent_students')
        .select('id')
        .eq('parent_profile_id', userId)
        .eq('student_id', targetStudentId)
        .maybeSingle();
      if (!relation) return res.status(403).json({ error: 'no_access' });
    }

    // Get grades
    const gradeQuery = supabase
      .from('student_grades')
      .select('*')
      .eq('student_id', targetStudentId)
      .eq('academic_year', year)
      .eq('term', term);
    if (!isStaff) gradeQuery.eq('published', true);
    const { data: grades } = await gradeQuery.order('subject_code');

    // GPA
    let gpa = null, totalCredits = 0;
    if (grades && grades.length) {
      let weightedSum = 0;
      grades.forEach(g => {
        if (g.grade_value !== null && g.grade_value !== undefined) {
          const credits = Number(g.credit_hours || 1);
          weightedSum += Number(g.grade_value) * credits;
          totalCredits += credits;
        }
      });
      if (totalCredits > 0) gpa = weightedSum / totalCredits;
    }

    const summary = { gpa, total_credits: totalCredits };

    // Set headers + build PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-card-${student.student_number || targetStudentId}-${year}-${term}.pdf"`);

    await buildPDF({
      school, student,
      grades: grades || [],
      summary, year, term, res
    });
  } catch (err) {
    console.error('[report-card-pdf] error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'server_error', detail: err.message });
  }
};
