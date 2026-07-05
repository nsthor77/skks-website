/* ============================================================================
   PanyaSchoolKit — Shared Sidebar Navigation (Sprint: nav refresh)
   ----------------------------------------------------------------------------
   Replaces the cramped horizontal top-nav with a clean left sidebar.
   - Self-contained: injects its own CSS + markup, hides the old .admin-nav
   - Role-aware: staff/owner menu vs student/parent menu; owner-only items
   - Active-link highlight by current filename
   - Bilingual TH/EN (reads document.documentElement.lang, re-renders on langchange)
   - Responsive: off-canvas drawer + hamburger on mobile

   Loaded once. Guarded against double-load. Skips /admin/, login, add-payment.
   ============================================================================ */
(function () {
  if (window.__pkSidebarLoaded) return;
  window.__pkSidebarLoaded = true;

  var path = (location.pathname || '').toLowerCase();
  if (path.indexOf('/admin/') > -1) return;                 // platform admin has its own context
  if (/(login|add-payment)\.html$/.test(path)) return;       // auth / payment flows: no app nav

  // ---- Menu definitions -----------------------------------------------------
  // tier = minimum role needed to SEE the item: 'teacher' < 'admin' < 'owner'
  //   teacher  → teaching tools (also visible to admin + owner)
  //   admin    → site management (also visible to owner) — NOT teachers
  //   owner    → finance / money (owner only) — NOT admin, NOT teachers
  var STAFF_MENU = [
    { label: { en: 'Main', th: 'หลัก' }, items: [
      { href: 'dashboard.html',   tier: 'teacher', en: 'Dashboard',   th: 'แดชบอร์ด' },
      { href: 'onboarding.html',  tier: 'admin',   en: 'Setup Guide', th: 'คู่มือตั้งค่า' },
      { href: 'help.html',        tier: 'teacher', en: 'Manual',      th: 'คู่มือใช้งาน' },
      { href: 'calendar.html',    tier: 'teacher', en: 'Calendar',    th: 'ปฏิทิน' }
    ]},
    { label: { en: 'People', th: 'บุคลากร' }, items: [
      { href: 'students.html',    tier: 'teacher', en: 'Students',     th: 'นักเรียน' },
      { href: 'care-hub.html',    tier: 'teacher', en: 'Care System',  th: 'ดูแลช่วยเหลือ' },
      { href: 'health.html',      tier: 'teacher', en: 'Health',       th: 'ห้องพยาบาล' },
      { href: 'sdq.html',         tier: 'teacher', en: 'SDQ',          th: 'ประเมิน SDQ' },
      { href: 'poverty.html',     tier: 'teacher', en: 'Poverty Screen', th: 'คัดกรองยากจน' },
      { href: 'home-visit.html',  tier: 'teacher', en: 'Home Visit',   th: 'เยี่ยมบ้าน' },
      { href: 'teachers.html',    tier: 'admin',   en: 'Teachers',     th: 'ครู' },
      { href: 'applications.html',tier: 'admin',   en: 'Applications', th: 'ใบสมัคร' },
      { href: 'id-cards.html',    tier: 'admin',   en: 'ID Cards',     th: 'บัตรนักเรียน' },
      { href: 'promotion.html',   tier: 'owner',   en: 'Promotion',    th: 'เลื่อนชั้น/ปีการศึกษา' }
    ]},
    { label: { en: 'Academic', th: 'วิชาการ' }, items: [
      { href: 'attendance.html',      tier: 'teacher', en: 'Attendance', th: 'เช็คชื่อ' },
      { href: 'leave-requests.html',  tier: 'teacher', en: 'Leave',      th: 'การลา' },
      { href: 'homework.html',        tier: 'teacher', en: 'Homework',   th: 'การบ้าน' },
      { href: 'behavior.html',        tier: 'teacher', en: 'Behavior',   th: 'พฤติกรรม' },
      { href: 'materials.html',       tier: 'teacher', en: 'Materials',  th: 'สื่อการสอน' },
      { href: 'quiz.html',            tier: 'teacher', en: 'Quizzes',    th: 'ข้อสอบ' },
      { href: 'gradebook.html',       tier: 'teacher', en: 'Gradebook',  th: 'สมุดคะแนน' },
      { href: 'grades-admin.html',    tier: 'teacher', en: 'Grades',     th: 'เกรด' },
      { href: 'popor-docs.html',      tier: 'teacher', en: 'ปพ. Docs',   th: 'เอกสาร ปพ.' },
      { href: 'exam-schedule.html',   tier: 'teacher', en: 'Exams',      th: 'ตารางสอบ' },
      { href: 'schedule-admin.html',  tier: 'admin',   en: 'Schedule',   th: 'ตารางเรียน' },
      { href: 'teacher-schedule.html',tier: 'teacher', en: 'My Schedule',th: 'ตารางสอนของฉัน' },
      { href: 'library.html',         tier: 'teacher', en: 'Library',    th: 'ห้องสมุด' },
      { href: 'reports.html',         tier: 'admin',   en: 'Reports',    th: 'รายงาน' }
    ]},
    { label: { en: 'Finance', th: 'การเงิน' }, items: [
      { href: 'payments.html',          tier: 'owner', en: 'Payments',  th: 'การชำระเงิน' },
      { href: 'payment-approvals.html', tier: 'owner', en: 'Approvals', th: 'อนุมัติสลิป' },
      { href: 'create-bills.html',      tier: 'owner', en: 'Bills',     th: 'ออกบิล' },
      { href: 'tuition-admin.html',     tier: 'owner', en: 'Tuition',   th: 'ค่าเทอม' },
      { href: 'finance.html',           tier: 'owner', en: 'Finance',   th: 'การเงินรวม' },
      { href: 'budget.html',            tier: 'owner', en: 'Budget',    th: 'งบประมาณ' },
      { href: 'scholarships.html',      tier: 'owner', en: 'Scholarships', th: 'ทุนการศึกษา' },
      { href: 'receipt.html',           tier: 'owner', en: 'Receipts',  th: 'ใบเสร็จ' }
    ]},
    { label: { en: 'Operations', th: 'ปฏิบัติการ' }, items: [
      { href: 'gate-scan.html',    tier: 'teacher', en: 'Gate Scan',   th: 'เช็คชื่อประตู' },
      { href: 'cafeteria.html',    tier: 'teacher', en: 'Cafeteria',   th: 'โรงอาหาร' },
      { href: 'visitor-log.html',  tier: 'teacher', en: 'Visitors',    th: 'ผู้มาติดต่อ' },
      { href: 'bus.html',          tier: 'admin',   en: 'Bus Routes',  th: 'รถรับส่ง' },
      { href: 'assets.html',       tier: 'admin',   en: 'Assets',      th: 'พัสดุ/ครุภัณฑ์' }
    ]},
    { label: { en: 'Communicate', th: 'ข่าวสาร' }, items: [
      { href: 'announcements.html',tier: 'admin', en: 'Announcements', th: 'ประกาศ' },
      { href: 'consent-admin.html',tier: 'teacher', en: 'Consent Forms', th: 'หนังสือขออนุญาต' },
      { href: 'surveys-admin.html',tier: 'teacher', en: 'Surveys', th: 'แบบสอบถาม' },
      { href: 'messages.html',     tier: 'teacher', en: 'Messages', th: 'ข้อความ' },
      { href: 'events-admin.html', tier: 'admin', en: 'Events', th: 'กิจกรรม' },
      { href: 'news-admin.html',   tier: 'admin', en: 'News',   th: 'ข่าว' }
    ]},
    { label: { en: 'Settings', th: 'ตั้งค่า' }, items: [
      { href: 'payment-settings.html', tier: 'owner', en: 'Payment Settings', th: 'ตั้งค่าชำระเงิน' },
      // custom-tables.html hidden: generic table builder needs custom_tables/custom_table_rows SQL (not deployed) — errors on load. Use student/teacher Custom Fields instead.
      { href: 'users.html',            tier: 'admin', en: 'Users',            th: 'ผู้ใช้' },
      { href: 'manage-invites.html',   tier: 'admin', en: 'Invites',          th: 'คำเชิญ' },
      { href: 'website-manager.html',  tier: 'admin', en: 'Website',          th: 'จัดการเว็บไซต์' },
      { href: 'school-settings.html',  tier: 'admin', en: 'School',           th: 'โรงเรียน' },
      { href: 'brand-setup.html',      tier: 'admin', en: 'Branding',         th: 'แบรนด์/โลโก้' },
      { href: 'data-export.html',      tier: 'owner', en: 'Export Data',      th: 'ส่งออกข้อมูล' }
    ]}
  ];

  var STUDENT_MENU = [
    { label: { en: 'Learning', th: 'การเรียน' }, items: [
      { href: 'student-dashboard.html', en: 'Home',       th: 'หน้าหลัก' },
      { href: 'calendar.html',          en: 'Calendar',   th: 'ปฏิทิน' },
      { href: 'my-schedule.html',       en: 'Schedule',   th: 'ตารางเรียน' },
      { href: 'my-grades.html',         en: 'My Grades',  th: 'เกรด' },
      { href: 'homework.html',          en: 'Homework',   th: 'การบ้าน' },
      { href: 'behavior.html',          en: 'Behavior',   th: 'พฤติกรรม' },
      { href: 'materials.html',         en: 'Materials',  th: 'สื่อการสอน' },
      { href: 'quiz.html',              en: 'Quizzes',    th: 'ข้อสอบ' },
      { href: 'exam-schedule.html',     en: 'Exam Schedule', th: 'ตารางสอบ' },
      { href: 'my-attendance.html',     en: 'Attendance', th: 'เช็คชื่อ' }
    ]},
    { label: { en: 'General', th: 'ทั่วไป' }, items: [
      { href: 'my-consent.html',      en: 'Consent Forms', th: 'หนังสือขออนุญาต' },
      { href: 'my-surveys.html',      en: 'Surveys',       th: 'แบบสอบถาม' },
      { href: 'my-scholarships.html', en: 'Scholarships',  th: 'ทุนการศึกษา' },
      { href: 'my-wallet.html',       en: 'Wallet',        th: 'กระเป๋าเงิน' },
      { href: 'my-bus.html',          en: 'Bus',           th: 'รถรับส่ง' },
      { href: 'leave-requests.html',  en: 'Leave',        th: 'ขอลา' },
      { href: 'library.html',         en: 'Library',      th: 'ห้องสมุด' },
      { href: 'health.html',          en: 'Health',       th: 'สุขภาพ' },
      { href: 'id-cards.html',        en: 'ID Card',      th: 'บัตรนักเรียน' },
      { href: 'messages.html',        en: 'Messages',     th: 'ข้อความ' },
      { href: 'my-bills.html',        en: 'My Bills',     th: 'ค่าเทอม' },
      { href: 'my-certificates.html', en: 'Certificates', th: 'เกียรติบัตร' },
      { href: 'help.html',            en: 'User Guide',   th: 'คู่มือใช้งาน' },
      { href: 'profile.html',         en: 'Profile',      th: 'โปรไฟล์' }
    ]}
  ];

  // ---- Styles ---------------------------------------------------------------
  var CSS = ''
    + '#pk-sb{position:fixed;top:0;left:0;width:248px;height:100vh;background:#fff;border-right:1px solid #E1E7F5;'
    + 'overflow-y:auto;z-index:900;display:flex;flex-direction:column;'
    + "font-family:'IBM Plex Sans Thai','Inter',sans-serif;-webkit-font-smoothing:antialiased;}"
    + '#pk-sb::-webkit-scrollbar{width:8px;}#pk-sb::-webkit-scrollbar-thumb{background:#D8DEE9;border-radius:8px;}'
    + '#pk-sb .pk-sb-brand{display:flex;align-items:center;gap:10px;padding:16px 18px 14px;border-bottom:1px solid #EEF0F5;position:sticky;top:0;background:#fff;z-index:1;}'
    + '#pk-sb .pk-sb-brand img{height:26px;width:auto;}'
    + '#pk-sb .pk-sb-search{position:relative;padding:10px 12px 4px;position:sticky;top:58px;background:#fff;z-index:1;border-bottom:1px solid #EEF0F5;}'
    + '#pk-sb .pk-sb-search input{width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #E1E7F5;border-radius:9px;'
    + "font-family:inherit;font-size:13px;background:#F7F9FC;color:#15213F;}"
    + '#pk-sb .pk-sb-search input:focus{outline:none;border-color:#93B4F5;background:#fff;}'
    + '#pk-sb .pk-sb-search-results{position:absolute;left:12px;right:12px;top:calc(100% + 2px);background:#fff;'
    + 'border:1px solid #E1E7F5;border-radius:10px;box-shadow:0 12px 30px -8px rgba(15,26,54,.25);max-height:340px;overflow-y:auto;display:none;z-index:950;}'
    + '#pk-sb .pk-sb-search-results.show{display:block;}'
    + '#pk-sb .pk-sr-item{display:block;padding:9px 12px;text-decoration:none;border-bottom:1px solid #F3F6FC;}'
    + '#pk-sb .pk-sr-item:last-child{border-bottom:none;}'
    + '#pk-sb .pk-sr-item:hover{background:#F3F6FC;}'
    + '#pk-sb .pk-sr-title{font-size:13.5px;font-weight:600;color:#15213F;}'
    + '#pk-sb .pk-sr-sub{font-size:11.5px;color:#8A93A6;margin-top:1px;}'
    + '#pk-sb .pk-sr-badge{display:inline-block;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:5px;margin-left:6px;vertical-align:middle;}'
    + '#pk-sb .pk-sr-badge.student{background:#DBE5FF;color:#1E40AF;}'
    + '#pk-sb .pk-sr-badge.teacher{background:#D1FAE5;color:#065F46;}'
    + '#pk-sb .pk-sr-empty{padding:14px 12px;font-size:12.5px;color:#9AA3B5;text-align:center;}'
    + '#pk-sb .pk-sb-nav{padding:10px 12px 28px;flex:1;}'
    + '#pk-sb .pk-sb-group{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;'
    + "font-family:inherit;text-align:left;padding:11px 12px;margin-top:4px;border-radius:9px;color:#15213F;font-size:14.5px;font-weight:700;}"
    + '#pk-sb .pk-sb-group:hover{background:#F3F6FC;}'
    + '#pk-sb .pk-sb-group.open{color:#1E40AF;}'
    + '#pk-sb .pk-sb-group .chev{color:#A6AFC2;font-size:17px;line-height:1;transition:transform .2s ease;}'
    + '#pk-sb .pk-sb-group.open .chev{transform:rotate(90deg);color:#2563EB;}'
    + '#pk-sb .pk-sb-gl{display:flex;align-items:center;gap:10px;min-width:0;}'
    + '#pk-sb .pk-sb-ic{width:17px;height:17px;color:#8A93A6;flex-shrink:0;}'
    + '#pk-sb .pk-sb-group:hover .pk-sb-ic{color:#1E40AF;}'
    + '#pk-sb .pk-sb-group.open .pk-sb-ic{color:#2563EB;}'
    + '#pk-sb .pk-sb-sub{overflow:hidden;max-height:0;transition:max-height .22s ease;padding-left:6px;}'
    + '#pk-sb .pk-sb-sub.open{max-height:680px;}'
    + '#pk-sb a.pk-sb-link{position:relative;display:block;padding:8px 12px 8px 22px;margin:1px 0;border-radius:8px;'
    + 'color:#46506B;text-decoration:none;font-size:13.5px;font-weight:500;line-height:1.3;transition:background .14s,color .14s;}'
    + '#pk-sb a.pk-sb-link:hover{background:#F3F6FC;color:#1E40AF;}'
    + '#pk-sb a.pk-sb-link.active{background:#EAF0FE;color:#1E40AF;font-weight:600;}'
    + '#pk-sb a.pk-sb-link.active::before{content:"";position:absolute;left:8px;top:50%;transform:translateY(-50%);width:3px;height:16px;border-radius:3px;background:#2563EB;}'
    + 'body.pk-has-sb{padding-left:248px;}'
    + 'body.pk-has-sb .admin-nav{display:none !important;}'
    + 'body.pk-has-sb .admin-logo{display:none !important;}'
    + 'body.pk-has-sb .topbar .topbar-left>a:first-child{display:none !important;}'
    + '#pk-sb a.pk-sb-link.pk-locked{color:#9AA3B5;}'
    + '#pk-sb a.pk-sb-link.pk-locked:hover{background:#FAFBFD;color:#9AA3B5;}'
    + '#pk-sb .pk-lock{display:inline-block;margin-left:6px;font-size:9.5px;font-weight:700;color:#92400E;background:#FEF3C7;border-radius:6px;padding:1px 6px;vertical-align:middle;}'
    + '#pk-upgrade{position:fixed;inset:0;z-index:2000;background:rgba(15,26,54,.55);display:flex;align-items:center;justify-content:center;padding:18px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}'
    + "#pk-upgrade .pk-up-box{background:#fff;border-radius:18px;max-width:420px;width:100%;padding:30px 26px 24px;text-align:center;position:relative;font-family:'IBM Plex Sans Thai','Inter',sans-serif;box-shadow:0 24px 60px rgba(15,26,54,.3);}"
    + '#pk-upgrade .pk-up-x{position:absolute;top:12px;right:14px;background:none;border:none;font-size:26px;color:#9AA3B5;cursor:pointer;line-height:1;}'
    + '#pk-upgrade .pk-up-ic{font-size:40px;}'
    + '#pk-upgrade h3{font-size:19px;font-weight:800;color:#0F1A36;margin:10px 0 8px;}'
    + '#pk-upgrade p{font-size:14px;color:#5A6788;line-height:1.6;margin-bottom:20px;}'
    + '#pk-upgrade .pk-up-foot{display:flex;gap:10px;flex-direction:column;}'
    + '#pk-upgrade .pk-up-btn{background:#1E40AF;color:#fff;text-decoration:none;padding:12px;border-radius:10px;font-weight:700;font-size:14.5px;}'
    + '#pk-upgrade .pk-up-cancel{background:#fff;border:1px solid #D8DEE9;color:#46506B;padding:11px;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;}'
    + '#pk-sb-toggle{display:none;}'
    + '#pk-sb-backdrop{display:none;position:fixed;inset:0;background:rgba(15,26,54,.45);z-index:899;}'
    + '@media(max-width:900px){'
    + '  body.pk-has-sb{padding-left:0;}'
    + '  #pk-sb{transform:translateX(-100%);transition:transform .25s ease;box-shadow:0 0 50px rgba(15,26,54,.25);}'
    + '  #pk-sb.open{transform:none;}'
    + '  #pk-sb-backdrop.show{display:block;}'
    + '  #pk-sb-toggle{display:flex;align-items:center;justify-content:center;position:fixed;top:11px;left:11px;z-index:902;'
    + '    width:40px;height:40px;border-radius:10px;background:#1E40AF;color:#fff;border:none;cursor:pointer;font-size:18px;'
    + '    box-shadow:0 4px 14px rgba(30,64,175,.35);}'
    + '  body.pk-has-sb .admin-topbar,body.pk-has-sb .topbar{padding-left:60px;}'
    + '}';

  // ---- Helpers --------------------------------------------------------------
  function langOf() { return (document.documentElement.lang === 'en') ? 'en' : 'th'; }
  function curFile() { var p = location.pathname.split('/'); return (p[p.length - 1] || 'dashboard.html').toLowerCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var TIER_RANK = { teacher: 1, admin: 2, owner: 3 };

  // ---- Plan-based feature gating -------------------------------------------
  var PLAN_RANK = { starter: 1, pro: 2, premium: 3 };
  var PLAN_LABEL = { starter: 'Starter', pro: 'Pro', premium: 'Premium' };
  var PLAN_PRICE = { pro: '฿3,990', premium: '฿6,990' };
  // minimum package per page (filename). Not listed = available to all (Starter).
  var PLAN_MIN = {
    // Pro (฿3,990)
    'create-bills.html': 'pro', 'parent-bills.html': 'pro', 'payment-approvals.html': 'pro', 'tuition-admin.html': 'pro',
    'payments.html': 'pro', 'finance.html': 'pro', 'receipt.html': 'pro', 'payment-settings.html': 'pro', 'my-bills.html': 'pro',
    'homework.html': 'pro', 'quiz.html': 'pro', 'materials.html': 'pro', 'library.html': 'pro',
    'schedule-admin.html': 'pro', 'my-schedule.html': 'pro', 'teacher-schedule.html': 'pro', 'exam-schedule.html': 'pro',
    'behavior.html': 'pro', 'care-hub.html': 'pro', 'sdq.html': 'pro', 'home-visit.html': 'pro', 'popor-docs.html': 'pro',
    'consent-admin.html': 'pro', 'my-consent.html': 'pro', 'surveys-admin.html': 'pro', 'my-surveys.html': 'pro', 'messages.html': 'pro',
    'website-manager.html': 'pro', 'brand-setup.html': 'pro',
    // Premium (฿6,990)
    'scholarships.html': 'premium', 'my-scholarships.html': 'premium', 'budget.html': 'premium', 'poverty.html': 'premium',
    'cafeteria.html': 'premium', 'my-wallet.html': 'premium', 'bus.html': 'premium', 'my-bus.html': 'premium',
    'assets.html': 'premium', 'visitor-log.html': 'premium', 'gate-scan.html': 'premium',
    'ai-grading.html': 'premium', 'ai-comments.html': 'premium', 'analytics.html': 'premium', 'predictions.html': 'premium',
    'data-export.html': 'premium'
  };
  var userPlan = 'premium';       // fail-open until get_my_plan() returns (never wrongly locks)
  var planHome = 'dashboard.html';
  function planMinFor(href) { var f = (href || '').split('/').pop().split('?')[0].toLowerCase(); return PLAN_MIN[f] || 'starter'; }
  function planAllows(href) { return (PLAN_RANK[userPlan] || 1) >= (PLAN_RANK[planMinFor(href)] || 1); }

  // subtle line icons (Feather) per category header — keyed by English label
  var GROUP_ICONS = {
    'Main': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    'People': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
    'Academic': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    'Finance': '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    'Communicate': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'Settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    'Learning': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    'General': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'
  };

  function buildNav(menu, rank) {
    var lang = langOf();
    var here = curFile();
    var html = '';
    menu.forEach(function (group) {
      var links = group.items.filter(function (it) { return (TIER_RANK[it.tier] || 2) <= rank; });
      if (!links.length) return;
      var hasActive = links.some(function (it) { return it.href.toLowerCase() === here; });
      var open = hasActive ? ' open' : '';
      var ic = GROUP_ICONS[group.label.en] || '';
      html += '<button type="button" class="pk-sb-group' + open + '">'
        + '<span class="pk-sb-gl">'
        + (ic ? '<svg class="pk-sb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ic + '</svg>' : '')
        + '<span>' + esc(group.label[lang]) + '</span></span>'
        + '<span class="chev">&#8250;</span></button>';
      html += '<div class="pk-sb-sub' + open + '">';
      links.forEach(function (it) {
        var active = (it.href.toLowerCase() === here) ? ' active' : '';
        if (!planAllows(it.href)) {
          var need = planMinFor(it.href);
          html += '<a class="pk-sb-link pk-locked" href="#" data-need="' + need + '" title="ฟีเจอร์แพกเกจ ' + PLAN_LABEL[need] + '">'
            + esc(it[lang]) + '<span class="pk-lock">🔒 ' + PLAN_LABEL[need] + '</span></a>';
        } else {
          html += '<a class="pk-sb-link' + active + '" href="' + esc(it.href) + '">' + esc(it[lang]) + '</a>';
        }
      });
      html += '</div>';
    });
    return html;
  }

  // ---- Render ---------------------------------------------------------------
  var sb, nav, menu, userRank;

  function render() {
    if (nav) nav.innerHTML = buildNav(menu, userRank);
  }

  // ---- Plan gating: upgrade popup + page block + fetch ----------------------
  function showUpgrade(need, block) {
    need = need || 'pro';
    var old = document.getElementById('pk-upgrade'); if (old) old.remove();
    var planName = PLAN_LABEL[need] || 'Pro';
    var price = PLAN_PRICE[need] || '';
    var ov = document.createElement('div');
    ov.id = 'pk-upgrade';
    var foot = block
      ? '<a href="' + planHome + '" class="pk-up-btn">← กลับหน้าหลัก</a>'
        + '<a href="billing.html" class="pk-up-cancel" style="text-decoration:none;display:block;">ดูแพกเกจ / อัปเกรด</a>'
      : '<a href="billing.html" class="pk-up-btn">ดูแพกเกจ / อัปเกรด</a>'
        + '<button class="pk-up-cancel" type="button">ไว้ก่อน</button>';
    ov.innerHTML = '<div class="pk-up-box">'
      + (block ? '' : '<button class="pk-up-x" type="button">&times;</button>')
      + '<div class="pk-up-ic">🔒</div>'
      + '<h3>ฟีเจอร์นี้อยู่ในแพกเกจ ' + planName + '</h3>'
      + '<p>อัปเกรดเป็น <b>' + planName + '</b>' + (price ? ' (' + price + '/เดือน)' : '') + ' เพื่อปลดล็อกฟีเจอร์นี้และอีกมากมาย</p>'
      + '<div class="pk-up-foot">' + foot + '</div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    var x = ov.querySelector('.pk-up-x'); if (x) x.addEventListener('click', close);
    if (!block) {
      var c = ov.querySelector('.pk-up-cancel'); if (c && c.tagName === 'BUTTON') c.addEventListener('click', close);
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    }
  }

  function enforcePagePlan() {
    if (!planAllows(curFile())) showUpgrade(planMinFor(curFile()), true);
  }

  function loadPlan() {
    var cached = null; try { cached = sessionStorage.getItem('pk_plan'); } catch (e) {}
    if (cached) { userPlan = cached; render(); enforcePagePlan(); return; }
    if (typeof supabaseClient === 'undefined' || !supabaseClient.rpc) return;
    supabaseClient.rpc('get_my_plan').then(function (r) {
      userPlan = (r && r.data && r.data.plan) || 'premium';
      try { sessionStorage.setItem('pk_plan', userPlan); } catch (e) {}
      render(); enforcePagePlan();
    }).catch(function () {});
  }

  function mount(isStudent, rank) {
    menu = isStudent ? STUDENT_MENU : STAFF_MENU;
    userRank = rank;
    planHome = isStudent ? 'student-dashboard.html' : 'dashboard.html';

    var style = document.createElement('style');
    style.id = 'pk-sb-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    // base path for the logo image (pages live in /pages/)
    var logo = '../images/panya-schoolkit-lockup.png';

    sb = document.createElement('aside');
    sb.id = 'pk-sb';
    sb.innerHTML = '<div class="pk-sb-brand"><img src="' + logo + '" alt="Panya School Kit" '
      + 'onerror="this.style.display=\'none\'" /></div>'
      + (isStudent ? '' : '<div class="pk-sb-search"><input type="text" id="pk-sb-search-input" placeholder="'
          + (langOf() === 'en' ? 'Search students / teachers…' : 'ค้นหานักเรียน/ครู…') + '" autocomplete="off" />'
          + '<div class="pk-sb-search-results" id="pk-sb-search-results"></div></div>')
      + '<nav class="pk-sb-nav"></nav>';
    document.body.appendChild(sb);
    nav = sb.querySelector('.pk-sb-nav');
    if (!isStudent) initGlobalSearch();

    // accordion: click a category header to expand/collapse its sub-links
    nav.addEventListener('click', function (e) {
      var g = e.target.closest('.pk-sb-group');
      if (!g) return;
      var sub = g.nextElementSibling;
      var willOpen = !g.classList.contains('open');
      g.classList.toggle('open', willOpen);
      if (sub && sub.classList.contains('pk-sb-sub')) sub.classList.toggle('open', willOpen);
    });

    var backdrop = document.createElement('div');
    backdrop.id = 'pk-sb-backdrop';
    document.body.appendChild(backdrop);

    var toggle = document.createElement('button');
    toggle.id = 'pk-sb-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Menu');
    toggle.innerHTML = '☰';
    document.body.appendChild(toggle);

    function openSb() { sb.classList.add('open'); backdrop.classList.add('show'); }
    function closeSb() { sb.classList.remove('open'); backdrop.classList.remove('show'); }
    toggle.addEventListener('click', function () { sb.classList.contains('open') ? closeSb() : openSb(); });
    backdrop.addEventListener('click', closeSb);
    sb.addEventListener('click', function (e) { if (e.target.closest('a.pk-sb-link')) closeSb(); });

    document.body.classList.add('pk-has-sb');
    render();
    applyBrand();
    document.addEventListener('langchange', render);

    // plan gating: locked menu items open the upgrade popup
    nav.addEventListener('click', function (e) {
      var lk = e.target.closest('a.pk-locked');
      if (lk) { e.preventDefault(); e.stopPropagation(); showUpgrade(lk.getAttribute('data-need'), false); }
    });
    loadPlan();
  }

  // ---- Global search: find a student/teacher fast from any page ------------
  function initGlobalSearch() {
    var input = document.getElementById('pk-sb-search-input');
    var results = document.getElementById('pk-sb-search-results');
    if (!input || !results) return;
    var timer = null, seq = 0;
    var basePath = (location.pathname.indexOf('/pages/') > -1) ? '' : 'pages/';

    function close() { results.classList.remove('show'); results.innerHTML = ''; }
    function renderEmpty(msg) {
      results.innerHTML = '<div class="pk-sr-empty">' + esc(msg) + '</div>';
      results.classList.add('show');
    }
    function renderResults(rows) {
      if (!rows || !rows.length) { renderEmpty(langOf() === 'en' ? 'No matches' : 'ไม่พบผลลัพธ์'); return; }
      results.innerHTML = rows.map(function (r) {
        var badgeCls = r.type === 'teacher' ? 'teacher' : 'student';
        var badgeTxt = r.type === 'teacher' ? (langOf() === 'en' ? 'Teacher' : 'ครู') : (langOf() === 'en' ? 'Student' : 'นักเรียน');
        return '<a class="pk-sr-item" href="' + basePath + esc(r.href) + '">'
          + '<span class="pk-sr-title">' + esc(r.title) + '<span class="pk-sr-badge ' + badgeCls + '">' + badgeTxt + '</span></span>'
          + (r.subtitle ? '<div class="pk-sr-sub">' + esc(r.subtitle) + '</div>' : '')
          + '</a>';
      }).join('');
      results.classList.add('show');
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { close(); return; }
      timer = setTimeout(function () {
        var mySeq = ++seq;
        if (typeof supabaseClient === 'undefined' || !supabaseClient.rpc) return;
        supabaseClient.rpc('global_search', { p_query: q }).then(function (res) {
          if (mySeq !== seq) return; // stale response
          renderResults((res && res.data) || []);
        }).catch(function () { if (mySeq === seq) close(); });
      }, 250);
    });
    input.addEventListener('focus', function () { if (results.innerHTML) results.classList.add('show'); });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.pk-sb-search')) close();
    });
  }

  // ---- Tenant branding: show the SCHOOL's own name + logo (not hardcoded) ----
  // So a tenant's students/parents/staff see THEIR school, never "SKKS".
  // Falls back silently to the default lockup if the RPC isn't deployed yet.
  async function applyBrand() {
    try {
      if (!sb || !window.supabaseClient) return;
      var brandEl = sb.querySelector('.pk-sb-brand');
      if (!brandEl) return;
      if (window.getTenant) { try { await window.getTenant(); } catch (e) {} }
      var res = await window.supabaseClient.rpc('get_school_branding');
      var b = (res && res.data) || null;
      if (!b) return;
      var name = b.name || b.name_en || '';
      var img = brandEl.querySelector('img');
      if (b.logo_url) {
        if (img) { img.src = b.logo_url; img.alt = name || 'School'; img.style.display = ''; }
      } else if (img) {
        img.style.display = 'none';   // no school logo → show name text only (hide product lockup)
      }
      if (name) {
        var nameEl = brandEl.querySelector('.pk-sb-name');
        if (!nameEl) {
          nameEl = document.createElement('span');
          nameEl.className = 'pk-sb-name';
          nameEl.style.cssText = 'font-family:inherit;font-weight:700;font-size:13.5px;line-height:1.2;color:#0F1A36;';
          brandEl.appendChild(nameEl);
        }
        nameEl.textContent = name;
        try {
          var pageTitle = (document.title.split('—')[0] || '').trim();
          document.title = (pageTitle ? pageTitle + ' — ' : '') + name;
        } catch (e) {}
      }
      // theme color → CSS variable + accent override (sidebar active link + primary buttons)
      if (b.theme_color) {
        try {
          document.documentElement.style.setProperty('--brand', b.theme_color);
          var st = document.getElementById('pk-brand-style');
          if (!st) { st = document.createElement('style'); st.id = 'pk-brand-style'; document.head.appendChild(st); }
          var c = b.theme_color;
          st.textContent =
            '#pk-sb a.pk-sb-link.active{background:' + c + '1a;color:' + c + ';}' +
            '.btn-primary,.pk-btn-primary,.btn.btn-primary{background:' + c + ' !important;border-color:' + c + ' !important;}';
        } catch (e) {}
      }
      // gentle reminder (NOT a lock): owner with no branding yet → dismissible banner
      try {
        var path = location.pathname || '';
        if (!b.theme_color && path.indexOf('brand-setup') < 0 && path.indexOf('/admin/') < 0
            && !sessionStorage.getItem('pk-brand-reminded') && window.auth && window.auth.getProfile) {
          var prof = await window.auth.getProfile();
          if (prof && prof.role === 'owner') showBrandReminder(path);
        }
      } catch (e) {}
    } catch (e) { /* keep default branding on any error (e.g. RPC not deployed yet) */ }
  }

  // Small dismissible toast nudging the owner to set up branding (no forced redirect).
  function showBrandReminder(path) {
    if (document.getElementById('pk-brand-reminder')) return;
    var setupHref = (path.indexOf('/pages/') > -1 ? 'brand-setup.html' : 'pages/brand-setup.html');
    var bar = document.createElement('div');
    bar.id = 'pk-brand-reminder';
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:9998;'
      + 'background:#0F1A36;color:#fff;border-radius:12px;padding:11px 12px 11px 16px;display:flex;align-items:center;gap:12px;'
      + 'box-shadow:0 12px 30px -10px rgba(0,0,0,.4);font-family:"IBM Plex Sans Thai",sans-serif;font-size:13.5px;max-width:94vw;';
    bar.innerHTML = '<span>ตั้งสี + โลโก้ของโรงเรียน ให้ดูเป็นแบรนด์ของคุณเอง</span>'
      + '<a href="' + setupHref + '" style="background:#2563EB;color:#fff;text-decoration:none;padding:7px 14px;border-radius:8px;font-weight:600;white-space:nowrap;">ตั้งค่า</a>'
      + '<button type="button" aria-label="ปิด" style="background:transparent;border:none;color:#9AA3B5;font-size:20px;cursor:pointer;line-height:1;padding:0 4px;">&times;</button>';
    bar.querySelector('button').onclick = function () {
      try { sessionStorage.setItem('pk-brand-reminded', '1'); } catch (e) {}
      bar.remove();
    };
    document.body.appendChild(bar);
  }

  // ---- Init -----------------------------------------------------------------
  async function init() {
    var role = 'staff';
    try {
      if (window.auth && typeof window.auth.getProfile === 'function') {
        var p = await window.auth.getProfile();
        if (p && p.role) role = p.role;
      }
    } catch (e) { /* fall back to staff/admin menu */ }

    var isStudent = (role === 'student' || role === 'parent');
    // role → tier rank (teacher 1 < admin 2 < owner 3)
    var rank;
    if (role === 'owner' || role === 'developer') rank = 3;        // owner: everything incl finance
    else if (role === 'teacher') rank = 1;                          // teacher: teaching tools only
    else if (isStudent) rank = 99;                                  // student menu (no tiers)
    else rank = 2;                                                  // staff = admin: all except finance

    mount(isStudent, rank);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
