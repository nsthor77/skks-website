// ==========================================================================
// /lib/email.js
// Shared email module — used by Vercel Functions to send transactional emails.
//
// Templates included:
//   - welcomeTrial         (after card added + trial activated)
//   - chargeSucceeded      (charge.complete webhook)
//   - chargeFailed         (charge.failed webhook)
//   - subscriptionCancelled (after /api/billing/cancel)
//   - subscriptionResumed  (after resume RPC)
//   - planChanged          (after /api/billing/change-plan)
//
// Usage:
//   const { sendEmail, emailTemplates } = require('../../lib/email');
//   await sendEmail({
//     to: 'school@example.com',
//     ...emailTemplates.welcomeTrial({ schoolName, trialEnd, planId })
//   });
//
// Env vars required:
//   - RESEND_API_KEY (from resend.com/api-keys)
//   - EMAIL_FROM (e.g. noreply@panyaschoolkit.com)
// ==========================================================================

const { Resend } = require('resend');

// Brand constants
const BRAND_NAME = 'PanyaSchoolKit';
const BRAND_URL = 'https://panyaschoolkit.com';
const SUPPORT_EMAIL = 'support@panyaschoolkit.com';

// Color palette (matches admin/billing UI)
const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  success: '#065F46',
  successBg: '#D1FAE5',
  warning: '#92400E',
  warningBg: '#FEF3C7',
  danger: '#991B1B',
  dangerBg: '#FEE2E2',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  bg: '#F9FAFB'
};

// ==========================================================================
// Core sendEmail function
// ==========================================================================
async function sendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[email] RESEND_API_KEY not set — skipping email send');
    return { sent: false, error: 'missing_api_key' };
  }
  if (!to) {
    console.error('[email] missing "to" address');
    return { sent: false, error: 'missing_to' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || `${BRAND_NAME} <noreply@panyaschoolkit.com>`;

  try {
    const result = await resend.emails.send({
      from: from,
      to: to,
      subject: subject,
      html: html,
      replyTo: replyTo || SUPPORT_EMAIL
    });

    if (result.error) {
      console.error('[email] Resend API error', result.error);
      return { sent: false, error: result.error.message };
    }

    console.log('[email] sent', { to, subject, id: result.data?.id });
    return { sent: true, id: result.data?.id };

  } catch (err) {
    console.error('[email] exception', err);
    return { sent: false, error: err.message };
  }
}

// ==========================================================================
// HTML template wrapper — branding + layout
// ==========================================================================
function wrap(content, options = {}) {
  const { ctaText, ctaUrl, preheader = '' } = options;

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:${COLORS.bg};color:${COLORS.text};">
  ${preheader ? `<div style="display:none;font-size:1px;color:transparent;opacity:0;visibility:hidden;">${preheader}</div>` : ''}

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.bg};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${COLORS.border};">

          <!-- Header -->
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid ${COLORS.border};">
              <div style="font-size:18px;font-weight:700;color:${COLORS.text};">
                <span style="display:inline-block;width:24px;height:24px;background:${COLORS.primary};border-radius:6px;vertical-align:middle;margin-right:8px;"></span>
                ${BRAND_NAME}
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:28px;">
              ${content}

              ${ctaText && ctaUrl ? `
                <div style="margin:24px 0;text-align:center;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;background:${COLORS.primary};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${ctaText}</a>
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px;border-top:1px solid ${COLORS.border};background:${COLORS.bg};">
              <p style="margin:0 0 6px;font-size:12px;color:${COLORS.textMuted};">
                ${BRAND_NAME} — ระบบจัดการโรงเรียนแบบครบวงจร
              </p>
              <p style="margin:0;font-size:11px;color:${COLORS.textMuted};">
                <a href="${BRAND_URL}" style="color:${COLORS.primary};text-decoration:none;">panyaschoolkit.com</a>
                · ติดต่อสอบถาม: <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLORS.primary};text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Helper: human-readable plan name
const planNames = { starter: 'Starter', pro: 'Pro', premium: 'Premium' };
const cycleNames = { monthly: 'รายเดือน', yearly: 'รายปี' };
const planPrices = {
  starter: { monthly: 1990, yearly: 19104 },
  pro: { monthly: 3990, yearly: 38304 },
  premium: { monthly: 6990, yearly: 67104 }
};

function formatThaiDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ==========================================================================
// Email templates — each returns { subject, html }
// ==========================================================================

const emailTemplates = {
  // 1. Welcome — sent when trial activates after card added
  welcomeTrial({ schoolName, trialEnd, planId, billingCycle, billingUrl }) {
    const subject = `🎉 ยินดีต้อนรับสู่ ${BRAND_NAME}! Trial 14 วันเริ่มแล้ว`;
    const content = `
      <h1 style="margin:0 0 16px;font-size:24px;color:${COLORS.text};">🎉 ยินดีต้อนรับ!</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">
        สวัสดีค่ะ/ครับ <strong>${schoolName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">
        ขอบคุณที่เลือกใช้ ${BRAND_NAME} ระบบ trial 14 วันของคุณเริ่มแล้ว
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.warningBg};border:1px solid #FCD34D;border-radius:8px;margin:20px 0;">
        <tr>
          <td style="padding:16px;">
            <p style="margin:0 0 6px;font-size:13px;color:${COLORS.warning};font-weight:600;">📦 รายละเอียดแพ็คเกจของคุณ</p>
            <p style="margin:0;font-size:14px;color:${COLORS.warning};line-height:1.6;">
              <strong>${planNames[planId] || planId}</strong> (${cycleNames[billingCycle] || billingCycle})<br/>
              ทดลองฟรีถึง: <strong>${formatThaiDate(trialEnd)}</strong><br/>
              หลังจากนั้น: ฿${(planPrices[planId]?.[billingCycle] || 0).toLocaleString()}${billingCycle === 'yearly' ? '/ปี' : '/เดือน'}
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        ใช้งานได้ทันที — ทุกฟีเจอร์ของแพ็คเกจ ${planNames[planId]} เปิดให้ใช้ในช่วง trial
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.textMuted};">
        ⚠️ <em>ยกเลิกก่อน ${formatThaiDate(trialEnd)} = ไม่เสียค่าใช้จ่าย</em>
      </p>
    `;
    return {
      subject,
      html: wrap(content, {
        ctaText: 'เข้าใช้งาน Dashboard',
        ctaUrl: billingUrl || `${BRAND_URL}/login`,
        preheader: `Trial 14 วันของ ${schoolName} เริ่มแล้ว`
      })
    };
  },

  // 2. Charge succeeded — billing webhook
  chargeSucceeded({ schoolName, amountBaht, planId, billingCycle, invoiceNumber, nextBillingDate, billingUrl }) {
    const subject = `✅ ใบเสร็จ ${invoiceNumber} — ${BRAND_NAME}`;
    const content = `
      <h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.success};">✅ การชำระเงินสำเร็จ</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        สวัสดีครับ <strong>${schoolName}</strong>, ระบบได้เรียกเก็บเงินสำหรับแพ็คเกจของคุณเรียบร้อยแล้ว
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.successBg};border:1px solid #6EE7B7;border-radius:8px;margin:20px 0;">
        <tr>
          <td style="padding:18px;">
            <p style="margin:0 0 8px;font-size:13px;color:${COLORS.success};font-weight:600;">รายละเอียดการชำระเงิน</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="font-size:13px;color:${COLORS.text};padding:4px 0;">เลขที่ใบเสร็จ</td><td style="font-size:13px;color:${COLORS.text};font-weight:600;text-align:right;font-family:monospace;">${invoiceNumber}</td></tr>
              <tr><td style="font-size:13px;color:${COLORS.text};padding:4px 0;">แพ็คเกจ</td><td style="font-size:13px;color:${COLORS.text};font-weight:600;text-align:right;">${planNames[planId] || planId} ${cycleNames[billingCycle] || ''}</td></tr>
              <tr><td style="font-size:13px;color:${COLORS.text};padding:4px 0;">จำนวนเงิน</td><td style="font-size:16px;color:${COLORS.text};font-weight:700;text-align:right;">฿${(amountBaht || 0).toLocaleString()}</td></tr>
              ${nextBillingDate ? `<tr><td style="font-size:13px;color:${COLORS.text};padding:4px 0;">เรียกเก็บครั้งต่อไป</td><td style="font-size:13px;color:${COLORS.text};text-align:right;">${formatThaiDate(nextBillingDate)}</td></tr>` : ''}
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${COLORS.textMuted};">
        ใบเสร็จเต็มรูปแบบดูได้ที่หน้า Invoices
      </p>
    `;
    return {
      subject,
      html: wrap(content, {
        ctaText: 'ดูใบเสร็จทั้งหมด',
        ctaUrl: billingUrl || `${BRAND_URL}/invoices`,
        preheader: `${BRAND_NAME} เรียกเก็บเงิน ฿${(amountBaht || 0).toLocaleString()} สำเร็จ`
      })
    };
  },

  // 3. Charge failed — billing webhook
  chargeFailed({ schoolName, amountBaht, reason, billingUrl }) {
    const subject = `⚠️ การชำระเงินไม่สำเร็จ — กรุณาอัปเดตบัตร`;
    const content = `
      <h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.danger};">⚠️ การชำระเงินไม่สำเร็จ</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        สวัสดีครับ <strong>${schoolName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        ระบบไม่สามารถเรียกเก็บเงิน <strong>฿${(amountBaht || 0).toLocaleString()}</strong> จากบัตรเครดิตของคุณได้
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.dangerBg};border:1px solid #FCA5A5;border-radius:8px;margin:20px 0;">
        <tr>
          <td style="padding:16px;">
            <p style="margin:0;font-size:13px;color:${COLORS.danger};line-height:1.6;">
              <strong>สาเหตุ:</strong> ${reason || 'บัตรเครดิตไม่สามารถชำระได้ (เช่น เงินไม่พอ บัตรหมดอายุ ฯลฯ)'}
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        เพื่อหลีกเลี่ยงการระงับบริการ กรุณา <strong>อัปเดตบัตรเครดิต</strong>ภายใน 7 วัน
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${COLORS.textMuted};">
        ระบบจะลองเรียกเก็บอีกครั้งอัตโนมัติภายใน 24-72 ชม. หลังคุณอัปเดตบัตร
      </p>
    `;
    return {
      subject,
      html: wrap(content, {
        ctaText: '🔄 อัปเดตบัตรเครดิต',
        ctaUrl: billingUrl || `${BRAND_URL}/add-payment`,
        preheader: `${BRAND_NAME} ไม่สามารถเรียกเก็บเงินได้ — กรุณาอัปเดตบัตร`
      })
    };
  },

  // 4. Subscription cancelled
  subscriptionCancelled({ schoolName, currentPeriodEnd, billingUrl }) {
    const subject = `✓ ยืนยันการยกเลิก subscription`;
    const content = `
      <h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.text};">✓ ดำเนินการเรียบร้อย</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        สวัสดีครับ <strong>${schoolName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        เราได้ยกเลิก subscription ของคุณตามคำขอแล้ว — คุณยังใช้งานได้ปกติจนถึง:
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.warningBg};border:1px solid #FCD34D;border-radius:8px;margin:20px 0;">
        <tr>
          <td style="padding:18px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:${COLORS.warning};">วันสิ้นสุดการใช้งาน</p>
            <p style="margin:0;font-size:20px;color:${COLORS.warning};font-weight:700;">${formatThaiDate(currentPeriodEnd)}</p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        หลังจากวันนี้:
      </p>
      <ul style="margin:0 0 16px;font-size:14px;line-height:1.8;color:${COLORS.text};padding-left:20px;">
        <li>ไม่ถูกเรียกเก็บเงินเพิ่ม</li>
        <li>Account ของคุณจะถูกระงับชั่วคราว</li>
        <li>ข้อมูลของคุณจะถูกเก็บไว้ 90 วัน</li>
      </ul>

      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.textMuted};">
        💡 <strong>เปลี่ยนใจ?</strong> กดปุ่ม "ใช้งานต่อ" ได้ตลอดเวลาก่อน ${formatThaiDate(currentPeriodEnd)}
      </p>
    `;
    return {
      subject,
      html: wrap(content, {
        ctaText: 'ใช้งานต่อ',
        ctaUrl: billingUrl || `${BRAND_URL}/billing`,
        preheader: `${BRAND_NAME} ยืนยันการยกเลิก subscription`
      })
    };
  },

  // 5. Subscription resumed
  subscriptionResumed({ schoolName, billingUrl }) {
    const subject = `↩️ ยินดีต้อนรับกลับ! Subscription ใช้งานต่อแล้ว`;
    const content = `
      <h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.success};">↩️ ยินดีต้อนรับกลับ!</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        สวัสดีครับ <strong>${schoolName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        คุณได้กลับมาใช้งาน subscription ของ ${BRAND_NAME} ต่อแล้ว 🎉
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        ระบบจะเรียกเก็บเงินตามรอบบิลปกติต่อไป — ไม่มีการเปลี่ยนแปลงในด้านราคาหรือฟีเจอร์
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.textMuted};">
        ขอบคุณที่อยู่กับเราต่อ! 🙏
      </p>
    `;
    return {
      subject,
      html: wrap(content, {
        ctaText: 'ดู Subscription',
        ctaUrl: billingUrl || `${BRAND_URL}/billing`,
        preheader: `Subscription กลับมาใช้งานต่อแล้ว`
      })
    };
  },

  // 6. Plan changed
  planChanged({ schoolName, oldPlanId, oldCycle, newPlanId, newCycle, newAmountBaht, billingUrl }) {
    const subject = `📦 เปลี่ยนแพ็คเกจสำเร็จ — ${planNames[newPlanId]}`;
    const content = `
      <h1 style="margin:0 0 16px;font-size:22px;color:${COLORS.text};">📦 เปลี่ยนแพ็คเกจสำเร็จ</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        สวัสดีครับ <strong>${schoolName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text};">
        การเปลี่ยนแพ็คเกจของคุณเรียบร้อยแล้ว
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:8px;margin:20px 0;">
        <tr>
          <td style="padding:18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="font-size:12px;color:${COLORS.textMuted};">แพ็คเกจเดิม</td>
                <td style="font-size:12px;color:${COLORS.textMuted};text-align:center;">→</td>
                <td style="font-size:12px;color:${COLORS.textMuted};text-align:right;">แพ็คเกจใหม่</td>
              </tr>
              <tr>
                <td style="font-size:16px;color:${COLORS.text};font-weight:600;padding-top:4px;">${planNames[oldPlanId] || oldPlanId} ${cycleNames[oldCycle] || ''}</td>
                <td style="text-align:center;font-size:18px;color:${COLORS.primary};font-weight:700;padding-top:4px;">→</td>
                <td style="font-size:16px;color:${COLORS.primary};font-weight:700;text-align:right;padding-top:4px;">${planNames[newPlanId] || newPlanId} ${cycleNames[newCycle] || ''}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">
        ราคาใหม่: <strong>฿${(newAmountBaht || 0).toLocaleString()}${newCycle === 'yearly' ? '/ปี' : '/เดือน'}</strong>
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${COLORS.textMuted};">
        ราคาใหม่จะเริ่มมีผลในรอบบิลครั้งต่อไป (ไม่มี proration ในรอบนี้)
      </p>
    `;
    return {
      subject,
      html: wrap(content, {
        ctaText: 'ดู Subscription',
        ctaUrl: billingUrl || `${BRAND_URL}/billing`,
        preheader: `เปลี่ยนเป็น ${planNames[newPlanId]} ${cycleNames[newCycle]} สำเร็จ`
      })
    };
  },

  // ----------------------------------------------------------
  // 7. Suspend warning (sent 2 days into past_due, 5 days before suspend)
  // ----------------------------------------------------------
  suspendWarning({ schoolName, daysUntilSuspend, addPaymentUrl, billingUrl }) {
    const subject = `⚠️ บัญชี ${schoolName} จะถูกระงับใน ${daysUntilSuspend} วัน — กรุณาอัปเดตบัตร`;
    const content = `
      <div style="background:${COLORS.dangerBg};border-left:4px solid ${COLORS.danger};padding:16px 20px;border-radius:6px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:${COLORS.danger};">
          ⚠️ การชำระเงินล้มเหลว — บัญชีจะถูกระงับเร็วๆ นี้
        </p>
        <p style="margin:0;font-size:14px;color:${COLORS.danger};line-height:1.6;">
          ระบบเรียกเก็บเงินไม่สำเร็จมาแล้วหลายวัน — อีก <strong>${daysUntilSuspend} วัน</strong> บัญชีของ ${schoolName} จะถูกระงับการเข้าใช้งาน
        </p>
      </div>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">
        เพื่อป้องกันการระงับบัญชี กรุณา <strong>เปลี่ยนหรืออัปเดตบัตรเครดิต</strong> โดยเร็วที่สุด
      </p>

      <div style="background:${COLORS.warningBg};border-left:4px solid ${COLORS.warning};padding:14px 18px;border-radius:6px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${COLORS.warning};">
          📌 จะเกิดอะไรขึ้นถ้าบัญชีถูกระงับ?
        </p>
        <ul style="margin:0;padding-left:20px;color:${COLORS.warning};font-size:13px;line-height:1.7;">
          <li>นักเรียน ครู และผู้ปกครอง <strong>จะไม่สามารถเข้าระบบได้</strong></li>
          <li>ข้อมูลทั้งหมดจะถูกเก็บไว้ — กู้คืนได้เมื่อชำระเงิน</li>
          <li>หลังจาก 90 วันที่ถูกระงับ ระบบอาจลบข้อมูลถาวร</li>
        </ul>
      </div>

      <p style="margin:0 0 8px;font-size:14px;color:${COLORS.text};line-height:1.6;">
        <strong>วิธีแก้ไข:</strong> กดปุ่มด้านล่างเพื่อเปลี่ยนบัตรใหม่
      </p>
    `;
    return {
      subject,
      html: wrap(content, {
        ctaText: '💳 อัปเดตบัตรเครดิต',
        ctaUrl: addPaymentUrl || `${BRAND_URL}/pages/add-payment.html`,
        preheader: `บัญชีจะถูกระงับใน ${daysUntilSuspend} วัน — อัปเดตบัตรเดี๋ยวนี้`
      })
    };
  },

  // ----------------------------------------------------------
  // 8. Account suspended (sent when subscription crossed grace period)
  // ----------------------------------------------------------
  accountSuspended({ schoolName, daysPastDue, addPaymentUrl }) {
    const subject = `🚫 บัญชี ${schoolName} ถูกระงับแล้ว — ชำระเงินเพื่อกู้คืน`;
    const content = `
      <div style="background:${COLORS.dangerBg};border-left:4px solid ${COLORS.danger};padding:20px 24px;border-radius:6px;margin-bottom:24px;">
        <p style="margin:0 0 10px;font-size:18px;font-weight:700;color:${COLORS.danger};">
          🚫 บัญชีของคุณถูกระงับการใช้งาน
        </p>
        <p style="margin:0;font-size:14px;color:${COLORS.danger};line-height:1.6;">
          เนื่องจากระบบเรียกเก็บเงินไม่สำเร็จเป็นเวลา <strong>${daysPastDue} วัน</strong> เกินช่วงผ่อนผัน
        </p>
      </div>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">
        บัญชี <strong>${schoolName}</strong> ถูกระงับชั่วคราว — ผู้ใช้ทั้งหมดของโรงเรียน (นักเรียน ครู ผู้ปกครอง) จะไม่สามารถ login ได้
      </p>

      <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:8px;padding:18px 22px;margin-bottom:24px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:${COLORS.text};">
          ✅ วิธีกู้คืนบัญชี
        </p>
        <ol style="margin:0;padding-left:22px;color:${COLORS.text};font-size:14px;line-height:1.8;">
          <li>กดปุ่มด้านล่าง → ไปหน้าอัปเดตบัตรเครดิต</li>
          <li>กรอกข้อมูลบัตรใหม่ → กดยืนยัน</li>
          <li>ระบบจะเรียกเก็บยอดค้างชำระ + เปิดบัญชีอัตโนมัติ</li>
          <li>ทุกคนกลับมาใช้งานได้ตามปกติ</li>
        </ol>
      </div>

      <p style="margin:0 0 16px;font-size:13px;color:${COLORS.textMuted};line-height:1.6;">
        💡 ข้อมูลทั้งหมดยังถูกเก็บไว้ปลอดภัย — กู้คืนได้ภายใน 90 วัน หลังจากนั้นข้อมูลอาจถูกลบถาวร
      </p>
    `;
    return {
      subject,
      html: wrap(content, {
        ctaText: '💳 ชำระเงิน + กู้คืนบัญชี',
        ctaUrl: addPaymentUrl || `${BRAND_URL}/pages/add-payment.html`,
        preheader: `บัญชีถูกระงับ — กู้คืนได้ภายใน 90 วัน`
      })
    };
  },

  // 7. Waitlist confirm — sent after public waitlist signup (Sprint 9.B)
  waitlistConfirm({ email, schoolName }) {
    const subject = `✅ คุณอยู่ในคิว Early Access ของ ${BRAND_NAME} แล้ว`;
    const content = `
      <h1 style="margin:0 0 16px;font-size:24px;color:${COLORS.text};">ขอบคุณที่สนใจ ${BRAND_NAME}! 🙏</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">
        เรา <strong>บันทึกคุณไว้ในรายชื่อ Early Access</strong> แล้วเรียบร้อย
        ${schoolName ? `<br/>โรงเรียน: <strong>${schoolName}</strong>` : ''}
      </p>

      <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:8px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${COLORS.text};">📋 ขั้นถัดไปเป็นยังไง?</p>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:${COLORS.text};">
          <li>ทีมเราอยู่ในระหว่างพัฒนา features เพิ่มเติม — Student/Teacher/Attendance/LINE</li>
          <li>เมื่อพร้อมเปิดให้ใช้งาน เราจะส่งอีเมลแจ้ง <strong>คุณก่อนใคร</strong></li>
          <li>ลูกค้า Early Access จะได้รับ <strong>ส่วนลดพิเศษ</strong> + onboarding ส่วนตัว</li>
          <li>คาดว่าจะเปิดให้ใช้จริง <strong>Q3 2026</strong></li>
        </ul>
      </div>

      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.textMuted};">
        หากต้องการคุยกับทีมเราโดยตรง หรือมีคำถามอะไรเพิ่มเติม
        ส่งอีเมลกลับมาที่ <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLORS.primary};text-decoration:none;">${SUPPORT_EMAIL}</a> ได้เลย
      </p>

      <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">
        — ทีม ${BRAND_NAME}
      </p>
    `;
    return {
      subject,
      html: wrap(content, {
        ctaText: '🌐 ไปยัง panyaschoolkit.com',
        ctaUrl: BRAND_URL,
        preheader: `เราจะแจ้งคุณก่อนเปิดให้ใช้งานจริง — รับส่วนลดพิเศษ Early Access`
      })
    };
  }
};

module.exports = { sendEmail, emailTemplates };
