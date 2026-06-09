/* ===========================================================================
   js/tabbar.js — app-style bottom tab bar (mobile/tablet only).
   Gives native-app feel: 4 quick tabs + "More" that opens the full sidebar
   drawer. Hidden on desktop (sidebar handles that). Injected by role-guard.
   Role-aware (staff vs student/parent). Non-critical, fails silently.
   =========================================================================== */
(function () {
  'use strict';
  if (window.__pkTabbarLoaded) return;
  window.__pkTabbarLoaded = true;

  function curFile() { var p = location.pathname.split('/'); return (p[p.length - 1] || '').toLowerCase(); }
  var f = curFile();
  // don't show on auth / marketing / developer console pages
  if (location.pathname.indexOf('/admin/') > -1) return;
  if (['', 'index.html', 'login.html', 'add-payment.html', 'school-public.html', 'verify.html'].indexOf(f) > -1) return;

  // Feather-style icons
  var IC = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    check: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    more: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'
  };

  var STAFF = [
    { href: 'dashboard.html',  ic: 'home',  th: 'หน้าหลัก', en: 'Home' },
    { href: 'students.html',   ic: 'users', th: 'นักเรียน', en: 'Students' },
    { href: 'attendance.html', ic: 'check', th: 'เช็คชื่อ', en: 'Check' },
    { href: 'messages.html',   ic: 'chat',  th: 'ข้อความ', en: 'Chat' }
  ];
  var STUDENT = [
    { href: 'student-dashboard.html', ic: 'home',   th: 'หน้าหลัก', en: 'Home' },
    { href: 'my-grades.html',         ic: 'book',   th: 'เกรด',     en: 'Grades' },
    { href: 'my-schedule.html',       ic: 'cal',    th: 'ตาราง',    en: 'Schedule' },
    { href: 'my-bills.html',          ic: 'dollar', th: 'ค่าเทอม',  en: 'Bills' }
  ];

  var CSS = ''
    + '#pk-tabbar{display:none;}'
    + '@media(max-width:900px){'
    + '#pk-tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:903;'
    + 'background:rgba(255,255,255,.97);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);'
    + 'border-top:1px solid #E1E7F5;box-shadow:0 -2px 16px rgba(15,26,54,.07);'
    + 'padding-bottom:env(safe-area-inset-bottom,0px);'
    + "font-family:'IBM Plex Sans Thai','Inter',sans-serif;}"
    + '#pk-tabbar a,#pk-tabbar button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;'
    + 'background:none;border:none;cursor:pointer;color:#9098AB;text-decoration:none;font-family:inherit;font-size:10.5px;font-weight:600;padding:8px 2px 7px;min-width:0;}'
    + '#pk-tabbar .ti{width:23px;height:23px;flex-shrink:0;}'
    + '#pk-tabbar a.on,#pk-tabbar button.on{color:#2563EB;}'
    + '#pk-tabbar a span,#pk-tabbar button span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}'
    + 'body.pk-has-tabbar{padding-bottom:calc(62px + env(safe-area-inset-bottom,0px)) !important;}'
    + 'body.pk-has-tabbar #pk-sb-toggle{display:none !important;}'
    + '#pk-sb{z-index:910 !important;} #pk-sb-backdrop{z-index:909 !important;}'
    + '}';

  function svg(name) {
    return '<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (IC[name] || '') + '</svg>';
  }

  function build(tabs) {
    var lang = (document.documentElement.lang === 'en') ? 'en' : 'th';
    var here = curFile();
    var bar = document.createElement('nav');
    bar.id = 'pk-tabbar';
    var html = '';
    tabs.forEach(function (t) {
      var on = (t.href.toLowerCase() === here) ? ' on' : '';
      html += '<a class="' + 'tabitem' + on + '" href="' + t.href + '">' + svg(t.ic) + '<span>' + (t[lang] || t.th) + '</span></a>';
    });
    html += '<button type="button" class="tabmore" id="pk-tab-more">' + svg('more') + '<span>' + (lang === 'en' ? 'More' : 'เพิ่มเติม') + '</span></button>';
    bar.innerHTML = html;
    document.body.appendChild(bar);
    document.body.classList.add('pk-has-tabbar');

    document.getElementById('pk-tab-more').addEventListener('click', function () {
      var sb = document.getElementById('pk-sb');
      var bd = document.getElementById('pk-sb-backdrop');
      if (sb) sb.classList.add('open');
      if (bd) bd.classList.add('show');
    });
  }

  function start() {
    if (!window.supabaseClient || !window.auth) { return; }
    (async function () {
      try {
        var session = await window.auth.getSession();
        if (!session) return;                       // only for logged-in app users
        var role = 'staff';
        try { var p = await window.auth.getProfile(); if (p && p.role) role = p.role; } catch (e) {}
        var isStudent = (role === 'student' || role === 'parent');
        var st = document.createElement('style'); st.id = 'pk-tabbar-style'; st.textContent = CSS; document.head.appendChild(st);
        build(isStudent ? STUDENT : STAFF);
      } catch (e) { /* non-critical */ }
    })();
  }

  // wait until auth/supabase are ready (role-guard loads them before this)
  function waitReady(tries) {
    if (window.supabaseClient && window.auth) { start(); return; }
    if (tries <= 0) return;
    setTimeout(function () { waitReady(tries - 1); }, 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { waitReady(25); });
  else waitReady(25);
})();
