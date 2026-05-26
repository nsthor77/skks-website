/* ============================================================
   PanyaSchoolKit i18n Module (Sprint 10.6)
   Default: English (EN). User can switch to Thai (TH) via toggle.
   Used across ALL tenant + admin system pages (NOT marketing site).
   ============================================================ */

(function() {
  'use strict';

  const STORAGE_KEY = 'pk_lang';
  const DEFAULT_LANG = 'en'; // EN as default for system pages

  // ============================================================
  // Translation dictionary
  // ============================================================
  const TRANSLATIONS = {
    common: {
      save:    { en: '💾 Save',  th: '💾 บันทึก' },
      cancel:  { en: 'Cancel',    th: 'ยกเลิก' },
      delete:  { en: '🗑️ Delete', th: '🗑️ ลบ' },
      edit:    { en: '✏️ Edit',  th: '✏️ แก้ไข' },
      add:     { en: '➕ Add',   th: '➕ เพิ่ม' },
      back:    { en: '← Back',   th: '← กลับ' },
      close:   { en: 'Close',    th: 'ปิด' },
      loading: { en: 'Loading...', th: 'กำลังโหลด...' },
      saving:  { en: 'Saving...', th: 'กำลังบันทึก...' },
      yes:     { en: 'Yes',      th: 'ใช่' },
      no:      { en: 'No',       th: 'ไม่ใช่' },
      search:  { en: 'Search...', th: 'ค้นหา...' },
      filter:  { en: 'Filter',   th: 'ตัวกรอง' },
      all:     { en: 'All',      th: 'ทั้งหมด' },
      none:    { en: 'None',     th: 'ไม่มี' },
      required:{ en: 'Required', th: 'จำเป็น' },
      optional:{ en: 'Optional', th: 'ไม่จำเป็น' },
      success: { en: 'Success',  th: 'สำเร็จ' },
      error:   { en: 'Error',    th: 'ผิดพลาด' },
      confirm: { en: 'Confirm',  th: 'ยืนยัน' },
      total:   { en: 'Total',    th: 'ทั้งหมด' },
      active:  { en: 'Active',   th: 'ใช้งาน' },
      inactive:{ en: 'Inactive', th: 'ปิด' },
      status:  { en: 'Status',   th: 'สถานะ' },
      actions: { en: 'Actions',  th: 'ดำเนินการ' },
      name:    { en: 'Name',     th: 'ชื่อ' },
      email:   { en: 'Email',    th: 'อีเมล' },
      phone:   { en: 'Phone',    th: 'เบอร์โทร' },
      address: { en: 'Address',  th: 'ที่อยู่' },
      signOut: { en: 'Sign Out', th: 'ออกจากระบบ' },
      backToApp: { en: '↩️ Back to App', th: '↩️ กลับไปแอป' }
    },
    nav: {
      dashboard: { en: 'Dashboard', th: 'แดชบอร์ด' },
      students:  { en: 'Students',  th: 'นักเรียน' },
      teachers:  { en: 'Teachers',  th: 'ครู' },
      applications: { en: 'Applications', th: 'ใบสมัคร' },
      attendance: { en: 'Attendance', th: 'เช็คชื่อ' },
      grades:    { en: 'Grades',    th: 'เกรด' },
      finance:   { en: 'Finance',   th: 'การเงิน' },
      billing:   { en: 'Billing',   th: 'บิล' },
      invoices:  { en: 'Invoices',  th: 'ใบแจ้งหนี้' },
      payments:  { en: 'Payments',  th: 'การชำระเงิน' },
      events:    { en: 'Events',    th: 'กิจกรรม' },
      news:      { en: 'News',      th: 'ข่าวสาร' },
      reports:   { en: 'Reports',   th: 'รายงาน' },
      settings:  { en: 'Settings',  th: 'ตั้งค่า' },
      users:     { en: 'Users',     th: 'ผู้ใช้' },
      tenants:   { en: 'Tenants',   th: 'โรงเรียน' },
      waitlist:  { en: 'Waitlist',  th: 'รายชื่อจอง' },
      admin:     { en: 'Admin',     th: 'แอดมิน' }
    },
    login: {
      title:    { en: 'Sign In', th: 'เข้าสู่ระบบ' },
      subtitle: { en: 'Welcome back to PanyaSchoolKit', th: 'ยินดีต้อนรับสู่ PanyaSchoolKit' },
      email:    { en: 'Email', th: 'อีเมล' },
      password: { en: 'Password', th: 'รหัสผ่าน' },
      signIn:   { en: 'Sign In', th: 'เข้าสู่ระบบ' },
      forgot:   { en: 'Forgot password?', th: 'ลืมรหัสผ่าน?' },
      noAccount: { en: 'Don\'t have an account?', th: 'ยังไม่มีบัญชี?' },
      signUp:   { en: 'Sign up here', th: 'สมัครที่นี่' },
      invalidEmail: { en: 'Invalid email or password', th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
      signingIn: { en: 'Signing in...', th: 'กำลังเข้าสู่ระบบ...' }
    },
    students: {
      title:    { en: '🎓 Students', th: '🎓 นักเรียน' },
      subtitle: { en: 'Manage student records', th: 'จัดการข้อมูลนักเรียน' },
      addStudent: { en: '➕ Add Student', th: '➕ เพิ่มนักเรียน' },
      importCsv: { en: '📥 Import CSV', th: '📥 นำเข้า CSV' },
      exportCsv: { en: '📤 Export CSV', th: '📤 Export CSV' },
      configFields: { en: '⚙️ Configure Fields', th: '⚙️ ตั้งค่าฟิลด์' },
      searchPlaceholder: { en: '🔍 Search by name / ID / nickname', th: '🔍 ค้นหาชื่อ / รหัสนักเรียน / ชื่อเล่น' },
      filterStatus: { en: 'All statuses', th: 'ทุกสถานะ' },
      filterProgram: { en: 'All programs', th: 'ทุกหลักสูตร' },
      filterGrade: { en: 'Grade', th: 'ระดับชั้น' },
      filterClassroom: { en: 'Class', th: 'ห้อง' },
      colStudentNumber: { en: 'Student ID', th: 'รหัสนักเรียน' },
      colName: { en: 'Name', th: 'ชื่อ - นามสกุล' },
      colProgram: { en: 'Program', th: 'หลักสูตร' },
      colGrade: { en: 'Grade', th: 'ชั้น' },
      colClassroom: { en: 'Class', th: 'ห้อง' },
      colGender: { en: 'Gender', th: 'เพศ' },
      colParentPhone: { en: 'Parent Phone', th: 'เบอร์ผู้ปกครอง' },
      colStatus: { en: 'Status', th: 'สถานะ' },
      colActions: { en: 'Actions', th: 'ดำเนินการ' },
      statTotal: { en: 'Total', th: 'ทั้งหมด' },
      statActive: { en: 'Studying', th: 'กำลังเรียน' },
      statMale: { en: 'Male', th: 'ชาย' },
      statFemale: { en: 'Female', th: 'หญิง' },
      statGraduated: { en: 'Graduated', th: 'จบ' },
      statusActive: { en: 'Studying', th: 'กำลังเรียน' },
      statusInactive: { en: 'Suspended', th: 'หยุดเรียน' },
      statusGraduated: { en: 'Graduated', th: 'จบ' },
      statusTransferred: { en: 'Transferred', th: 'ย้าย' },
      genderMale: { en: '♂ Male', th: '♂ ชาย' },
      genderFemale: { en: '♀ Female', th: '♀ หญิง' },
      genderOther: { en: 'Other', th: 'อื่นๆ' },
      programPrek: { en: 'Pre-K', th: 'เตรียมอนุบาล' },
      programK: { en: 'Kindergarten', th: 'อนุบาล' },
      programEp: { en: 'EP', th: 'EP' },
      programMep: { en: 'MEP', th: 'MEP' },
      programThai: { en: 'Thai Regular', th: 'ปกติ' },
      empty: { en: 'No students yet', th: 'ยังไม่มีนักเรียน' },
      emptyDesc: { en: 'Click "Add Student" or "Import CSV" to begin', th: 'กดปุ่ม "เพิ่มนักเรียน" หรือ "นำเข้า CSV" เพื่อเริ่ม' },
      countInfo: { en: 'Showing {start}–{end} of {total} students', th: 'แสดง {start}–{end} จาก {total} คน' },
      pageOf: { en: 'Page {current} of {total}', th: 'หน้า {current} จาก {total}' },
      prev: { en: '‹ Prev', th: '‹ ก่อนหน้า' },
      next: { en: 'Next ›', th: 'ถัดไป ›' },
      modalAdd: { en: '➕ Add Student', th: '➕ เพิ่มนักเรียน' },
      modalEdit: { en: '✏️ Edit Student', th: '✏️ แก้ไขนักเรียน' },
      sectionGeneral: { en: 'General Info', th: 'ข้อมูลทั่วไป' },
      sectionAcademic: { en: 'Academic', th: 'การศึกษา' },
      sectionParent1: { en: 'Parent / Guardian #1', th: 'ผู้ปกครอง #1' },
      sectionParent2: { en: 'Parent / Guardian #2 (optional)', th: 'ผู้ปกครอง #2 (ถ้ามี)' },
      sectionEmergency: { en: 'Emergency Contact', th: 'ผู้ติดต่อกรณีฉุกเฉิน' },
      sectionMedical: { en: 'Health / Notes', th: 'สุขภาพ / หมายเหตุ' },
      sectionCustom: { en: 'Additional Info', th: 'ข้อมูลเพิ่มเติม' },
      fldStudentNumber: { en: 'Student ID', th: 'รหัสนักเรียน' },
      fldFirstNameTh: { en: 'First Name (Thai)', th: 'ชื่อ (ไทย)' },
      fldLastNameTh: { en: 'Last Name (Thai)', th: 'นามสกุล (ไทย)' },
      fldFirstNameEn: { en: 'First Name (English)', th: 'ชื่อ (อังกฤษ)' },
      fldLastNameEn: { en: 'Last Name (English)', th: 'นามสกุล (อังกฤษ)' },
      fldNickname: { en: 'Nickname', th: 'ชื่อเล่น' },
      fldGender: { en: 'Gender', th: 'เพศ' },
      fldBirthDate: { en: 'Date of Birth', th: 'วันเกิด' },
      fldNationality: { en: 'Nationality', th: 'สัญชาติ' },
      fldNationalId: { en: 'National ID', th: 'เลขบัตรประชาชน' },
      fldBloodType: { en: 'Blood Type', th: 'หมู่เลือด' },
      fldProgram: { en: 'Program', th: 'หลักสูตร' },
      fldAcademicYear: { en: 'Academic Year', th: 'ปีการศึกษา' },
      fldGrade: { en: 'Grade Level', th: 'ระดับชั้น' },
      fldClassroom: { en: 'Classroom', th: 'ห้อง' },
      fldEnrollmentDate: { en: 'Enrollment Date', th: 'วันเข้าเรียน' },
      fldParentName: { en: 'Full Name', th: 'ชื่อ-นามสกุล' },
      fldRelation: { en: 'Relationship', th: 'ความสัมพันธ์' },
      fldOccupation: { en: 'Occupation', th: 'อาชีพ' },
      fldMedicalConditions: { en: 'Medical Conditions', th: 'โรคประจำตัว' },
      fldAllergies: { en: 'Allergies', th: 'ภูมิแพ้ / อาหารแพ้' },
      fldMedications: { en: 'Medications', th: 'ยาที่ต้องทาน' },
      fldNotes: { en: 'Additional Notes', th: 'หมายเหตุเพิ่มเติม' },
      relFather: { en: 'Father', th: 'บิดา' },
      relMother: { en: 'Mother', th: 'มารดา' },
      relGuardian: { en: 'Guardian', th: 'ผู้ปกครอง' },
      relGrandfather: { en: 'Grandfather', th: 'ปู่/ตา' },
      relGrandmother: { en: 'Grandmother', th: 'ย่า/ยาย' },
      relOther: { en: 'Other', th: 'อื่นๆ' },
      saveSuccess: { en: 'Saved ✓', th: 'บันทึกสำเร็จ ✓' },
      addSuccess: { en: 'Student added ✓', th: 'เพิ่มนักเรียนสำเร็จ ✓' },
      deleteSuccess: { en: 'Deleted', th: 'ลบสำเร็จ' },
      saveFailed: { en: 'Save failed: ', th: 'บันทึกไม่สำเร็จ: ' },
      loadFailed: { en: 'Load failed: ', th: 'โหลดไม่สำเร็จ: ' },
      confirmDelete: { en: 'Delete student {number}?\nThis cannot be undone.', th: 'ลบนักเรียนรหัส {number}?\nการลบนี้กู้คืนไม่ได้' },
      detailBack: { en: '← Back to Students', th: '← กลับไปรายชื่อนักเรียน' },
      detailNotFound: { en: '❌ Student not found', th: '❌ ไม่พบข้อมูลนักเรียน' }
    },
    dashboard: {
      title: { en: '📊 Dashboard', th: '📊 แดชบอร์ด' },
      welcome: { en: 'Welcome back, {name}', th: 'ยินดีต้อนรับ, {name}' },
      yourRole: { en: 'Your role:', th: 'สิทธิ์:' },
      totalStudents: { en: 'TOTAL STUDENTS', th: 'นักเรียนทั้งหมด' },
      activeEnrollments: { en: 'Active enrollments', th: 'นักเรียนปัจจุบัน' },
      pendingApplications: { en: 'PENDING APPLICATIONS', th: 'ใบสมัครรอตรวจ' },
      awaitingReview: { en: 'Awaiting review', th: 'รอการตรวจสอบ' },
      thisMonthRevenue: { en: 'THIS MONTH\'S REVENUE', th: 'รายได้เดือนนี้' },
      paymentsReceived: { en: 'Payments received', th: 'การชำระที่รับแล้ว' },
      totalUsers: { en: 'TOTAL USERS', th: 'ผู้ใช้ทั้งหมด' },
      allAccounts: { en: 'All accounts', th: 'บัญชีทั้งหมด' },
      quickActions: { en: '⚡ Quick Actions', th: '⚡ ทางลัด' },
      manageStudents: { en: 'Manage Students', th: 'จัดการนักเรียน' },
      addEditView: { en: 'Add, edit, view', th: 'เพิ่ม แก้ไข ดู' },
      reviewApplications: { en: 'Review Applications', th: 'ตรวจใบสมัคร' },
      pendingDecisions: { en: 'Pending decisions', th: 'รอตัดสินใจ' },
      recordPayment: { en: 'Record Payment', th: 'บันทึกการชำระ' },
      newTransaction: { en: 'New transaction', th: 'รายการใหม่' },
      inviteCodes: { en: 'Invite Codes', th: 'รหัสเชิญ' },
      addStaff: { en: 'Add staff', th: 'เพิ่มเจ้าหน้าที่' },
      recentApplications: { en: '📋 Recent Applications', th: '📋 ใบสมัครล่าสุด' },
      recentPayments: { en: '💳 Recent Payments', th: '💳 การชำระเงินล่าสุด' },
      viewAll: { en: 'View All →', th: 'ดูทั้งหมด →' },
      noApplicationsYet: { en: 'No applications yet', th: 'ยังไม่มีใบสมัคร' },
      noPaymentsYet: { en: 'No payments yet', th: 'ยังไม่มีการชำระ' }
    },
    billing: {
      title: { en: '💳 Billing', th: '💳 การเรียกเก็บเงิน' },
      subtitle: { en: 'Manage your school\'s subscription', th: 'จัดการการสมัครสมาชิกของโรงเรียน' },
      currentPlan: { en: 'Current Plan', th: 'แผนปัจจุบัน' },
      status: { en: 'Status', th: 'สถานะ' },
      billingCycle: { en: 'Billing Cycle', th: 'รอบการเรียกเก็บ' },
      nextBillDate: { en: 'Next Bill Date', th: 'วันเรียกเก็บถัดไป' },
      paymentMethod: { en: 'Payment Method', th: 'วิธีการชำระเงิน' },
      monthly: { en: 'Monthly', th: 'รายเดือน' },
      yearly: { en: 'Yearly', th: 'รายปี' },
      trialing: { en: 'Trialing', th: 'ทดลองใช้' },
      active: { en: 'Active', th: 'ใช้งานอยู่' },
      cancelled: { en: 'Cancelled', th: 'ยกเลิกแล้ว' },
      pastDue: { en: 'Past Due', th: 'เกินกำหนด' },
      suspended: { en: 'Suspended', th: 'ระงับ' },
      changePlan: { en: 'Change Plan', th: 'เปลี่ยนแผน' },
      cancelSubscription: { en: 'Cancel Subscription', th: 'ยกเลิกการสมัคร' },
      resumeSubscription: { en: 'Resume Subscription', th: 'กู้คืนการสมัคร' },
      updateCard: { en: 'Update Card', th: 'เปลี่ยนบัตร' },
      billingInfo: { en: 'Billing Information', th: 'ข้อมูลผู้ชำระเงิน (Bill to)' },
      companyName: { en: 'Company / Person Name', th: 'ชื่อบริษัท / บุคคล' },
      taxId: { en: 'Tax ID', th: 'เลขประจำตัวผู้เสียภาษี' }
    }
  };

  // ============================================================
  // i18n API
  // ============================================================
  let currentLang = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || DEFAULT_LANG;
  if (currentLang !== 'en' && currentLang !== 'th') currentLang = DEFAULT_LANG;

  function t(key, params) {
    const parts = key.split('.');
    let node = TRANSLATIONS;
    for (const p of parts) {
      if (node && typeof node === 'object' && p in node) {
        node = node[p];
      } else {
        return key;
      }
    }
    if (!node || typeof node !== 'object' || !(currentLang in node)) return key;
    let value = node[currentLang];
    if (params && typeof params === 'object') {
      for (const k in params) {
        value = value.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      }
    }
    return value;
  }

  function getLang() { return currentLang; }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'th') return;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    document.documentElement.lang = lang;
    applyToDom();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  function applyToDom() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const params = parseParams(el.getAttribute('data-i18n-params'));
      el.textContent = t(key, params);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      const params = parseParams(el.getAttribute('data-i18n-params'));
      el.innerHTML = t(key, params);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(';').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (attr && key) {
          const params = parseParams(el.getAttribute('data-i18n-params'));
          el.setAttribute(attr, t(key, params));
        }
      });
    });
    document.querySelectorAll('.pk-lang-toggle button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === currentLang);
    });
  }

  function parseParams(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch (e) { return null; }
  }

  function injectToggle(container) {
    let el = typeof container === 'string' ? document.querySelector(container) : container;
    // Try common containers in priority order
    if (!el) el = document.querySelector(
      '.topbar-right, .admin-topbar-right, #topbar-right, ' +
      '.admin-main .page-header .actions, ' +    // admin pages with actions
      '.admin-main .page-header'                    // admin pages without actions
    );
    if (!el) return null;
    if (el.querySelector('.pk-lang-toggle')) return el.querySelector('.pk-lang-toggle');

    const toggle = document.createElement('div');
    toggle.className = 'pk-lang-toggle';
    toggle.innerHTML = `
      <button type="button" data-lang="en">EN</button>
      <button type="button" data-lang="th">TH</button>
    `;
    toggle.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-lang]');
      if (btn) setLang(btn.getAttribute('data-lang'));
    });
    el.insertBefore(toggle, el.firstChild);
    return toggle;
  }

  function init() {
    document.documentElement.lang = currentLang;
    injectToggle();
    applyToDom();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Minimal CSS for toggle (injected once)
  if (!document.getElementById('pk-i18n-style')) {
    const style = document.createElement('style');
    style.id = 'pk-i18n-style';
    style.textContent = `
      .pk-lang-toggle {
        display: inline-flex;
        background: #EBF0FA;
        border-radius: 100px;
        padding: 3px;
        font-size: 12px;
        font-weight: 600;
        font-family: 'Inter', sans-serif;
        margin-right: 10px;
      }
      .pk-lang-toggle button {
        padding: 5px 11px;
        border: none;
        background: transparent;
        color: #4B5670;
        border-radius: 100px;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.2;
      }
      .pk-lang-toggle button.active {
        background: #FFFFFF;
        color: #1E40AF;
        box-shadow: 0 1px 3px rgba(15,26,54,0.1);
      }
    `;
    document.head.appendChild(style);
  }

  window.pkI18n = { t, getLang, setLang, applyToDom, injectToggle };
  window.t = t;
})();
