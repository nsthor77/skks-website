// ============================================================================
// PanyaSchoolKit — Friendly Errors (shared, auto-injected by role-guard.js)
// ----------------------------------------------------------------------------
// Two stability nets for EVERY app page, with zero per-page edits:
//
// 1) Thai error translation — wraps dataHelpers.toast so raw English DB/network
//    errors ("duplicate key value…", "Failed to fetch", "JWT expired"…) are
//    shown to customers as plain Thai instead of programmer-speak. A Thai
//    prefix the page added (e.g. "บันทึกไม่สำเร็จ: ") is preserved.
//
// 2) Loading watchdog — if a page's "⏳ กำลังโหลด..." indicator is still
//    showing after 20s (or right after an uncaught JS error), it is replaced
//    with a friendly Thai message + a "ลองใหม่" reload button, so customers
//    are never stuck staring at an endless spinner.
//
// Fail-open by design: every step is wrapped in try/catch — if anything in
// here breaks, pages behave exactly as before.
// ============================================================================
(function () {
  if (window.__pkErrLoaded) return;
  window.__pkErrLoaded = true;

  // ---- 1) English → Thai error mapping --------------------------------------
  var RULES = [
    { re: /failed to fetch|networkerror|network error|load failed|err_internet|fetcherror|abort(ed)?error/i,
      th: 'การเชื่อมต่ออินเทอร์เน็ตมีปัญหา — ตรวจสอบสัญญาณแล้วลองใหม่อีกครั้ง' },
    { re: /jwt expired|invalid jwt|jwt malformed|refresh token|not authenticated|no api key/i,
      th: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' },
    { re: /invalid login credentials/i, th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
    { re: /email not confirmed/i, th: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ (เช็คกล่องจดหมาย)' },
    { re: /user already registered|already been registered/i, th: 'อีเมลนี้ถูกใช้งานแล้ว' },
    { re: /password should be at least/i, th: 'รหัสผ่านสั้นเกินไป (ต้องมีอย่างน้อย 8 ตัวอักษร)' },
    { re: /rate limit|too many requests/i, th: 'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' },
    { re: /permission denied|row-level security|violates row level|not authorized|insufficient_privilege/i,
      th: 'คุณไม่มีสิทธิ์ทำรายการนี้ — ติดต่อผู้ดูแลของโรงเรียน' },
    { re: /duplicate key value|already exists|unique constraint/i,
      th: 'มีข้อมูลนี้อยู่แล้วในระบบ (ข้อมูลซ้ำ)' },
    { re: /violates foreign key/i,
      th: 'ข้อมูลนี้ถูกใช้งานอยู่โดยส่วนอื่น จึงลบ/แก้ไขไม่ได้' },
    { re: /violates not[- ]null|null value in column/i, th: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ' },
    { re: /value too long/i, th: 'ข้อความยาวเกินไป กรุณาย่อให้สั้นลง' },
    { re: /invalid input syntax|invalid date|out of range/i, th: 'รูปแบบข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' },
    { re: /statement timeout|canceling statement|57014|timeout/i,
      th: 'รายการนี้ใช้เวลานานเกินไป — ลองใหม่ หรือแบ่งข้อมูลเป็นชุดเล็กลง' },
    { re: /could not find the function|function .* does not exist|pgrst202/i,
      th: 'ระบบส่วนนี้ยังตั้งค่าไม่เสร็จ — กรุณาแจ้งผู้ดูแลระบบ' },
    { re: /relation .* does not exist|could not find the table|pgrst205|column .* does not exist|pgrst204/i,
      th: 'ระบบส่วนนี้ยังตั้งค่าไม่เสร็จ — กรุณาแจ้งผู้ดูแลระบบ' },
    { re: /^\s*(unknown error|internal server error|server error|something went wrong)\s*$/i,
      th: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }
  ];

  function pkFriendly(msg) {
    try {
      var s = String(msg == null ? '' : (msg.message || msg));
      if (!s) return s;
      for (var i = 0; i < RULES.length; i++) {
        if (RULES[i].re.test(s)) {
          // keep any Thai context the page prefixed, e.g. "❌ บันทึกไม่สำเร็จ: "
          var m = s.match(/^[^A-Za-z]*[฀-๿][^:]*:\s*/);
          return (m ? m[0] : '') + RULES[i].th;
        }
      }
      return s;
    } catch (e) { return String(msg); }
  }
  window.pkFriendly = pkFriendly;

  // wrap dataHelpers.toast once it exists (script load order isn't guaranteed)
  var wrapTries = 0;
  function wrapToast() {
    try {
      if (window.dataHelpers && typeof window.dataHelpers.toast === 'function' && !window.dataHelpers.__pkWrapped) {
        var orig = window.dataHelpers.toast.bind(window.dataHelpers);
        window.dataHelpers.toast = function (message, type) {
          try { if (type === 'error' || type === 'warning') message = pkFriendly(message); } catch (e) {}
          return orig(message, type);
        };
        window.dataHelpers.__pkWrapped = true;
        return;
      }
    } catch (e) { return; }
    if (++wrapTries < 40) setTimeout(wrapToast, 250);   // retry ~10s
  }
  wrapToast();
  document.addEventListener('DOMContentLoaded', wrapToast);

  // ---- 2) Loading watchdog ---------------------------------------------------
  var SEL = '#loadingMsg, #loading, .loading-state, .loading';
  function isStuckLoading(el) {
    if (!el || !el.offsetParent) return false;                       // hidden → fine
    return /โหลด|loading/i.test(el.textContent || '');               // still says "loading"
  }
  function rescue() {
    try {
      var els = document.querySelectorAll(SEL);
      for (var i = 0; i < els.length; i++) {
        if (!isStuckLoading(els[i])) continue;
        els[i].innerHTML =
          '<div style="text-align:center;padding:30px 16px;font-family:\'IBM Plex Sans Thai\',\'Prompt\',sans-serif;">' +
          '<div style="font-size:38px;">😕</div>' +
          '<div style="font-size:15px;font-weight:700;color:#0F1A36;margin-top:10px;">หน้านี้โหลดไม่สำเร็จ</div>' +
          '<div style="font-size:13px;color:#5A6788;margin-top:6px;line-height:1.6;">อาจเกิดจากสัญญาณอินเทอร์เน็ตหรือระบบขัดข้องชั่วคราว</div>' +
          '<button onclick="location.reload()" style="margin-top:14px;padding:10px 22px;border:none;border-radius:10px;' +
          'background:#1E40AF;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;">🔄 โหลดใหม่</button>' +
          '</div>';
      }
    } catch (e) { /* never break the page */ }
  }
  // slow-path: still loading after 20s → rescue
  setTimeout(rescue, 20000);
  // fast-path: an uncaught error/rejection usually means init() died → rescue in 3s
  window.addEventListener('error', function () { setTimeout(rescue, 3000); });
  window.addEventListener('unhandledrejection', function () { setTimeout(rescue, 3000); });
})();
