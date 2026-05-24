/* ===========================================
   Cookie Consent Banner (PDPA-compliant)
   ===========================================
   Usage: just include <script src="/js/cookie-consent.js" defer></script>
   in any page. Banner shows automatically until accepted.
   Stores consent in localStorage so it doesn't show again.
   =========================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'skks_cookie_consent_v1';

  // Don't show if user already responded
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch (e) {
    // localStorage disabled — show banner but won't persist
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }

  function showBanner() {
    // Detect language preference (Thai default)
    var lang = 'th';
    try {
      var saved = localStorage.getItem('skks_lang');
      if (saved === 'en') lang = 'en';
    } catch (e) {}

    var TEXT = {
      th: {
        title: '🍪 ใช้คุกกี้เพื่อประสบการณ์ที่ดีขึ้น',
        body: 'เราใช้คุกกี้ที่จำเป็นสำหรับการ login และ session เท่านั้น (ไม่มี tracking) — ดูรายละเอียดใน',
        link: 'นโยบายความเป็นส่วนตัว',
        accept: 'ยอมรับ',
        learn: 'อ่านรายละเอียด'
      },
      en: {
        title: '🍪 We use cookies',
        body: 'We use only essential cookies for login and session (no tracking) — see details in',
        link: 'Privacy Policy',
        accept: 'Accept',
        learn: 'Learn more'
      }
    };
    var t = TEXT[lang];

    var container = document.createElement('div');
    container.id = 'skks-cookie-banner';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-label', t.title);
    container.innerHTML =
      '<div class="ccb-inner">' +
        '<div class="ccb-content">' +
          '<div class="ccb-title">' + t.title + '</div>' +
          '<div class="ccb-body">' +
            t.body +
            ' <a href="/pages/privacy.html" class="ccb-link">' + t.link + '</a>' +
          '</div>' +
        '</div>' +
        '<div class="ccb-actions">' +
          '<a href="/pages/privacy.html" class="ccb-btn ccb-btn-secondary">' + t.learn + '</a>' +
          '<button type="button" class="ccb-btn ccb-btn-primary" id="ccb-accept">' + t.accept + '</button>' +
        '</div>' +
      '</div>';

    // Inject styles once
    if (!document.getElementById('skks-cookie-styles')) {
      var style = document.createElement('style');
      style.id = 'skks-cookie-styles';
      style.textContent = [
        '#skks-cookie-banner {',
        '  position: fixed; left: 16px; right: 16px; bottom: 16px;',
        '  background: #fff; border: 1px solid #E5E7EB;',
        '  border-radius: 14px; padding: 18px 22px;',
        '  box-shadow: 0 12px 40px rgba(0,0,0,0.15);',
        '  z-index: 9999; max-width: 920px; margin: 0 auto;',
        "  font-family: 'Sarabun', 'Prompt', sans-serif;",
        '  animation: ccbSlideUp 0.35s ease-out;',
        '}',
        '@keyframes ccbSlideUp {',
        '  from { transform: translateY(100%); opacity: 0; }',
        '  to { transform: translateY(0); opacity: 1; }',
        '}',
        '#skks-cookie-banner .ccb-inner {',
        '  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;',
        '}',
        '#skks-cookie-banner .ccb-content { flex: 1; min-width: 240px; }',
        '#skks-cookie-banner .ccb-title {',
        '  font-weight: 700; font-size: 15px; color: #111827; margin-bottom: 4px;',
        '}',
        '#skks-cookie-banner .ccb-body {',
        '  font-size: 13px; line-height: 1.6; color: #4B5563;',
        '}',
        '#skks-cookie-banner .ccb-link {',
        '  color: #2563EB; text-decoration: underline; font-weight: 500;',
        '}',
        '#skks-cookie-banner .ccb-actions {',
        '  display: flex; gap: 10px; align-items: center; flex-shrink: 0;',
        '}',
        '#skks-cookie-banner .ccb-btn {',
        '  padding: 10px 20px; border-radius: 100px;',
        '  font-family: inherit; font-size: 13px; font-weight: 600;',
        '  cursor: pointer; border: none; text-decoration: none;',
        '  transition: all 0.15s; white-space: nowrap;',
        '}',
        '#skks-cookie-banner .ccb-btn-primary {',
        '  background: #2563EB; color: #fff;',
        '}',
        '#skks-cookie-banner .ccb-btn-primary:hover {',
        '  background: #1D4ED8;',
        '}',
        '#skks-cookie-banner .ccb-btn-secondary {',
        '  background: transparent; color: #6B7280; border: 1px solid #D1D5DB;',
        '}',
        '#skks-cookie-banner .ccb-btn-secondary:hover {',
        '  background: #F9FAFB; color: #374151;',
        '}',
        '@media (max-width: 600px) {',
        '  #skks-cookie-banner { padding: 14px 16px; bottom: 8px; left: 8px; right: 8px; }',
        '  #skks-cookie-banner .ccb-actions { width: 100%; }',
        '  #skks-cookie-banner .ccb-btn { flex: 1; text-align: center; }',
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }

    document.body.appendChild(container);

    document.getElementById('ccb-accept').addEventListener('click', function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          accepted: true,
          timestamp: new Date().toISOString(),
          version: 1
        }));
      } catch (e) {}
      container.style.animation = 'ccbSlideUp 0.25s ease-in reverse';
      setTimeout(function () { container.remove(); }, 250);
    });
  }
})();
