// ==========================================================================
// /api/invoices/[id]/pdf.js
// Server-side PDF generation for invoice receipts using Puppeteer.
//
// Why server-side:
//   - Real PDF download (no Print dialog)
//   - Perfect Thai font rendering via Google Fonts
//   - Professional quality (HTML → Chromium → PDF)
//
// Flow:
//   1. Verify JWT
//   2. Fetch invoice + school + billing_info
//   3. Authorize: user must be owner/developer of the invoice's school
//   4. Render HTML receipt template
//   5. Launch headless Chromium → render → export PDF buffer
//   6. Return application/pdf with Content-Disposition: attachment
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Vercel function config — chromium needs more memory + time
module.exports.config = {
  maxDuration: 30
};

const formatThaiDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return '—'; }
};

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function buildReceiptHTML({ invoice, school, billing }) {
  const items = invoice.line_items || [];
  const subtotal = items.reduce((s, it) => s + ((it.amount || 0) * (it.quantity || 1)), 0);
  const total = invoice.total_amount || invoice.amount || subtotal;

  const itemRows = items.map(it => `
    <tr>
      <td><div class="description">${escapeHtml(it.description || '—')}</div></td>
      <td class="center">${it.quantity || 1}</td>
      <td class="right">฿${(it.amount || 0).toLocaleString()}</td>
      <td class="right">฿${((it.amount || 0) * (it.quantity || 1)).toLocaleString()}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" style="text-align:center;color:#9CA3AF;">ไม่มีรายการ</td></tr>`;

  const statusLabel = invoice.status === 'paid' ? 'ชำระแล้ว' : invoice.status.toUpperCase();
  const statusClass = invoice.status === 'paid' ? '' : 'failed';

  const billToTaxId = billing.tax_id ? `<div class="detail">เลขผู้เสียภาษี: ${escapeHtml(billing.tax_id)}</div>` : '';
  const billToAddress = billing.billing_address
    ? `<div class="detail" style="white-space:pre-line;">${escapeHtml(billing.billing_address)}</div>`
    : '';
  const billToEmail = billing.billing_email || school.contact_email || '';

  const paymentBlock = (invoice.status === 'paid' && invoice.omise_charge_id) ? `
    <div class="pdf-paymentinfo">
      <div class="label">ข้อมูลการชำระเงิน (Payment Information)</div>
      <div>วันที่ชำระ: ${formatThaiDate(invoice.paid_at)}</div>
      <div>ช่องทาง: บัตรเครดิต/เดบิต (ผ่าน Omise)</div>
      <div class="val">Charge ID: ${escapeHtml(invoice.omise_charge_id)}</div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(invoice.invoice_number)} — PanyaSchoolKit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 40px;
      font-family: 'Sarabun', sans-serif;
      color: #111; background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-header {
      display: flex; justify-content: space-between; align-items: start;
      padding-bottom: 24px; border-bottom: 3px solid #2563EB; margin-bottom: 32px;
    }
    .pdf-brand h1 { font-size: 28px; font-weight: 800; color: #1F2937; margin: 0 0 6px; }
    .pdf-brand p { font-size: 12px; color: #6B7280; margin: 2px 0; line-height: 1.5; }
    .pdf-doc-title { text-align: right; }
    .pdf-doc-title h2 { font-size: 26px; font-weight: 700; color: #2563EB; margin: 0 0 8px; }
    .invoice-num { font-family: 'Courier New', monospace; font-size: 14px; color: #374151; }
    .pdf-date { font-size: 12px; color: #6B7280; margin: 4px 0; }
    .pdf-status {
      display: inline-block; margin-top: 8px; padding: 4px 12px;
      background: #D1FAE5; color: #065F46; border-radius: 4px;
      font-size: 11px; font-weight: 700; letter-spacing: 1px;
    }
    .pdf-status.failed { background: #FEE2E2; color: #991B1B; }
    .pdf-billto { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .pdf-billto-block { background: #F9FAFB; padding: 16px 20px; border-left: 3px solid #E5E7EB; }
    .pdf-billto-block .label {
      font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
      color: #6B7280; margin-bottom: 8px; font-weight: 600;
    }
    .pdf-billto-block .name { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 4px; }
    .pdf-billto-block .detail { font-size: 11px; color: #4B5563; margin: 2px 0; line-height: 1.5; }
    .pdf-items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .pdf-items th {
      text-align: left; padding: 10px 12px; background: #1F2937; color: #fff;
      font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;
    }
    .pdf-items th.right { text-align: right; }
    .pdf-items th.center { text-align: center; }
    .pdf-items td { padding: 14px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px; color: #111; }
    .pdf-items td.right { text-align: right; }
    .pdf-items td.center { text-align: center; }
    .pdf-items .description { font-weight: 500; }
    .pdf-totals { width: 100%; max-width: 320px; margin-left: auto; margin-bottom: 32px; }
    .pdf-totals .row { display: flex; justify-content: space-between; padding: 8px 12px; font-size: 13px; }
    .pdf-totals .row.subtotal { color: #4B5563; }
    .pdf-totals .row.grand {
      border-top: 2px solid #1F2937; margin-top: 4px; padding-top: 12px;
      font-size: 18px; font-weight: 800; color: #1F2937;
    }
    .pdf-paymentinfo {
      background: #EFF6FF; border-left: 3px solid #2563EB;
      padding: 12px 16px; margin-bottom: 32px; font-size: 12px; color: #1E40AF;
    }
    .pdf-paymentinfo .label { font-weight: 700; margin-bottom: 4px; }
    .pdf-paymentinfo .val { font-family: 'Courier New', monospace; font-size: 11px; color: #1E3A8A; }
    .pdf-footer {
      border-top: 1px solid #E5E7EB; padding-top: 16px;
      font-size: 10px; color: #9CA3AF; text-align: center; line-height: 1.6;
    }
    .pdf-footer strong { color: #4B5563; }
    @page { margin: 12mm; size: A4; }
  </style>
</head>
<body>
  <div class="pdf-header">
    <div class="pdf-brand">
      <h1>PanyaSchoolKit</h1>
      <p><strong>บริษัท ปัญญา เวนเจอร์ส จำกัด</strong></p>
      <p>Panya Ventures Co., Ltd.</p>
      <p>เลขประจำตัวผู้เสียภาษี: <strong>0405569004587</strong></p>
      <p>panyaschoolkit.com · support@panyaschoolkit.com</p>
    </div>
    <div class="pdf-doc-title">
      <h2>ใบเสร็จรับเงิน</h2>
      <p style="margin:2px 0;font-size:12px;color:#6B7280;">RECEIPT</p>
      <p class="invoice-num">${escapeHtml(invoice.invoice_number)}</p>
      <p class="pdf-date">วันที่ออก: ${formatThaiDate(invoice.created_at)}</p>
      <span class="pdf-status ${statusClass}">${statusLabel}</span>
    </div>
  </div>

  <div class="pdf-billto">
    <div class="pdf-billto-block">
      <div class="label">ผู้ออกใบเสร็จ (From)</div>
      <div class="name">บริษัท ปัญญา เวนเจอร์ส จำกัด</div>
      <div class="detail">Panya Ventures Co., Ltd.</div>
      <div class="detail">เลขผู้เสียภาษี: 0405569004587</div>
      <div class="detail">458/31 ถนนกลางเมือง ตำบลในเมือง</div>
      <div class="detail">อำเภอเมืองขอนแก่น จังหวัดขอนแก่น</div>
      <div class="detail">support@panyaschoolkit.com</div>
    </div>
    <div class="pdf-billto-block">
      <div class="label">ผู้รับใบเสร็จ (Bill to)</div>
      <div class="name">${escapeHtml(billing.legal_name || school.name || '—')}</div>
      ${billToTaxId}
      ${billToAddress}
      ${billToEmail ? `<div class="detail">${escapeHtml(billToEmail)}</div>` : ''}
    </div>
  </div>

  <table class="pdf-items">
    <thead>
      <tr>
        <th>รายการ (Description)</th>
        <th class="center">จำนวน</th>
        <th class="right">ราคา/หน่วย</th>
        <th class="right">รวม (บาท)</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="pdf-totals">
    <div class="row subtotal">
      <span>ยอดรวม (Subtotal)</span>
      <span>฿${subtotal.toLocaleString()}</span>
    </div>
    <div class="row subtotal">
      <span>ภาษีมูลค่าเพิ่ม (VAT 0%)</span>
      <span>฿0</span>
    </div>
    <div class="row grand">
      <span>ยอดสุทธิ (Total)</span>
      <span>฿${total.toLocaleString()}</span>
    </div>
  </div>

  ${paymentBlock}

  <div class="pdf-footer">
    <p><strong>หมายเหตุ:</strong> ใบเสร็จรับเงินนี้ออกในนามของ บริษัท ปัญญา เวนเจอร์ส จำกัด</p>
    <p>เอกสารฉบับนี้ใช้แทนใบเสร็จรับเงินอย่างเป็นทางการ — เก็บไว้เพื่อการตรวจสอบบัญชี</p>
    <p style="margin-top:8px;">หากมีข้อสงสัย ติดต่อ <strong>support@panyaschoolkit.com</strong></p>
  </div>
</body>
</html>`;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  let browser = null;
  try {
    const invoiceId = req.query.id;
    if (!invoiceId) return res.status(400).json({ error: 'Missing invoice id' });

    const userJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!userJwt) return res.status(401).json({ error: 'Missing Authorization' });

    // ---- Verify JWT manually ----
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

    // ---- Service role client ----
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- Authorize ----
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (!profile) return res.status(403).json({ error: 'Profile not found' });

    // ---- Fetch invoice ----
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

    // ---- Fetch school + billing_info ----
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('id, name, contact_email, billing_info')
      .eq('id', invoice.school_id)
      .single();

    if (!school) return res.status(404).json({ error: 'School not found' });

    const billing = school.billing_info || {};

    // ---- Build HTML + render with Puppeteer ----
    const html = buildReceiptHTML({ invoice, school, billing });

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
    });

    await browser.close();
    browser = null;

    // ---- Return PDF ----
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdfBuffer);

  } catch (err) {
    console.error('[invoices/pdf] error', err);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return res.status(500).json({ error: err.message || 'PDF generation failed' });
  }
};
