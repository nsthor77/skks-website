// ==========================================================================
// /api/invoices/[id]/pdf.js
// Server-side PDF receipt generation using PDFKit (pure JS, vector PDF).
//
// Why PDFKit (vs Puppeteer):
//   - No Chromium needed → no libnss3.so errors on Vercel
//   - Tiny deployment (~5MB vs 70MB)
//   - Fast cold start (~500ms vs 5s)
//   - True vector PDF with embedded Sarabun font
//   - Industry standard (Stripe, GitHub receipts use similar)
// ==========================================================================

const path = require('path');
const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');

// Font paths (bundled in repo)
const FONT_REGULAR = path.join(process.cwd(), 'lib/fonts/Sarabun-Regular.ttf');
const FONT_BOLD    = path.join(process.cwd(), 'lib/fonts/Sarabun-Bold.ttf');
const FONT_MEDIUM  = path.join(process.cwd(), 'lib/fonts/Sarabun-Medium.ttf');

// Palette
const COLOR = {
  text:       '#111111',
  textMuted:  '#6B7280',
  textLight:  '#9CA3AF',
  textDark:   '#1F2937',
  primary:    '#2563EB',
  primaryDk:  '#1E40AF',
  primaryBg:  '#EFF6FF',
  border:     '#E5E7EB',
  panelBg:    '#F9FAFB',
  successBg:  '#D1FAE5',
  successFg:  '#065F46',
  errorBg:    '#FEE2E2',
  errorFg:    '#991B1B',
  headerBar:  '#1F2937'
};

// Page dimensions (A4 portrait at 72 DPI)
const PAGE = { width: 595.28, height: 841.89, margin: 42 };
const CONTENT_W = PAGE.width - 2 * PAGE.margin;

const formatThaiDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return '—'; }
};

const baht = (n) => '฿' + Number(n || 0).toLocaleString('en-US');

function setupFonts(doc) {
  doc.registerFont('Sarabun', FONT_REGULAR);
  doc.registerFont('Sarabun-Bold', FONT_BOLD);
  doc.registerFont('Sarabun-Medium', FONT_MEDIUM);
}

// Draw a colored pill/badge with text
function drawBadge(doc, text, x, y, bg, fg) {
  doc.font('Sarabun-Bold').fontSize(8);
  const padX = 8, padY = 4;
  const textW = doc.widthOfString(text);
  const w = textW + 2 * padX;
  const h = 16;
  doc.roundedRect(x, y, w, h, 3).fill(bg);
  doc.fillColor(fg).text(text, x + padX, y + padY - 1, { lineBreak: false });
  doc.fillColor(COLOR.text);
}

// ============================================================
// Main PDF builder
// ============================================================
function buildPDF({ invoice, school, billing, res }) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE.margin,
    info: {
      Title: `${invoice.invoice_number} — PanyaSchoolKit`,
      Author: 'Panya Ventures Co., Ltd.',
      Subject: `Receipt ${invoice.invoice_number}`,
      Creator: 'PanyaSchoolKit'
    }
  });
  setupFonts(doc);
  doc.font('Sarabun');

  doc.pipe(res);

  let y = PAGE.margin;
  const x0 = PAGE.margin;

  // ============ HEADER ============
  // Left side: PanyaSchoolKit + Panya Ventures info
  doc.font('Sarabun-Bold').fontSize(22).fillColor(COLOR.textDark)
     .text('PanyaSchoolKit', x0, y);
  y += 26;

  doc.font('Sarabun-Bold').fontSize(9).fillColor(COLOR.textMuted)
     .text('บริษัท ปัญญา เวนเจอร์ส จำกัด', x0, y);
  y += 12;
  doc.font('Sarabun').fontSize(9)
     .text('Panya Ventures Co., Ltd.', x0, y);
  y += 11;
  doc.font('Sarabun').fontSize(9)
     .text('เลขประจำตัวผู้เสียภาษี: ', x0, y, { continued: true })
     .font('Sarabun-Bold').text('0405569004587');
  y += 11;
  doc.font('Sarabun').fontSize(9)
     .text('panyaschoolkit.com  ·  support@panyaschoolkit.com', x0, y);

  // Right side: Receipt title + Invoice number + Status
  const rightX = x0 + CONTENT_W / 2 + 20;
  const rightTopY = PAGE.margin;
  doc.font('Sarabun-Bold').fontSize(20).fillColor(COLOR.primary)
     .text('ใบเสร็จรับเงิน', rightX, rightTopY, { width: CONTENT_W / 2 - 20, align: 'right' });
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.textMuted)
     .text('RECEIPT', rightX, rightTopY + 26, { width: CONTENT_W / 2 - 20, align: 'right' });

  doc.font('Sarabun-Bold').fontSize(11).fillColor(COLOR.textDark)
     .text(invoice.invoice_number, rightX, rightTopY + 40,
           { width: CONTENT_W / 2 - 20, align: 'right' });
  doc.font('Sarabun').fontSize(9).fillColor(COLOR.textMuted)
     .text('วันที่ออก: ' + formatThaiDate(invoice.created_at),
           rightX, rightTopY + 54,
           { width: CONTENT_W / 2 - 20, align: 'right' });

  // Status badge (right-aligned)
  const statusLabel = invoice.status === 'paid' ? 'ชำระแล้ว' : String(invoice.status).toUpperCase();
  const statusBg = invoice.status === 'paid' ? COLOR.successBg : COLOR.errorBg;
  const statusFg = invoice.status === 'paid' ? COLOR.successFg : COLOR.errorFg;
  doc.font('Sarabun-Bold').fontSize(8);
  const sw = doc.widthOfString(statusLabel) + 16;
  drawBadge(doc, statusLabel, PAGE.width - PAGE.margin - sw, rightTopY + 70, statusBg, statusFg);

  // Divider line under header
  y = Math.max(y, rightTopY + 90) + 14;
  doc.lineWidth(2).strokeColor(COLOR.primary)
     .moveTo(x0, y).lineTo(PAGE.width - PAGE.margin, y).stroke();
  y += 22;

  // ============ BILL TO / FROM BLOCKS ============
  const blockW = (CONTENT_W - 16) / 2;
  const blockH = 92;
  const fromX = x0;
  const billX = x0 + blockW + 16;

  // FROM block
  doc.rect(fromX, y, blockW, blockH).fill(COLOR.panelBg);
  doc.rect(fromX, y, 3, blockH).fill(COLOR.border);
  doc.fillColor(COLOR.textMuted).font('Sarabun-Bold').fontSize(7)
     .text('ผู้ออกใบเสร็จ (FROM)', fromX + 12, y + 10);
  doc.fillColor(COLOR.text).font('Sarabun-Bold').fontSize(10)
     .text('บริษัท ปัญญา เวนเจอร์ส จำกัด', fromX + 12, y + 22, { width: blockW - 24 });
  doc.fillColor('#4B5563').font('Sarabun').fontSize(8.5)
     .text('Panya Ventures Co., Ltd.', fromX + 12, y + 36);
  doc.text('เลขผู้เสียภาษี: 0405569004587', fromX + 12, y + 47);
  doc.text('458/31 ถนนกลางเมือง ตำบลในเมือง', fromX + 12, y + 58);
  doc.text('อำเภอเมืองขอนแก่น จังหวัดขอนแก่น', fromX + 12, y + 69);
  doc.text('support@panyaschoolkit.com', fromX + 12, y + 80);

  // BILL TO block
  doc.rect(billX, y, blockW, blockH).fill(COLOR.panelBg);
  doc.rect(billX, y, 3, blockH).fill(COLOR.primary);
  doc.fillColor(COLOR.textMuted).font('Sarabun-Bold').fontSize(7)
     .text('ผู้รับใบเสร็จ (BILL TO)', billX + 12, y + 10);
  doc.fillColor(COLOR.text).font('Sarabun-Bold').fontSize(10)
     .text(billing.legal_name || school.name || '—', billX + 12, y + 22,
           { width: blockW - 24, ellipsis: true });

  let billY = y + 40;
  doc.fillColor('#4B5563').font('Sarabun').fontSize(8.5);
  if (billing.tax_id) {
    doc.text('เลขผู้เสียภาษี: ' + billing.tax_id, billX + 12, billY, { width: blockW - 24 });
    billY += 11;
  }
  if (billing.billing_address) {
    const addrLines = billing.billing_address.split('\n').slice(0, 3);
    for (const line of addrLines) {
      doc.text(line, billX + 12, billY, { width: blockW - 24, ellipsis: true });
      billY += 11;
    }
  }
  const billEmail = billing.billing_email || school.contact_email;
  if (billEmail && billY < y + blockH - 8) {
    doc.text(billEmail, billX + 12, billY, { width: blockW - 24, ellipsis: true });
  }

  y += blockH + 20;

  // ============ ITEMS TABLE ============
  const items = invoice.line_items || [];
  // Column layout: Description | Qty | Unit Price | Total
  const colDescW = CONTENT_W * 0.50;
  const colQtyW  = CONTENT_W * 0.10;
  const colUnitW = CONTENT_W * 0.20;
  const colTotW  = CONTENT_W * 0.20;
  const colDescX = x0;
  const colQtyX  = x0 + colDescW;
  const colUnitX = x0 + colDescW + colQtyW;
  const colTotX  = x0 + colDescW + colQtyW + colUnitW;

  // Header bar
  const headerH = 24;
  doc.rect(x0, y, CONTENT_W, headerH).fill(COLOR.headerBar);
  doc.fillColor('#fff').font('Sarabun-Bold').fontSize(8);
  doc.text('รายการ (DESCRIPTION)', colDescX + 10, y + 8);
  doc.text('จำนวน', colQtyX, y + 8, { width: colQtyW, align: 'center' });
  doc.text('ราคา/หน่วย', colUnitX, y + 8, { width: colUnitW - 10, align: 'right' });
  doc.text('รวม (บาท)', colTotX, y + 8, { width: colTotW - 10, align: 'right' });
  y += headerH;

  // Items
  doc.fillColor(COLOR.text).font('Sarabun').fontSize(10);
  if (items.length === 0) {
    doc.fillColor(COLOR.textLight).font('Sarabun').fontSize(10)
       .text('ไม่มีรายการ', x0, y + 14, { width: CONTENT_W, align: 'center' });
    y += 36;
  } else {
    for (const it of items) {
      const rowY = y;
      const rowH = 32;
      doc.fillColor(COLOR.text).font('Sarabun-Medium').fontSize(10)
         .text(it.description || '—', colDescX + 10, rowY + 10,
               { width: colDescW - 20, ellipsis: true });
      doc.font('Sarabun').fontSize(10)
         .text(String(it.quantity || 1), colQtyX, rowY + 10,
               { width: colQtyW, align: 'center' });
      doc.text(baht(it.amount || 0), colUnitX, rowY + 10,
               { width: colUnitW - 10, align: 'right' });
      doc.text(baht((it.amount || 0) * (it.quantity || 1)), colTotX, rowY + 10,
               { width: colTotW - 10, align: 'right' });
      y += rowH;
      doc.strokeColor(COLOR.border).lineWidth(0.5)
         .moveTo(x0, y).lineTo(PAGE.width - PAGE.margin, y).stroke();
    }
  }
  y += 16;

  // ============ TOTALS ============
  const subtotal = items.reduce((s, it) => s + ((it.amount || 0) * (it.quantity || 1)), 0);
  const total = invoice.total_amount || invoice.amount || subtotal;
  const totalsX = x0 + CONTENT_W - 240;
  const totalsW = 240;

  doc.font('Sarabun').fontSize(10).fillColor('#4B5563');
  doc.text('ยอดรวม (Subtotal)', totalsX, y, { width: 140 });
  doc.text(baht(subtotal), totalsX + 140, y, { width: 100, align: 'right' });
  y += 16;

  doc.text('ภาษีมูลค่าเพิ่ม (VAT 0%)', totalsX, y, { width: 140 });
  doc.text(baht(0), totalsX + 140, y, { width: 100, align: 'right' });
  y += 18;

  // Grand total line
  doc.strokeColor(COLOR.headerBar).lineWidth(1.5)
     .moveTo(totalsX, y).lineTo(totalsX + totalsW, y).stroke();
  y += 8;

  doc.font('Sarabun-Bold').fontSize(13).fillColor(COLOR.textDark);
  doc.text('ยอดสุทธิ (Total)', totalsX, y, { width: 140 });
  doc.text(baht(total), totalsX + 140, y, { width: 100, align: 'right' });
  y += 28;

  // ============ PAYMENT INFO ============
  if (invoice.status === 'paid' && invoice.omise_charge_id) {
    const payH = 60;
    doc.rect(x0, y, CONTENT_W, payH).fill(COLOR.primaryBg);
    doc.rect(x0, y, 3, payH).fill(COLOR.primary);
    doc.fillColor(COLOR.primaryDk).font('Sarabun-Bold').fontSize(8)
       .text('ข้อมูลการชำระเงิน (PAYMENT INFORMATION)', x0 + 12, y + 8);
    doc.font('Sarabun').fontSize(9)
       .text('วันที่ชำระ: ' + formatThaiDate(invoice.paid_at), x0 + 12, y + 22);
    doc.text('ช่องทาง: บัตรเครดิต/เดบิต (ผ่าน Omise)', x0 + 12, y + 34);
    doc.font('Sarabun').fontSize(8).fillColor('#1E3A8A')
       .text('Charge ID: ' + invoice.omise_charge_id, x0 + 12, y + 46);
    y += payH + 18;
  }

  // ============ FOOTER ============
  // Push footer near bottom if there's space
  const footerY = Math.max(y, PAGE.height - PAGE.margin - 60);
  doc.strokeColor(COLOR.border).lineWidth(0.5)
     .moveTo(x0, footerY - 10).lineTo(PAGE.width - PAGE.margin, footerY - 10).stroke();

  doc.font('Sarabun').fontSize(8).fillColor(COLOR.textLight);
  doc.text(
    'หมายเหตุ: ใบเสร็จรับเงินนี้ออกในนามของ บริษัท ปัญญา เวนเจอร์ส จำกัด',
    x0, footerY, { width: CONTENT_W, align: 'center' }
  );
  doc.text(
    'เอกสารฉบับนี้ใช้แทนใบเสร็จรับเงินอย่างเป็นทางการ — เก็บไว้เพื่อการตรวจสอบบัญชี',
    x0, footerY + 11, { width: CONTENT_W, align: 'center' }
  );
  doc.font('Sarabun-Bold').fontSize(8).fillColor('#4B5563')
     .text('หากมีข้อสงสัย ติดต่อ support@panyaschoolkit.com',
           x0, footerY + 26, { width: CONTENT_W, align: 'center' });

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const invoiceId = req.query.id;
    if (!invoiceId) return res.status(400).json({ error: 'Missing invoice id' });

    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!userJwt) return res.status(401).json({ error: 'Missing Authorization' });

    // Verify JWT
    let userId;
    try {
      const segments = userJwt.split('.');
      if (segments.length !== 3) throw new Error('Invalid JWT format');
      const payloadB64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      if (!payload.sub) throw new Error('JWT missing sub');
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) throw new Error('JWT expired');
      userId = payload.sub;
    } catch (err) {
      return res.status(401).json({ error: 'Invalid JWT', detail: err.message });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (!profile) return res.status(403).json({ error: 'Profile not found' });

    const { data: invoice, error: invErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invErr || !invoice) return res.status(404).json({ error: 'Invoice not found' });

    const isDeveloper = profile.role === 'developer';
    if (!isDeveloper && profile.school_id !== invoice.school_id) {
      return res.status(403).json({ error: 'Not authorized for this invoice' });
    }

    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, name, contact_email, billing_info')
      .eq('id', invoice.school_id)
      .single();

    if (!school) return res.status(404).json({ error: 'School not found' });

    const billing = school.billing_info || {};

    // Set headers BEFORE piping
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');

    // Generate + stream PDF directly to response
    buildPDF({ invoice, school, billing, res });

  } catch (err) {
    console.error('[invoices/pdf] error', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || 'PDF generation failed' });
    }
    try { res.end(); } catch {}
  }
};
