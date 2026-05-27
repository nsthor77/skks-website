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
      myGrades:  { en: 'My Grades', th: 'เกรดของฉัน' },
      myAttendance: { en: 'My Attendance', th: 'การเข้าเรียน' },
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

    // ---------- Teachers (Sprint 11) ----------
    teachers: {
      title: { en: '👨‍🏫 Teachers', th: '👨‍🏫 ครู' },
      subtitle: { en: 'Manage teacher records and assignments', th: 'จัดการข้อมูลครูและการมอบหมาย' },
      addTeacher: { en: '➕ Add Teacher', th: '➕ เพิ่มครู' },
      importCsv: { en: '📥 Import CSV', th: '📥 นำเข้า CSV' },
      exportCsv: { en: '📤 Export CSV', th: '📤 Export CSV' },
      searchPlaceholder: { en: '🔍 Search name / ID / email', th: '🔍 ค้นหาชื่อ / รหัส / อีเมล' },
      allStatuses: { en: 'All statuses', th: 'ทุกสถานะ' },
      allPositions: { en: 'All positions', th: 'ทุกตำแหน่ง' },
      filterDept: { en: 'Department', th: 'แผนก' },
      colEmpId: { en: 'Employee ID', th: 'รหัสพนักงาน' },
      colName: { en: 'Name', th: 'ชื่อ' },
      colPosition: { en: 'Position', th: 'ตำแหน่ง' },
      colDept: { en: 'Department', th: 'แผนก' },
      colHomeroom: { en: 'Homeroom', th: 'ครูประจำชั้น' },
      colEmail: { en: 'Email', th: 'อีเมล' },
      colStatus: { en: 'Status', th: 'สถานะ' },
      colActions: { en: 'Actions', th: 'ดำเนินการ' },
      statTotal: { en: 'Total', th: 'ทั้งหมด' },
      statActive: { en: 'Active', th: 'ทำงาน' },
      statHomeroom: { en: 'Homeroom', th: 'ครูประจำชั้น' },
      statMale: { en: 'Male', th: 'ชาย' },
      statFemale: { en: 'Female', th: 'หญิง' },
      statOnLeave: { en: 'On Leave', th: 'ลาพัก' },
      statusActive: { en: 'Active', th: 'ทำงาน' },
      statusInactive: { en: 'Inactive', th: 'พักงาน' },
      statusOnLeave: { en: 'On Leave', th: 'ลาพัก' },
      statusResigned: { en: 'Resigned', th: 'ลาออก' },
      genderMale: { en: '♂ Male', th: '♂ ชาย' },
      genderFemale: { en: '♀ Female', th: '♀ หญิง' },
      genderOther: { en: 'Other', th: 'อื่นๆ' },
      posPrincipal: { en: 'Principal', th: 'ผู้อำนวยการ' },
      posVicePrincipal: { en: 'Vice Principal', th: 'รองผู้อำนวยการ' },
      posHomeroom: { en: 'Homeroom Teacher', th: 'ครูประจำชั้น' },
      posSubject: { en: 'Subject Teacher', th: 'ครูประจำวิชา' },
      posAssistant: { en: 'Assistant', th: 'ผู้ช่วยครู' },
      posAdmin: { en: 'Admin', th: 'ฝ่ายธุรการ' },
      modalAdd: { en: '➕ Add Teacher', th: '➕ เพิ่มครู' },
      modalEdit: { en: '✏️ Edit Teacher', th: '✏️ แก้ไขครู' },
      sectionGeneral: { en: 'General Info', th: 'ข้อมูลทั่วไป' },
      sectionEmployment: { en: 'Employment', th: 'การจ้างงาน' },
      sectionQualifications: { en: 'Qualifications', th: 'คุณวุฒิ' },
      sectionEmergency: { en: 'Emergency Contact', th: 'ติดต่อฉุกเฉิน' },
      sectionAbout: { en: 'About / Notes', th: 'ประวัติ / หมายเหตุ' },
      sectionCustom: { en: 'Additional Info', th: 'ข้อมูลเพิ่มเติม' },
      manageSubjects: { en: '📚 Subjects', th: '📚 วิชา' },
      configFields: { en: '⚙️ Configure Fields', th: '⚙️ ตั้งค่าฟิลด์' },
      configFieldsShort: { en: '⚙️ Configure', th: '⚙️ ตั้งค่า' },
      fldEmpId: { en: 'Employee ID', th: 'รหัสพนักงาน' },
      fldStatus: { en: 'Status', th: 'สถานะ' },
      fldTitleTh: { en: 'Title (Thai)', th: 'คำนำหน้า (ไทย)' },
      fldTitleEn: { en: 'Title (English)', th: 'คำนำหน้า (อังกฤษ)' },
      fldFirstNameTh: { en: 'First Name (Thai)', th: 'ชื่อ (ไทย)' },
      fldLastNameTh: { en: 'Last Name (Thai)', th: 'นามสกุล (ไทย)' },
      fldFirstNameEn: { en: 'First Name (English)', th: 'ชื่อ (อังกฤษ)' },
      fldLastNameEn: { en: 'Last Name (English)', th: 'นามสกุล (อังกฤษ)' },
      fldNickname: { en: 'Nickname', th: 'ชื่อเล่น' },
      fldGender: { en: 'Gender', th: 'เพศ' },
      fldBirthDate: { en: 'Date of Birth', th: 'วันเกิด' },
      fldNationality: { en: 'Nationality', th: 'สัญชาติ' },
      fldPhone: { en: 'Phone', th: 'เบอร์โทร' },
      fldEmail: { en: 'Email', th: 'อีเมล' },
      fldAddress: { en: 'Address', th: 'ที่อยู่' },
      fldHireDate: { en: 'Hire Date', th: 'วันเริ่มงาน' },
      fldPosition: { en: 'Position', th: 'ตำแหน่ง' },
      fldDept: { en: 'Department', th: 'แผนก' },
      fldHomeroomClass: { en: 'Homeroom Class', th: 'ห้องประจำชั้น' },
      fldIsHomeroom: { en: 'Is homeroom teacher', th: 'เป็นครูประจำชั้น' },
      fldEducation: { en: 'Highest Education', th: 'วุฒิการศึกษาสูงสุด' },
      eduHighSchool: { en: 'High School', th: 'มัธยมศึกษา' },
      eduVocational: { en: 'Vocational', th: 'ปวช./ปวส.' },
      eduBachelor: { en: "Bachelor's", th: 'ปริญญาตรี' },
      eduMaster: { en: "Master's", th: 'ปริญญาโท' },
      eduPhd: { en: 'PhD', th: 'ปริญญาเอก' },
      fldMajor: { en: 'Major', th: 'สาขาวิชา' },
      fldUniversity: { en: 'University', th: 'สถาบันการศึกษา' },
      fldLicense: { en: 'Teacher License', th: 'ใบประกอบวิชาชีพครู' },
      fldEmergencyName: { en: 'Name', th: 'ชื่อ' },
      fldEmergencyRelation: { en: 'Relationship', th: 'ความสัมพันธ์' },
      fldEmergencyPhone: { en: 'Phone', th: 'เบอร์โทร' },
      fldBio: { en: 'Bio', th: 'ประวัติย่อ' },
      fldNotes: { en: 'Notes', th: 'หมายเหตุ' },
      empty: { en: 'No teachers yet', th: 'ยังไม่มีข้อมูลครู' },
      emptyDesc: { en: 'Click "Add Teacher" or "Import CSV" to begin', th: 'กดปุ่ม "เพิ่มครู" หรือ "นำเข้า CSV" เพื่อเริ่ม' },
      countInfo: { en: 'Showing {start}–{end} of {total} teachers', th: 'แสดง {start}–{end} จาก {total} คน' },
      pageOf: { en: 'Page {current} of {total}', th: 'หน้า {current} จาก {total}' },
      saveSuccess: { en: 'Saved ✓', th: 'บันทึกสำเร็จ ✓' },
      addSuccess: { en: 'Teacher added ✓', th: 'เพิ่มครูสำเร็จ ✓' },
      deleteSuccess: { en: 'Deleted', th: 'ลบสำเร็จ' },
      saveFailed: { en: 'Save failed', th: 'บันทึกไม่สำเร็จ' },
      loadFailed: { en: 'Load failed', th: 'โหลดไม่สำเร็จ' },
      deleteFailed: { en: 'Delete failed', th: 'ลบไม่สำเร็จ' },
      confirmDelete: { en: 'Delete teacher "{label}"?\nThis cannot be undone.', th: 'ลบครู "{label}"?\nการลบนี้กู้คืนไม่ได้' },
      importTitle: { en: '📥 Import Teachers from CSV', th: '📥 นำเข้าข้อมูลครู (CSV)' },
      csvClick: { en: 'Click to choose file', th: 'คลิกเพื่อเลือกไฟล์' },
      csvOrDrag: { en: 'or drag CSV here', th: 'หรือลากไฟล์ CSV มาวาง' },
      csvHint: { en: 'Supports .csv UTF-8 BOM', th: 'รองรับไฟล์ .csv ภาษาไทย (UTF-8 BOM)' },
      csvTemplate: { en: '📄 Download template CSV', th: '📄 ดาวน์โหลด template CSV' },
      csvImport: { en: 'Import Data', th: 'นำเข้าข้อมูล' },
      csvImporting: { en: 'Importing...', th: 'กำลังนำเข้า...' },
      csvImportDone: { en: 'Imported {inserted} · Skipped {skipped}', th: 'นำเข้า {inserted} แถว · ข้าม {skipped} แถว' },
      csvImportFailed: { en: 'Import failed', th: 'นำเข้าไม่สำเร็จ' },
      csvFound: { en: 'Found <strong>{count}</strong> rows · preview first 10:', th: 'พบ <strong>{count}</strong> แถว · พรีวิว 10 แถวแรก:' },
      csvOnly: { en: 'Only .csv files supported', th: 'รองรับเฉพาะไฟล์ .csv' },
      csvEmpty: { en: 'File is empty', th: 'ไฟล์ว่างเปล่า' },
      csvParseErr: { en: 'Could not read file', th: 'อ่านไฟล์ไม่ได้' },
      exporting: { en: 'Preparing file...', th: 'กำลังเตรียมไฟล์...' }
    },

    // ---------- Teacher Detail ----------
    teacherDetail: {
      back: { en: '← Back to Teachers', th: '← กลับไปรายชื่อครู' },
      noId: { en: 'No teacher ID specified', th: 'ไม่ได้ระบุ ID ครู' },
      notFound: { en: 'Teacher not found', th: 'ไม่พบข้อมูลครู' },
      noName: { en: '(no name)', th: '(ไม่มีชื่อ)' },
      tenure: { en: 'Tenure', th: 'อายุงาน' },
      years: { en: 'years', th: 'ปี' }
    },

    // ---------- Teacher Custom Fields (Sprint 11.5) ----------
    teacherFields: {
      back: { en: '← Back to Teachers', th: '← กลับไปครู' },
      title: { en: '⚙️ Custom Teacher Fields', th: '⚙️ ตั้งค่าฟิลด์ครู' },
      desc: { en: 'Define extra fields your school needs to collect for teachers — e.g. teaching license, languages spoken, training certificates, etc.', th: 'กำหนดข้อมูลเพิ่มเติมที่โรงเรียนต้องเก็บสำหรับครู เช่น ใบประกอบวิชาชีพครู, ภาษาที่พูดได้, การอบรมพิเศษ ฯลฯ' },
      addField: { en: '➕ Add Field', th: '➕ เพิ่มฟิลด์' },
      howItWorks: { en: '💡 How it works:', th: '💡 ระบบนี้ทำงานยังไง:' },
      howSteps: { en: '<li>Define fields here once</li><li>They appear in the Add/Edit Teacher form under "Additional Info"</li><li>All staff in your school see the same fields — each school\'s data is isolated</li>', th: '<li>กำหนดฟิลด์ที่นี่ครั้งเดียว</li><li>ฟิลด์จะปรากฏใน form เพิ่ม/แก้ไขครูใต้ section "ข้อมูลเพิ่มเติม"</li><li>ทุกคนในโรงเรียนคุณเห็นฟิลด์เดียวกัน — ข้อมูลแต่ละโรงเรียนแยกกัน</li>' },
      modalAdd: { en: '➕ Add Field', th: '➕ เพิ่มฟิลด์' },
      modalEdit: { en: '✏️ Edit Field', th: '✏️ แก้ไขฟิลด์' },
      labelThLabel: { en: 'Form Label (Thai)', th: 'ชื่อที่แสดงในฟอร์ม (ไทย)' },
      labelThHelp: { en: '<strong>This is what staff see</strong> when entering teacher data', th: '<strong>คือชื่อที่คนใช้เห็น</strong> ตอนกรอกข้อมูลครู' },
      labelEnLabel: { en: 'Label (English)', th: 'Label (English)' },
      labelEnHelp: { en: 'Shown when language is EN', th: 'แสดงเมื่อสลับเป็น EN' },
      fieldKeyLabel: { en: 'Field ID (internal)', th: 'รหัสฟิลด์ (ภายในระบบ)' },
      fieldKeyHelp: { en: '<strong>Internal use only</strong> — auto-filled from label', th: '<strong>ใช้ภายในระบบ</strong> — ระบบเติมให้อัตโนมัติ' },
      typeLabel: { en: 'Field Type', th: 'ประเภทข้อมูล' },
      placeholderLabel: { en: 'Placeholder text', th: 'ข้อความแนะนำในช่อง' },
      sortLabel: { en: 'Display order', th: 'ลำดับการแสดง' },
      helpLabel: { en: 'Help text', th: 'ข้อความช่วยอธิบาย' },
      optionsLabel: { en: 'Options (for Select/Multi-select)', th: 'ตัวเลือก (สำหรับ Select/Multi-select)' },
      addOption: { en: '+ Add Option', th: '+ เพิ่มตัวเลือก' },
      requiredTitle: { en: 'Required field', th: 'บังคับกรอก' },
      requiredDesc: { en: 'Staff must fill this — cannot be empty', th: 'ต้องกรอกฟิลด์นี้ ห้ามเว้นว่าง' },
      activeTitle: { en: 'Active', th: 'เปิดใช้งาน' },
      activeDesc: { en: 'Turn off to hide from form (existing data is kept)', th: 'ปิดถ้าไม่อยากให้แสดงในฟอร์ม (ข้อมูลเก่ายังอยู่)' },
      emptyTitle: { en: 'No custom fields yet', th: 'ยังไม่มีฟิลด์เพิ่มเติม' },
      emptyDesc: { en: 'Click "Add Field" to define extra data your school needs', th: 'กดปุ่ม "เพิ่มฟิลด์" เพื่อกำหนดข้อมูลพิเศษ' },
      confirmDelete: { en: 'Delete field "{label}"?\nData in teachers\' custom_data stays, but won\'t show in UI', th: 'ลบฟิลด์ "{label}"?\nข้อมูลที่เก็บไว้ของครูจะยังอยู่ แต่จะไม่แสดงใน UI' },
      saveOk: { en: 'Saved ✓', th: 'บันทึกสำเร็จ ✓' },
      addOk: { en: 'Field added ✓', th: 'เพิ่มฟิลด์สำเร็จ ✓' },
      deleteOk: { en: 'Deleted', th: 'ลบสำเร็จ' },
      needOption: { en: 'Please add at least 1 option', th: 'กรุณาเพิ่มตัวเลือกอย่างน้อย 1 ตัว' }
    },

    // ---------- Attendance (Sprint 12) ----------
    attendance: {
      title: { en: '📅 Attendance', th: '📅 เช็คชื่อ' },
      subtitle: { en: 'Mark daily attendance and notify parents via LINE', th: 'เช็คชื่อนักเรียนและแจ้งผู้ปกครองผ่าน LINE' },
      myView: { en: '📋 My View', th: '📋 ของฉัน' },
      export: { en: '📤 Export', th: '📤 Export' },
      date: { en: 'Date', th: 'วันที่' },
      classroom: { en: 'Class', th: 'ห้อง' },
      grade: { en: 'Grade', th: 'ระดับชั้น' },
      allClasses: { en: 'All classes', th: 'ทุกห้อง' },
      refresh: { en: '🔄 Refresh', th: '🔄 รีเฟรช' },
      statTotal: { en: 'Total', th: 'ทั้งหมด' },
      statPresent: { en: 'Present', th: 'มาเรียน' },
      statAbsent: { en: 'Absent', th: 'ขาด' },
      statLate: { en: 'Late', th: 'มาสาย' },
      statExcused: { en: 'Excused', th: 'ขาด (ใบลา)' },
      statLeave: { en: 'Leave', th: 'ลา' },
      statSick: { en: 'Sick', th: 'ป่วย' },
      statUnmarked: { en: 'Unmarked', th: 'ยังไม่เช็ค' },
      statusPresent: { en: '✓ Present', th: '✓ มา' },
      statusAbsent: { en: '✗ Absent', th: '✗ ขาด' },
      statusLate: { en: 'Late', th: 'สาย' },
      statusExcused: { en: 'Excused', th: 'ใบลา' },
      statusLeave: { en: 'Leave', th: 'ลา' },
      statusSick: { en: 'Sick', th: 'ป่วย' },
      statusHalfDayAm: { en: 'Half Day AM', th: 'ครึ่งวันเช้า' },
      statusHalfDayPm: { en: 'Half Day PM', th: 'ครึ่งวันบ่าย' },
      markAllPresent: { en: '✓ Mark all Present', th: '✓ เช็คมาทั้งหมด' },
      markAllAbsent: { en: '✗ Mark all Absent', th: '✗ เช็คขาดทั้งหมด' },
      markedAs: { en: 'Marked as', th: 'เช็คเป็น' },
      markedCount: { en: 'Marked {n} students', th: 'เช็คชื่อ {n} คน' },
      markFailed: { en: 'Failed to mark', th: 'เช็คไม่สำเร็จ' },
      confirmMarkAll: { en: 'Mark all students as {status}? This will overwrite existing marks.', th: 'เช็คทั้งหมดเป็น "{status}"? จะทับการเช็คที่มีอยู่' },
      allAlreadySet: { en: 'All students already set', th: 'นักเรียนทุกคนตั้งค่าแล้ว' },
      empty: { en: 'No students found', th: 'ไม่พบนักเรียน' },
      emptyDesc: { en: 'Try different filters or check that students are enrolled', th: 'ลองเปลี่ยน filter หรือเช็คว่ามีนักเรียนในระบบ' },
      loadFailed: { en: 'Load failed', th: 'โหลดไม่สำเร็จ' },
      checkIn: { en: 'Check-in', th: 'เช้คอิน' },
      reason: { en: 'Reason', th: 'เหตุผล' }
    },

    // ---------- Grades (Sprint 13) ----------
    grades: {
      title: { en: '📝 Grades', th: '📝 เกรด' },
      subtitle: { en: 'Enter grades by class + subject + term', th: 'กรอกเกรดตามห้อง + วิชา + เทอม' },
      configScale: { en: '⚙️ Grade Scale', th: '⚙️ ตั้งค่าเกรด' },
      publish: { en: '📢 Publish to Parents', th: '📢 เผยแพร่ให้ผู้ปกครอง' },
      saveAll: { en: '💾 Save All', th: '💾 บันทึกทั้งหมด' },
      year: { en: 'Year', th: 'ปีการศึกษา' },
      term: { en: 'Term', th: 'เทอม' },
      termSummer: { en: 'Summer', th: 'ภาคฤดูร้อน' },
      classroom: { en: 'Class', th: 'ห้อง' },
      selectClass: { en: 'Select class...', th: 'เลือกห้อง...' },
      subject: { en: 'Subject', th: 'วิชา' },
      selectSubject: { en: 'Select subject...', th: 'เลือกวิชา...' },
      load: { en: '🔄 Load', th: '🔄 โหลด' },
      infoBanner: { en: '<strong>💡 Tip:</strong> Enter scores (0-100) — grade letter auto-calculates. Or enter grade letter directly. Click <strong>Save All</strong> to commit. Use <strong>Publish</strong> to make grades visible to parents/students.', th: '<strong>💡 เคล็ดลับ:</strong> กรอกคะแนน (0-100) — เกรดจะคำนวณอัตโนมัติ หรือเลือกเกรดเองได้ กด <strong>บันทึกทั้งหมด</strong> เมื่อเสร็จ และ <strong>เผยแพร่</strong> เพื่อให้ผู้ปกครอง/นักเรียนเห็น' },
      colStuNum: { en: 'Student #', th: 'รหัสนักเรียน' },
      colName: { en: 'Name', th: 'ชื่อ' },
      colMidterm: { en: 'Midterm', th: 'กลางภาค' },
      colFinal: { en: 'Final', th: 'ปลายภาค' },
      colAssign: { en: 'Assignment', th: 'งานมอบหมาย' },
      colTotal: { en: 'Total', th: 'รวม' },
      colGrade: { en: 'Grade', th: 'เกรด' },
      colComments: { en: 'Comments', th: 'หมายเหตุ' },
      colStatus: { en: 'Status', th: 'สถานะ' },
      selectFirst: { en: 'Select class & subject', th: 'เลือกห้องและวิชาก่อน' },
      selectFirstDesc: { en: 'Choose classroom and subject, then click Load', th: 'เลือกห้องและวิชา แล้วกด Load' },
      noStudents: { en: 'No students in this class', th: 'ไม่พบนักเรียนในห้องนี้' },
      noStudentsDesc: { en: 'Check that students are enrolled in this classroom', th: 'ตรวจสอบว่ามีนักเรียนในห้องนี้' },
      statusPublished: { en: 'Published', th: 'เผยแพร่' },
      statusDraft: { en: 'Draft', th: 'ร่าง' },
      fillAllFilters: { en: 'Please fill year, class, and subject', th: 'กรุณาเลือกปี ห้อง และวิชา' },
      loadFailed: { en: 'Load failed', th: 'โหลดไม่สำเร็จ' },
      saveFailed: { en: 'Save failed', th: 'บันทึกไม่สำเร็จ' },
      publishFailed: { en: 'Publish failed', th: 'เผยแพร่ไม่สำเร็จ' },
      noDataToSave: { en: 'No data to save', th: 'ไม่มีข้อมูลให้บันทึก' },
      savedCount: { en: 'Saved {n} grades', th: 'บันทึก {n} รายการ' },
      publishedCount: { en: 'Published {n} grades', th: 'เผยแพร่ {n} รายการ' },
      confirmPublish: { en: 'Publish all grades in this view to parents/students?\nThey will be visible immediately.', th: 'เผยแพร่เกรดในมุมมองนี้ให้ผู้ปกครอง/นักเรียน?\nจะเห็นได้ทันที' }
    },

    // ---------- My Grades ----------
    myGrades: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '📝 My Grades', th: '📝 เกรดของฉัน' },
      subtitle: { en: 'View your grade history and download report card', th: 'ดูประวัติเกรดและดาวน์โหลดใบ รายงานผล' },
      year: { en: 'Academic Year', th: 'ปีการศึกษา' },
      allYears: { en: 'All years', th: 'ทุกปี' },
      term: { en: 'Term', th: 'เทอม' },
      allTerms: { en: 'All terms', th: 'ทุกเทอม' },
      refresh: { en: '🔄 Refresh', th: '🔄 รีเฟรช' },
      downloadPdf: { en: '📄 Download Report Card', th: '📄 ดาวน์โหลดใบ ปพ.' },
      gpaLabel: { en: 'GPA', th: 'GPA' },
      totalCredits: { en: 'Total Credits', th: 'หน่วยกิตรวม' },
      subjects: { en: 'Subjects', th: 'วิชา' },
      colYearTerm: { en: 'Year/Term', th: 'ปี/เทอม' },
      colSubject: { en: 'Subject', th: 'วิชา' },
      colMidterm: { en: 'Midterm', th: 'กลางภาค' },
      colFinal: { en: 'Final', th: 'ปลายภาค' },
      colTotal: { en: 'Total', th: 'รวม' },
      colGrade: { en: 'Grade', th: 'เกรด' },
      colComments: { en: 'Comments', th: 'หมายเหตุ' },
      empty: { en: 'No grades yet', th: 'ยังไม่มีเกรด' },
      emptyDesc: { en: 'Your grades will appear here when teachers publish them', th: 'เกรดจะแสดงเมื่อครูเผยแพร่' },
      loadFailed: { en: 'Could not load grades', th: 'โหลดเกรดไม่ได้' },
      noAccess: { en: 'You do not have access to this data', th: 'คุณไม่มีสิทธิ์เข้าถึง' },
      selectYearTerm: { en: 'Please select year and term to download report card', th: 'กรุณาเลือกปีและเทอมเพื่อดาวน์โหลดใบรายงาน' },
      pdfFailed: { en: 'PDF download failed', th: 'ดาวน์โหลด PDF ไม่ได้' }
    },

    // ---------- Grade Config (Sprint 13.4) ----------
    gradeConfig: {
      back: { en: '← Back to Grades', th: '← กลับไปเกรด' },
      title: { en: '⚙️ Grading Scale Configuration', th: '⚙️ ตั้งค่าระบบเกรด' },
      desc: { en: 'Define how grades are calculated and displayed in your school. Set the default scale used when entering grades.', th: 'กำหนดระบบเกรดที่โรงเรียนใช้ และตั้งเกรดเริ่มต้น' },
      addScale: { en: '➕ Add Scale', th: '➕ เพิ่มระบบเกรด' },
      templates: { en: 'Templates:', th: 'เทมเพลต:' },
      infoBanner: { en: '<strong>💡 Common Thai school scales:</strong><br/>• <strong>A-F Letter</strong>: International / bilingual schools (A=80-100, B+=75-79, etc.)<br/>• <strong>4.0 GPA</strong>: Thai standard (เกรด 4, 3.5, 3, 2.5, 2, 1.5, 1, 0)<br/>• <strong>Pass/Fail</strong>: Kindergarten / elective subjects<br/>Use templates below to start quickly.', th: '<strong>💡 ระบบเกรดที่นิยมในไทย:</strong><br/>• <strong>A-F</strong>: โรงเรียนนานาชาติ/สองภาษา (A=80-100, B+=75-79)<br/>• <strong>4.0 GPA</strong>: มาตรฐานไทย (เกรด 4, 3.5, 3, 2.5, 2, 1.5, 1, 0)<br/>• <strong>Pass/Fail</strong>: อนุบาล / วิชาเสริม<br/>เลือกเทมเพลตด้านล่างเพื่อเริ่มเร็ว' },
      empty: { en: 'No grading scales yet', th: 'ยังไม่มีระบบเกรด' },
      emptyDesc: { en: 'Use templates above or click "Add Scale" to start', th: 'ใช้เทมเพลตด้านบน หรือกด "เพิ่มระบบเกรด"' },
      gradeCount: { en: 'grades', th: 'เกรด' },
      modalAdd: { en: '➕ Add Grading Scale', th: '➕ เพิ่มระบบเกรด' },
      modalEdit: { en: '✏️ Edit Grading Scale', th: '✏️ แก้ไขระบบเกรด' },
      fldName: { en: 'Scale Name', th: 'ชื่อระบบ' },
      fldType: { en: 'Scale Type', th: 'ประเภท' },
      fldGrades: { en: 'Grade Levels', th: 'ระดับเกรด' },
      fldDefault: { en: 'Set as default scale (used when entering grades)', th: 'ตั้งเป็นค่าเริ่มต้น (ใช้เวลากรอกเกรด)' },
      fldActive: { en: 'Active', th: 'เปิดใช้งาน' },
      typeLetter: { en: 'Letter (A, B+, C, ...)', th: 'ตัวอักษร (A, B+, C, ...)' },
      typeGpa: { en: 'GPA (4.0, 3.5, ...)', th: 'GPA (4.0, 3.5, ...)' },
      typePercent: { en: 'Percent (0-100)', th: 'เปอร์เซ็นต์ (0-100)' },
      typePassFail: { en: 'Pass / Fail', th: 'ผ่าน / ไม่ผ่าน' },
      typeCustom: { en: 'Custom', th: 'กำหนดเอง' },
      addGrade: { en: '+ Add Grade Level', th: '+ เพิ่มระดับเกรด' },
      saveOk: { en: 'Saved ✓', th: 'บันทึกสำเร็จ ✓' },
      addOk: { en: 'Scale added ✓', th: 'เพิ่มระบบเกรดสำเร็จ ✓' },
      deleteOk: { en: 'Deleted', th: 'ลบสำเร็จ' },
      confirmDelete: { en: 'Delete grading scale "{name}"?\nExisting grades using this scale will keep their labels.', th: 'ลบระบบเกรด "{name}"?\nเกรดที่ใช้ระบบนี้จะยังอยู่ แต่ไม่ผูกกับระบบใหม่' }
    },

    // ---------- My Attendance ----------
    myAtt: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '📋 My Attendance History', th: '📋 ประวัติการเข้าเรียนของฉัน' },
      subtitle: { en: 'View your attendance records', th: 'ดูประวัติการเข้าเรียน' },
      from: { en: 'From', th: 'ตั้งแต่' },
      to: { en: 'To', th: 'ถึง' },
      refresh: { en: '🔄 Refresh', th: '🔄 รีเฟรช' },
      empty: { en: 'No records found', th: 'ไม่มีข้อมูล' },
      emptyDesc: { en: 'No attendance records in this date range', th: 'ไม่มีประวัติการเช็คชื่อในช่วงเวลานี้' },
      loadFailed: { en: 'Could not load data', th: 'โหลดข้อมูลไม่ได้' },
      noAccess: { en: 'You do not have access to this data', th: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }
    },

    // ---------- Subjects (Sprint 11.6) ----------
    subjects: {
      back: { en: '← Back to Teachers', th: '← กลับไปครู' },
      title: { en: '📚 Subjects', th: '📚 วิชาเรียน' },
      desc: { en: 'Define subjects taught at your school — used in teacher assignments, grade reports, and timetables.', th: 'กำหนดวิชาที่สอนในโรงเรียน — ใช้สำหรับมอบหมายครู รายงานผล และตารางเรียน' },
      addSubject: { en: '➕ Add Subject', th: '➕ เพิ่มวิชา' },
      colCode: { en: 'Code', th: 'รหัส' },
      colName: { en: 'Name', th: 'ชื่อวิชา' },
      colDept: { en: 'Department', th: 'กลุ่มสาระ' },
      colCredit: { en: 'Credits', th: 'หน่วยกิต' },
      colStatus: { en: 'Status', th: 'สถานะ' },
      colActions: { en: 'Actions', th: 'ดำเนินการ' },
      modalAdd: { en: '➕ Add Subject', th: '➕ เพิ่มวิชา' },
      modalEdit: { en: '✏️ Edit Subject', th: '✏️ แก้ไขวิชา' },
      fldCode: { en: 'Code', th: 'รหัสวิชา' },
      fldNameTh: { en: 'Name (Thai)', th: 'ชื่อวิชา (ไทย)' },
      fldNameEn: { en: 'Name (English)', th: 'ชื่อวิชา (อังกฤษ)' },
      fldDept: { en: 'Department', th: 'กลุ่มสาระ' },
      fldCreditHours: { en: 'Credit Hours', th: 'หน่วยกิต' },
      fldDesc: { en: 'Description', th: 'คำอธิบาย' },
      fldSort: { en: 'Sort Order', th: 'ลำดับ' },
      fldActive: { en: 'Active (show in teacher assignments)', th: 'เปิดใช้งาน (แสดงในการมอบหมายครู)' },
      empty: { en: 'No subjects yet', th: 'ยังไม่มีวิชา' },
      emptyDesc: { en: 'Click "Add Subject" to define subjects taught at your school', th: 'กดปุ่ม "เพิ่มวิชา" เพื่อกำหนดวิชาที่สอนในโรงเรียน' },
      saveOk: { en: 'Saved ✓', th: 'บันทึกสำเร็จ ✓' },
      addOk: { en: 'Subject added ✓', th: 'เพิ่มวิชาสำเร็จ ✓' },
      deleteOk: { en: 'Deleted', th: 'ลบสำเร็จ' },
      confirmDelete: { en: 'Delete subject "{name}"?', th: 'ลบวิชา "{name}"?' }
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
