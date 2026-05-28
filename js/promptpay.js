// ==========================================================================
// js/promptpay.js — PromptPay EMVCo QR Payload Generator
// Sprint 15: Generate dynamic (amount-encoded) PromptPay QR for tuition bills.
//
// Pure JavaScript, no dependencies. Browser global: window.PromptPay
//
// Usage:
//   const payload = PromptPay.generatePayload('0812345678', 1500.00);
//   // → EMVCo string to render as QR (use any QR lib)
//
// Standard: EMVCo Merchant Presented QR + Thai PromptPay spec.
// - Mobile number  → proxy tag 01, formatted 0066xxxxxxxxx
// - National/Tax ID → proxy tag 02, 13 digits as-is
// - Amount > 0     → dynamic QR (point-of-initiation 12) + tag 54 amount
// ==========================================================================

(function (global) {
  'use strict';

  // TLV builder: id (2) + length (2, zero-padded) + value
  function tlv(id, value) {
    const v = String(value);
    const len = v.length.toString().padStart(2, '0');
    return id + len + v;
  }

  // CRC16-CCITT (XModem): poly 0x1021, init 0xFFFF, no reflect, no final xor.
  // Computed over the full payload INCLUDING the "6304" CRC field prefix.
  function crc16(payload) {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
      crc ^= (payload.charCodeAt(i) & 0xFF) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // Determine proxy type + formatted value from a raw PromptPay ID.
  // Returns { tag, value } where tag '01' = mobile, '02' = national/tax ID.
  function formatTarget(rawId) {
    const digits = String(rawId || '').replace(/\D/g, '');

    // 13 digits → National ID / Tax ID
    if (digits.length === 13) {
      return { tag: '02', value: digits };
    }

    // Otherwise treat as mobile number.
    // Normalize: strip leading 0, prepend country code 66, left-pad to 13 with 0.
    let m = digits;
    if (m.startsWith('66') && m.length === 11) {
      // already 66xxxxxxxxx
    } else {
      if (m.startsWith('0')) m = m.slice(1);
      m = '66' + m;
    }
    m = m.padStart(13, '0');
    return { tag: '01', value: m };
  }

  // Build the full EMVCo payload string.
  // promptpayId: phone ('0812345678') or national/tax ID (13 digits)
  // amount: number (THB). If null/0/undefined → static QR (no amount).
  function generatePayload(promptpayId, amount) {
    if (!promptpayId) return null;
    const target = formatTarget(promptpayId);
    const amt = Number(amount);
    const hasAmount = !Number.isNaN(amt) && amt > 0;

    let payload = '';
    payload += tlv('00', '01');                                   // Payload Format Indicator
    payload += tlv('01', hasAmount ? '12' : '11');                // 12 = dynamic (one-time), 11 = static

    // Merchant Account Information — PromptPay (tag 29)
    const merchant =
      tlv('00', 'A000000677010111') +                            // PromptPay AID
      tlv(target.tag, target.value);                             // proxy (mobile or ID)
    payload += tlv('29', merchant);

    payload += tlv('53', '764');                                  // Currency = THB
    if (hasAmount) payload += tlv('54', amt.toFixed(2));          // Amount
    payload += tlv('58', 'TH');                                   // Country

    // CRC (tag 63, length 04) — append prefix then compute over everything
    payload += '6304';
    payload += crc16(payload);

    return payload;
  }

  // Human-readable label of the proxy type (for UI hints)
  function proxyType(rawId) {
    const digits = String(rawId || '').replace(/\D/g, '');
    return digits.length === 13 ? 'national_id' : 'mobile';
  }

  global.PromptPay = {
    generatePayload: generatePayload,
    proxyType: proxyType,
    _crc16: crc16,          // exposed for testing
    _formatTarget: formatTarget
  };

})(typeof window !== 'undefined' ? window : this);
