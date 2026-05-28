// ==========================================================================
// js/smart-import.js — Smart Import Wizard (Excel/CSV → column mapping → import)
//
// Goal: let a school admin import hundreds of students/teachers from their
// EXISTING Excel file, with ANY column names (Thai or English), without retyping.
//
// Features:
//  - Accepts .xlsx / .xls / .csv  (SheetJS loaded from CDN on demand)
//  - Auto-detects + manual column mapping (Thai + English header aliases)
//  - Value normalization (ชาย/หญิง → male/female, Buddhist year → Gregorian)
//  - Preview + client validation + per-row server error report
//  - Calls an existing Supabase RPC (e.g. bulk_insert_students)
//
// Usage:
//   SmartImport.open({
//     title: 'นำเข้านักเรียน',
//     rpc: 'bulk_insert_students',
//     fields: [ { key, label, labelTh, aliases:[], required, normalize:'gender'|'date' }, ... ],
//     onDone: (result) => {...}     // optional, called after successful import
//   });
//
// Requires: global supabaseClient (Supabase JS v2)
// Browser global: window.SmartImport
// ==========================================================================

(function (global) {
  'use strict';

  const XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  let xlsxLoading = null;

  function loadXLSX() {
    if (global.XLSX) return Promise.resolve(global.XLSX);
    if (xlsxLoading) return xlsxLoading;
    xlsxLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = XLSX_CDN;
      s.onload = () => resolve(global.XLSX);
      s.onerror = () => reject(new Error('โหลดตัวอ่าน Excel ไม่สำเร็จ (ตรวจอินเทอร์เน็ต)'));
      document.head.appendChild(s);
    });
    return xlsxLoading;
  }

  // ---- language (reads i18n storage; default en) ----
  function lang() { try { return localStorage.getItem('pk_lang') || 'en'; } catch { return 'en'; } }
  function L(en, th) { return lang() === 'th' ? th : en; }

  // ---- normalize a header for fuzzy matching ----
  function normKey(s) {
    return String(s || '').toLowerCase().replace(/[\s_\-./()]/g, '').trim();
  }

  // ---- value normalizers ----
  function normGender(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return null;
    if (/^(m|male|boy|ช|ชาย|ผู้ชาย|นาย|ด\.ช|เด็กชาย)/.test(s)) return 'male';
    if (/^(f|female|girl|ญ|หญิง|ผู้หญิง|นาง|นางสาว|ด\.ญ|เด็กหญิง)/.test(s)) return 'female';
    return s; // pass through unknown (server may accept or skip)
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Convert various date inputs → ISO YYYY-MM-DD. Handles Buddhist year (>2400 → -543).
  function normDate(v) {
    if (v === null || v === undefined || v === '') return null;
    // SheetJS (cellDates:true) gives JS Date
    if (v instanceof Date && !isNaN(v)) {
      let y = v.getFullYear();
      if (y > 2400) y -= 543;
      return `${y}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
    }
    const str = String(v).trim();
    // Already ISO?
    let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      let y = +m[1]; if (y > 2400) y -= 543;
      return `${y}-${pad2(+m[2])}-${pad2(+m[3])}`;
    }
    // d/m/y or d-m-y or d.m.y
    m = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      let d = +m[1], mo = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      if (y > 2400) y -= 543;       // Buddhist → Gregorian
      return `${y}-${pad2(mo)}-${pad2(d)}`;
    }
    return str; // give up — pass through (server will skip if invalid)
  }

  function applyNormalize(kind, value) {
    if (kind === 'gender') return normGender(value);
    if (kind === 'date') return normDate(value);
    const s = (value === null || value === undefined) ? null : String(value).trim();
    return s === '' ? null : s;
  }

  // ============================================================
  // State + DOM
  // ============================================================
  let cfg = null;        // current config
  let rawRows = [];      // array of arrays (incl header row)
  let headers = [];      // source headers (row 0)
  let dataRows = [];     // data rows (objects keyed by source header)
  let mapping = {};      // { systemFieldKey: sourceHeaderIndex | -1 }

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function overlay() { return document.getElementById('si-overlay'); }

  function close() {
    const o = overlay();
    if (o) o.remove();
    cfg = null; rawRows = []; headers = []; dataRows = []; mapping = {};
  }

  function shell(innerHtml) {
    let o = overlay();
    if (!o) {
      o = document.createElement('div');
      o.id = 'si-overlay';
      o.style.cssText = 'position:fixed;inset:0;background:rgba(15,26,54,0.6);backdrop-filter:blur(2px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:"IBM Plex Sans Thai","Inter",sans-serif;';
      document.body.appendChild(o);
    }
    o.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:860px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px -20px rgba(0,0,0,.5);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #E5E7EB;position:sticky;top:0;background:#fff;border-radius:16px 16px 0 0;">
          <h2 style="font-size:18px;font-weight:700;color:#0F1A36;margin:0;">${esc(cfg.title || L('Smart Import', 'นำเข้าข้อมูล'))}</h2>
          <button onclick="SmartImport._close()" style="background:none;border:none;font-size:24px;color:#6B7280;cursor:pointer;line-height:1;">×</button>
        </div>
        <div style="padding:22px;">${innerHtml}</div>
      </div>`;
  }

  const btn = (label, onclick, primary) =>
    `<button onclick="${onclick}" style="padding:10px 18px;border-radius:9px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;border:${primary ? 'none' : '1px solid #A8B2C4'};background:${primary ? '#1E40AF' : '#fff'};color:${primary ? '#fff' : '#1F2A4E'};">${label}</button>`;

  // ============================================================
  // Step 1: Upload
  // ============================================================
  function stepUpload() {
    shell(`
      <div style="text-align:center;padding:10px 0 20px;">
        <div style="font-size:48px;">📊</div>
        <h3 style="font-size:17px;color:#0F1A36;margin:8px 0 4px;">${L('Upload your Excel or CSV file', 'อัปโหลดไฟล์ Excel หรือ CSV')}</h3>
        <p style="font-size:13px;color:#6B7280;margin:0 0 18px;">${L('Use your existing school file — any column names work (Thai or English).', 'ใช้ไฟล์เดิมของโรงเรียนได้เลย — ชื่อคอลัมน์เป็นไทยหรืออังกฤษก็ได้')}</p>
        <label style="display:block;border:2px dashed #1E40AF;border-radius:14px;padding:34px;cursor:pointer;background:#EEF3FF;">
          <input type="file" id="si-file" accept=".xlsx,.xls,.csv" style="display:none;" />
          <div style="font-size:36px;">📁</div>
          <div style="font-weight:700;color:#1E40AF;margin-top:8px;">${L('Click to choose a file', 'คลิกเพื่อเลือกไฟล์')}</div>
          <div style="font-size:12px;color:#7B8497;margin-top:4px;">.xlsx · .xls · .csv</div>
        </label>
        <div style="margin-top:14px;font-size:13px;color:#6B7280;">
          ${L("Don't have a file ready?", 'ยังไม่มีไฟล์?')}
          <a onclick="SmartImport._template()" style="color:#1E40AF;font-weight:600;cursor:pointer;text-decoration:underline;">⬇ ${L('Download Excel template', 'ดาวน์โหลดไฟล์ตัวอย่าง (Excel)')}</a>
        </div>
        <div id="si-fileerr" style="color:#991B1B;font-size:13px;margin-top:12px;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid #E5E7EB;padding-top:16px;">
        <span style="font-size:12px;color:#9CA3AF;">${L('Step 1 of 3 — Upload', 'ขั้นที่ 1/3 — อัปโหลด')}</span>
        ${btn(L('Cancel', 'ยกเลิก'), 'SmartImport._close()', false)}
      </div>
    `);
    document.getElementById('si-file').addEventListener('change', onFile);
  }

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const errEl = document.getElementById('si-fileerr');
    errEl.textContent = L('Reading file…', 'กำลังอ่านไฟล์…');
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
      // drop fully-empty rows
      rawRows = arr.filter(r => r.some(c => String(c).trim() !== ''));
      if (rawRows.length < 2) {
        errEl.textContent = L('File has no data rows.', 'ไฟล์ไม่มีข้อมูล (ต้องมีหัวตาราง + อย่างน้อย 1 แถว)');
        return;
      }
      headers = rawRows[0].map(h => String(h).trim());
      dataRows = rawRows.slice(1);
      autoMap();
      stepMap();
    } catch (err) {
      errEl.textContent = '❌ ' + err.message;
    }
  }

  // ============================================================
  // Step 2: Map columns
  // ============================================================
  function autoMap() {
    mapping = {};
    const normHeaders = headers.map(normKey);
    cfg.fields.forEach(f => {
      const candidates = [f.key, f.label, f.labelTh, ...(f.aliases || [])].map(normKey);
      let found = -1;
      for (let i = 0; i < normHeaders.length; i++) {
        if (candidates.includes(normHeaders[i])) { found = i; break; }
      }
      // partial contains match as fallback
      if (found === -1) {
        for (let i = 0; i < normHeaders.length; i++) {
          if (candidates.some(c => c && (normHeaders[i].includes(c) || c.includes(normHeaders[i])) && normHeaders[i].length > 1)) { found = i; break; }
        }
      }
      mapping[f.key] = found;
    });
  }

  function stepMap() {
    const optionsHtml = (sel) =>
      `<option value="-1">${L('— Not imported —', '— ไม่นำเข้า —')}</option>` +
      headers.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(h)}</option>`).join('');

    const rows = cfg.fields.map(f => {
      const matched = mapping[f.key] >= 0;
      return `
        <tr style="border-bottom:1px solid #F0F2F7;">
          <td style="padding:9px 8px;font-size:13.5px;color:#0F1A36;">
            ${esc(L(f.label, f.labelTh || f.label))}
            ${f.required ? '<span style="color:#991B1B;font-size:11px;font-weight:700;"> *</span>' : ''}
            ${matched ? '<span style="color:#065F46;font-size:11px;"> ✓</span>' : ''}
          </td>
          <td style="padding:9px 8px;">
            <select data-field="${f.key}" onchange="SmartImport._remap(this)" style="width:100%;padding:7px 9px;border:1px solid ${f.required && !matched ? '#F59E0B' : '#D8DEE9'};border-radius:8px;font-family:inherit;font-size:13px;">
              ${optionsHtml(mapping[f.key])}
            </select>
          </td>
        </tr>`;
    }).join('');

    shell(`
      <p style="font-size:13.5px;color:#374151;margin:0 0 14px;">
        ${L('We matched your columns automatically. Check the matches below — fix any if needed.', 'ระบบจับคู่คอลัมน์ให้อัตโนมัติแล้ว ตรวจดูด้านล่าง — แก้ได้ถ้าไม่ตรง')}
        <br/><span style="color:#9CA3AF;font-size:12px;">${L('Detected', 'พบ')} ${dataRows.length} ${L('rows', 'แถว')} · ${headers.length} ${L('columns', 'คอลัมน์')}</span>
      </p>
      <div style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#EBF0FA;">
            <th style="text-align:left;padding:9px 8px;font-size:11px;color:#4B5670;text-transform:uppercase;letter-spacing:.04em;">${L('System field', 'ข้อมูลในระบบ')}</th>
            <th style="text-align:left;padding:9px 8px;font-size:11px;color:#4B5670;text-transform:uppercase;letter-spacing:.04em;">${L('Your column', 'คอลัมน์ของคุณ')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div id="si-maperr" style="color:#991B1B;font-size:13px;margin-top:12px;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid #E5E7EB;padding-top:16px;margin-top:16px;">
        <span style="font-size:12px;color:#9CA3AF;">${L('Step 2 of 3 — Map columns', 'ขั้นที่ 2/3 — จับคู่คอลัมน์')}</span>
        <div style="display:flex;gap:8px;">
          ${btn(L('Back', 'ย้อนกลับ'), 'SmartImport._back()', false)}
          ${btn(L('Preview →', 'ดูตัวอย่าง →'), 'SmartImport._preview()', true)}
        </div>
      </div>
    `);
  }

  function remap(selectEl) {
    mapping[selectEl.dataset.field] = parseInt(selectEl.value);
  }

  // Build normalized row objects from mapping
  function buildRows() {
    return dataRows.map(srcRow => {
      const obj = {};
      cfg.fields.forEach(f => {
        const idx = mapping[f.key];
        const raw = idx >= 0 ? srcRow[idx] : null;
        obj[f.key] = applyNormalize(f.normalize, raw);
      });
      return obj;
    });
  }

  function validateRows(rows) {
    const required = cfg.fields.filter(f => f.required).map(f => f.key);
    const errors = [];
    rows.forEach((r, i) => {
      const missing = required.filter(k => !r[k]);
      if (missing.length) errors.push({ row: i + 1, missing });
    });
    return errors;
  }

  // ============================================================
  // Step 3: Preview + import
  // ============================================================
  function preview() {
    // ensure required fields mapped
    const reqUnmapped = cfg.fields.filter(f => f.required && mapping[f.key] < 0);
    if (reqUnmapped.length) {
      document.getElementById('si-maperr').textContent =
        L('Please map required fields: ', 'กรุณาจับคู่ฟิลด์ที่จำเป็น: ') +
        reqUnmapped.map(f => L(f.label, f.labelTh || f.label)).join(', ');
      return;
    }

    const rows = buildRows();
    const valErrors = validateRows(rows);
    const usedFields = cfg.fields.filter(f => mapping[f.key] >= 0);
    const sample = rows.slice(0, 8);

    const head = usedFields.map(f => `<th style="text-align:left;padding:7px 8px;font-size:11px;color:#4B5670;white-space:nowrap;">${esc(L(f.label, f.labelTh || f.label))}</th>`).join('');
    const body = sample.map((r, i) => {
      const bad = valErrors.find(e => e.row === i + 1);
      return `<tr style="border-bottom:1px solid #F0F2F7;${bad ? 'background:#FEF2F2;' : ''}">` +
        usedFields.map(f => `<td style="padding:7px 8px;font-size:12.5px;color:${r[f.key] ? '#0F1A36' : '#C4C4C4'};white-space:nowrap;">${esc(r[f.key] || '—')}</td>`).join('') +
        `</tr>`;
    }).join('');

    const valWarn = valErrors.length
      ? `<div style="background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;border-radius:8px;padding:10px 12px;font-size:13px;margin-bottom:12px;">⚠️ ${valErrors.length} ${L('rows are missing required fields and will be skipped.', 'แถวขาดข้อมูลจำเป็น จะถูกข้าม')}</div>`
      : '';

    shell(`
      ${valWarn}
      <p style="font-size:13.5px;color:#374151;margin:0 0 12px;">
        ${L('Preview (first 8 rows). Values were auto-cleaned (gender, dates).', 'ตัวอย่าง (8 แถวแรก) — ระบบแปลงค่าให้แล้ว (เพศ, วันที่)')}
        <strong>${rows.length - valErrors.length}</strong> ${L('rows ready to import.', 'แถวพร้อมนำเข้า')}
      </p>
      <div style="border:1px solid #E5E7EB;border-radius:10px;overflow:auto;max-height:340px;">
        <table style="border-collapse:collapse;min-width:100%;">
          <thead><tr style="background:#EBF0FA;position:sticky;top:0;">${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div id="si-importmsg" style="font-size:13px;margin-top:12px;color:#4B5670;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid #E5E7EB;padding-top:16px;margin-top:16px;">
        <span style="font-size:12px;color:#9CA3AF;">${L('Step 3 of 3 — Preview & import', 'ขั้นที่ 3/3 — ตรวจสอบและนำเข้า')}</span>
        <div style="display:flex;gap:8px;">
          ${btn(L('Back', 'ย้อนกลับ'), 'SmartImport._backMap()', false)}
          ${btn('✅ ' + L('Import ', 'นำเข้า ') + (rows.length - valErrors.length) + L(' rows', ' แถว'), 'SmartImport._import()', true)}
        </div>
      </div>
    `);
  }

  // Import in BATCHES so large files never hit the DB statement timeout.
  // A batch that fails is reported but does NOT stop the rest (partial success).
  const BATCH_SIZE = 150;

  async function doImport() {
    const rows = buildRows();
    const valErrors = validateRows(rows);
    const badRowSet = new Set(valErrors.map(e => e.row));
    const clean = rows.filter((r, i) => !badRowSet.has(i + 1));

    if (!clean.length) {
      document.getElementById('si-importmsg').innerHTML = '<span style="color:#991B1B;">' + L('No valid rows to import.', 'ไม่มีแถวที่พร้อมนำเข้า') + '</span>';
      return;
    }

    const msg = document.getElementById('si-importmsg');
    let inserted = 0, skipped = 0;
    const serverErrors = [];
    const total = clean.length;

    for (let start = 0; start < total; start += BATCH_SIZE) {
      const chunk = clean.slice(start, start + BATCH_SIZE);
      const done = Math.min(start + chunk.length, total);
      msg.innerHTML = '⏳ ' + L('Importing ', 'กำลังนำเข้า ') + done + '/' + total + '… (' + Math.round(done / total * 100) + '%)';
      try {
        const { data, error } = await global.supabaseClient.rpc(cfg.rpc, { p_rows: chunk });
        if (error) throw new Error(error.message);
        if (data && data.error) throw new Error(data.error);
        inserted += (data && (data.inserted ?? data.saved ?? data.count)) || 0;
        skipped += (data && data.skipped) || 0;
        // re-base per-chunk row numbers to global row numbers (over clean rows)
        ((data && data.errors) || []).forEach(e => serverErrors.push({
          row: start + (e.row || 0), error: e.error, student_number: e.student_number
        }));
      } catch (err) {
        // whole batch failed (timeout/network) → count rows as skipped, keep going
        skipped += chunk.length;
        serverErrors.push({ row: start + 1, error: L('Batch failed — try a smaller file or retry: ', 'ชุดข้อมูลนี้ล้มเหลว — ลองไฟล์เล็กลงหรือลองใหม่: ') + err.message });
      }
    }

    stepResult(inserted, skipped + valErrors.length, serverErrors, valErrors);
  }

  // ============================================================
  // Result
  // ============================================================
  function stepResult(inserted, skipped, serverErrors, valErrors) {
    const errItems = [];
    valErrors.forEach(e => errItems.push(`${L('Row', 'แถว')} ${e.row}: ${L('missing', 'ขาด')} ${e.missing.join(', ')}`));
    (serverErrors || []).forEach(e => errItems.push(`${L('Row', 'แถว')} ${e.row || '?'}: ${esc(e.error || '')}${e.student_number ? ' (' + esc(e.student_number) + ')' : ''}`));

    const errBlock = errItems.length
      ? `<div style="margin-top:14px;text-align:left;">
           <div style="font-size:13px;font-weight:600;color:#92400E;margin-bottom:6px;">${L('Skipped rows', 'แถวที่ข้าม')} (${errItems.length}):</div>
           <div style="max-height:180px;overflow:auto;background:#FEF3C7;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#92400E;line-height:1.7;">
             ${errItems.slice(0, 50).map(e => esc(e)).join('<br/>')}
             ${errItems.length > 50 ? `<br/>… +${errItems.length - 50} ${L('more', 'เพิ่มเติม')}` : ''}
           </div>
         </div>`
      : '';

    shell(`
      <div style="text-align:center;padding:8px 0;">
        <div style="font-size:52px;">${inserted > 0 ? '🎉' : '⚠️'}</div>
        <h3 style="font-size:19px;color:#065F46;margin:8px 0 4px;">${L('Imported', 'นำเข้าแล้ว')} ${inserted} ${L('records', 'รายการ')}</h3>
        ${skipped > 0 ? `<p style="font-size:13.5px;color:#92400E;margin:0;">${L('Skipped', 'ข้าม')} ${skipped} ${L('rows (see below)', 'แถว (ดูด้านล่าง)')}</p>` : `<p style="font-size:13.5px;color:#6B7280;margin:0;">${L('All rows imported successfully!', 'นำเข้าครบทุกแถว!')}</p>`}
        ${errBlock}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #E5E7EB;padding-top:16px;margin-top:16px;">
        ${btn(L('Done', 'เสร็จสิ้น'), 'SmartImport._finish()', true)}
      </div>
    `);
  }

  // ============================================================
  // Template download — builds an .xlsx matching cfg.fields
  // ============================================================
  function sampleFor(f) {
    if (f.normalize === 'gender') return L('male', 'ชาย');
    if (f.normalize === 'date') return '2555-05-20';
    const k = (f.key || '').toLowerCase();
    if (k.includes('email')) return 'name@email.com';
    if (k.includes('phone')) return '0812345678';
    if (k.includes('student_number') || k.includes('employee')) return '10001';
    if (k.includes('first_name_th')) return 'สมชาย';
    if (k.includes('last_name_th')) return 'ใจดี';
    if (k.includes('first_name_en')) return 'Somchai';
    if (k.includes('last_name_en')) return 'Jaidee';
    if (k.includes('nickname')) return 'ชาย';
    if (k.includes('classroom') || k.includes('homeroom')) return 'ป.6/1';
    if (k.includes('grade')) return 'ป.6';
    if (k.includes('academic_year')) return '2569';
    return '';
  }

  async function downloadTemplate() {
    const errEl = document.getElementById('si-fileerr');
    try {
      const XLSX = await loadXLSX();
      const labels = cfg.fields.map(f => L(f.label, f.labelTh || f.label) + (f.required ? ' *' : ''));
      const sample = cfg.fields.map(f => sampleFor(f));
      const ws = XLSX.utils.aoa_to_sheet([labels, sample]);
      ws['!cols'] = labels.map(l => ({ wch: Math.max(12, String(l).length + 2) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      const base = (cfg.templateName || (cfg.rpc || 'import').replace('bulk_insert_', '') || 'import');
      XLSX.writeFile(wb, base + '-template.xlsx');
      if (errEl) { errEl.style.color = '#065F46'; errEl.textContent = L('Template downloaded — fill it in, then upload here.', 'ดาวน์โหลดแล้ว — กรอกข้อมูลแล้วอัปโหลดกลับมาที่นี่'); }
    } catch (err) {
      if (errEl) { errEl.style.color = '#991B1B'; errEl.textContent = '❌ ' + err.message; }
    }
  }

  // ============================================================
  // Public API
  // ============================================================
  async function open(config) {
    cfg = config;
    if (!global.supabaseClient) { alert('supabaseClient not found'); return; }
    stepUpload();
  }

  global.SmartImport = {
    open,
    _close: close,
    _back: stepUpload,
    _backMap: stepMap,
    _remap: remap,
    _preview: preview,
    _import: doImport,
    _template: downloadTemplate,
    _finish: function () { const done = cfg && cfg.onDone; close(); if (done) done(); }
  };

})(typeof window !== 'undefined' ? window : this);
