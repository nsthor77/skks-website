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
      schedule:    { en: 'Schedule', th: 'ตารางเรียน' },
      mySchedule:  { en: 'My Schedule', th: 'ตารางเรียนของฉัน' },
      teacherSchedule: { en: 'Teacher Schedule', th: 'ตารางสอน' },
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

    // ---------- Schedule (Sprint 14) — Class Timetable ----------
    schedule: {
      title: { en: '🗓️ Class Schedule', th: '🗓️ ตารางเรียน' },
      subtitle: { en: 'Build weekly timetables per class. Click a cell to assign a subject + teacher.', th: 'สร้างตารางเรียนรายห้อง — คลิกช่องเพื่อใส่วิชา + ครู' },
      class: { en: 'Class', th: 'ห้องเรียน' },
      selectClass: { en: 'Select class...', th: 'เลือกห้อง...' },
      load: { en: '🔄 Load', th: '🔄 โหลด' },
      fillFilters: { en: 'Please select year + class first', th: 'กรุณาเลือกปี + ห้องเรียนก่อน' },
      managePeriods: { en: '⏰ Manage Periods', th: '⏰ ตั้งคาบเรียน' },
      setupTitle: { en: 'First time? Set up your school’s class periods', th: 'ใช้ครั้งแรก? ตั้งคาบเรียนก่อน' },
      setupDesc: { en: 'Define the time slots used in your school day (e.g. Period 1 = 08:30-09:20).', th: 'กำหนดเวลาคาบเรียนของโรงเรียน (เช่น คาบ 1 = 08:30-09:20)' },
      seedDefault: { en: '⚡ Use Default Template (8 periods)', th: '⚡ ใช้เทมเพลตเริ่มต้น (8 คาบ)' },
      customPeriods: { en: '✏️ Custom Setup', th: '✏️ ตั้งเอง' },
      period: { en: 'Period', th: 'คาบ' },
      periodLabel: { en: 'Label (e.g. Period 1)', th: 'ชื่อ (เช่น คาบ 1)' },
      break: { en: 'Break', th: 'พัก' },
      morningBreak: { en: 'Morning Break', th: 'พักเช้า' },
      lunchBreak: { en: 'Lunch Break', th: 'พักกลางวัน' },
      addPeriod: { en: '➕ Add Period', th: '➕ เพิ่มคาบ' },
      periodsTitle: { en: '⏰ Class Periods Configuration', th: '⏰ ตั้งค่าคาบเรียน' },
      periodsDesc: { en: 'Define each period’s time. Mark recess/lunch as "Break" — they won’t be assignable.', th: 'กำหนดเวลาคาบ ทำเครื่องหมาย "พัก" สำหรับช่วงพัก (จะใส่วิชาไม่ได้)' },
      periodsSaved: { en: '{n} periods saved', th: 'บันทึก {n} คาบ' },
      defaultSeeded: { en: '✅ Default periods created', th: '✅ สร้างคาบเริ่มต้นแล้ว' },
      editSlot: { en: 'Edit Schedule Slot', th: 'แก้ไขช่องตาราง' },
      subject: { en: 'Subject', th: 'วิชา' },
      noSubject: { en: 'No subject', th: 'ไม่มีวิชา' },
      teacher: { en: 'Teacher', th: 'ครูผู้สอน' },
      teachers: { en: 'Teachers (co-teaching supported)', th: 'ครูผู้สอน (รองรับสอนคู่)' },
      noTeacher: { en: 'No teacher assigned', th: 'ยังไม่กำหนด' },
      selectTeacherDots: { en: 'Select teacher', th: 'เลือกครู' },
      addTeacher: { en: '➕ Add', th: '➕ เพิ่ม' },
      noTeachersYet: { en: 'No teachers added yet', th: 'ยังไม่ได้เพิ่มครู' },
      teacherAlready: { en: 'This teacher is already added', th: 'ครูคนนี้ถูกเพิ่มแล้ว' },
      roleLead: { en: 'Lead', th: 'ครูหลัก' },
      roleThai: { en: 'Thai Teacher', th: 'ครูไทย' },
      roleForeign: { en: 'Foreign Teacher', th: 'ครูต่างชาติ' },
      roleAssistant: { en: 'Assistant', th: 'ครูผู้ช่วย' },
      roleCo: { en: 'Co-teacher', th: 'ครูร่วมสอน' },
      students: { en: 'students', th: 'นักเรียน' },
      room: { en: 'Room', th: 'ห้อง' },
      notes: { en: 'Notes', th: 'หมายเหตุ' },
      add: { en: 'Add', th: 'เพิ่ม' },
      conflictHeader: { en: 'Conflict detected:', th: 'พบข้อขัดแย้ง:' },
      teacherBusy: { en: 'teacher double-booked', th: 'ครูซ้อนคาบ' },
      roomBusy: { en: 'room double-booked', th: 'ห้องซ้อนคาบ' },
      confirmConflict: { en: 'Conflicts exist. Save anyway?', th: 'มีข้อขัดแย้ง บันทึกต่อ?' },
      hasConflict: { en: 'Conflict exists — please resolve or confirm override', th: 'มีข้อขัดแย้ง — แก้ไขหรือยืนยันการบันทึกทับ' },
      confirmDelete: { en: 'Delete this slot?', th: 'ลบช่องนี้?' },
      pdfFailed: { en: 'PDF download failed', th: 'ดาวน์โหลด PDF ไม่ได้' },
      day_mon: { en: 'Mon', th: 'จันทร์' },
      day_tue: { en: 'Tue', th: 'อังคาร' },
      day_wed: { en: 'Wed', th: 'พุธ' },
      day_thu: { en: 'Thu', th: 'พฤหัสบดี' },
      day_fri: { en: 'Fri', th: 'ศุกร์' },
      day_sat: { en: 'Sat', th: 'เสาร์' },
      day_sun: { en: 'Sun', th: 'อาทิตย์' }
    },

    // ---------- My Schedule (Sprint 14.3) ----------
    mySchedule: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '🗓️ My Schedule', th: '🗓️ ตารางเรียนของฉัน' },
      subtitle: { en: 'Your weekly class timetable', th: 'ตารางเรียนประจำสัปดาห์' },
      downloadPdf: { en: '📄 Download PDF', th: '📄 ดาวน์โหลด PDF' },
      emptyTitle: { en: 'No schedule yet', th: 'ยังไม่มีตารางเรียน' },
      emptyDesc: { en: 'Your class timetable will appear here once your school sets it up.', th: 'ตารางเรียนจะปรากฏเมื่อโรงเรียนกำหนดเรียบร้อย' },
      nowLabel: { en: 'NOW', th: 'กำลังเรียน' },
      nextLabel: { en: 'NEXT CLASS', th: 'คาบถัดไป' }
    },

    // ---------- Teacher Schedule (Sprint 14.4) ----------
    teacherSchedule: {
      title: { en: '👨‍🏫 Teacher Schedule', th: '👨‍🏫 ตารางสอนครู' },
      subtitle: { en: "View a teacher's weekly classes — useful for planning + loading checks", th: 'ดูตารางสอนรายครู — ใช้วางแผน + ตรวจภาระงาน' },
      teacher: { en: 'Teacher', th: 'ครู' },
      selectTeacher: { en: 'Select teacher...', th: 'เลือกครู...' },
      totalPeriods: { en: 'Total Periods', th: 'คาบรวม' },
      distinctClasses: { en: 'Classes Taught', th: 'จำนวนห้อง' },
      distinctSubjects: { en: 'Subjects', th: 'จำนวนวิชา' }
    },

    // ---------- Leave Requests (Sprint 17) ----------
    leave: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '📝 Leave Requests', th: '📝 การขอลา' },
      subtitle: { en: 'Request and review student leave', th: 'ขอลาและอนุมัติการลาของนักเรียน' },
      new: { en: '➕ Request Leave', th: '➕ ขอลา' },
      newTitle: { en: '➕ Request Leave', th: '➕ ขอลา' },
      filterStatus: { en: 'Status:', th: 'สถานะ:' },
      all: { en: 'All', th: 'ทั้งหมด' },
      pending: { en: 'Pending', th: 'รออนุมัติ' },
      approved: { en: 'Approved', th: 'อนุมัติแล้ว' },
      rejected: { en: 'Rejected', th: 'ไม่อนุมัติ' },
      student: { en: 'Student', th: 'นักเรียน' },
      type: { en: 'Leave type', th: 'ประเภทการลา' },
      typeSick: { en: 'Sick', th: 'ลาป่วย' },
      typePersonal: { en: 'Personal', th: 'ลากิจ' },
      typeActivity: { en: 'Activity', th: 'ลาทำกิจกรรม' },
      typeOther: { en: 'Other', th: 'อื่นๆ' },
      from: { en: 'From', th: 'ตั้งแต่' },
      to: { en: 'To', th: 'ถึง' },
      reason: { en: 'Reason', th: 'เหตุผล' },
      send: { en: '📤 Submit', th: '📤 ส่งคำขอ' },
      approve: { en: '✓ Approve', th: '✓ อนุมัติ' },
      reject: { en: '✕ Reject', th: '✕ ไม่อนุมัติ' },
      empty: { en: 'No leave requests', th: 'ยังไม่มีคำขอลา' },
      emptyDesc: { en: 'Submitted leave requests will appear here', th: 'คำขอลาจะปรากฏที่นี่' },
      submitted: { en: '✅ Leave request submitted', th: '✅ ส่งคำขอลาแล้ว' },
      rejectReason: { en: 'Reason for rejection:', th: 'เหตุผลที่ไม่อนุมัติ:' },
      approvedMsg: { en: '✅ Approved — marked {n} attendance days as leave', th: '✅ อนุมัติแล้ว — บันทึกการลา {n} วัน' },
      rejectedMsg: { en: 'Request rejected', th: 'ไม่อนุมัติคำขอแล้ว' },
      noStudent: { en: 'No student selected', th: 'ยังไม่ได้เลือกนักเรียน' },
      pickDates: { en: 'Please select dates', th: 'กรุณาเลือกวันที่' },
      no_access: { en: 'No access to this student', th: 'ไม่มีสิทธิ์สำหรับนักเรียนคนนี้' },
      invalid_dates: { en: 'Invalid dates', th: 'วันที่ไม่ถูกต้อง' }
    },

    // ---------- Homework / Assignments (Sprint 18) ----------
    homework: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '📚 Homework', th: '📚 การบ้าน' },
      subtitle: { en: 'Assign homework and track submissions', th: 'มอบหมายการบ้านและติดตามการส่งงาน' },
      new: { en: '➕ New Homework', th: '➕ มอบหมายการบ้าน' },
      newTitle: { en: '➕ New Homework', th: '➕ มอบหมายการบ้าน' },
      editTitle: { en: '✏️ Edit Homework', th: '✏️ แก้ไขการบ้าน' },
      filterClass: { en: 'Class:', th: 'ห้อง:' },
      allClasses: { en: 'All classes', th: 'ทุกห้อง' },
      filterStatus: { en: 'Status:', th: 'สถานะ:' },
      all: { en: 'All', th: 'ทั้งหมด' },
      open: { en: 'Open', th: 'เปิดรับ' },
      closed: { en: 'Closed', th: 'ปิดรับ' },
      mineOnly: { en: 'Mine only', th: 'ของฉันเท่านั้น' },
      allSchool: { en: 'Whole school', th: 'ทั้งโรงเรียน' },
      fTitle: { en: 'Title', th: 'หัวข้อ' },
      fDesc: { en: 'Details', th: 'รายละเอียด' },
      fSubject: { en: 'Subject', th: 'วิชา' },
      fClass: { en: 'Target class', th: 'ห้องที่มอบหมาย' },
      fDue: { en: 'Due date', th: 'กำหนดส่ง' },
      fPoints: { en: 'Max score (optional)', th: 'คะแนนเต็ม (ถ้ามี)' },
      fStatus: { en: 'Status', th: 'สถานะ' },
      save: { en: '💾 Save', th: '💾 บันทึก' },
      student: { en: 'Student', th: 'นักเรียน' },
      submissions: { en: 'Submissions', th: 'งานที่ส่ง' },
      submitTitle: { en: '✓ Submit / Mark done', th: '✓ ส่งงาน / ทำเสร็จแล้ว' },
      sNote: { en: 'Note / answer link (optional)', th: 'หมายเหตุ / ลิงก์คำตอบ (ถ้ามี)' },
      markDone: { en: '✓ Submit', th: '✓ ส่งงาน' },
      submitted: { en: 'Submitted', th: 'ส่งแล้ว' },
      done: { en: 'Graded', th: 'ตรวจแล้ว' },
      subsTitle: { en: '📥 Submissions', th: '📥 งานที่ส่ง' },
      noSubs: { en: 'No submissions yet', th: 'ยังไม่มีงานส่ง' },
      score: { en: 'Score', th: 'คะแนน' },
      feedback: { en: 'Feedback', th: 'คำติชม' },
      grade: { en: '✓ Grade', th: '✓ ให้คะแนน' },
      graded: { en: '✅ Graded', th: '✅ ให้คะแนนแล้ว' },
      empty: { en: 'No homework yet', th: 'ยังไม่มีการบ้าน' },
      emptyDesc: { en: 'Assigned homework will appear here', th: 'การบ้านที่มอบหมายจะปรากฏที่นี่' },
      created: { en: '✅ Homework assigned', th: '✅ มอบหมายการบ้านแล้ว' },
      saved: { en: '✅ Saved', th: '✅ บันทึกแล้ว' },
      deleted: { en: 'Homework deleted', th: 'ลบการบ้านแล้ว' },
      submittedMsg: { en: '✅ Submitted', th: '✅ ส่งงานแล้ว' },
      confirmDelete: { en: 'Delete this homework? This cannot be undone.', th: 'ลบการบ้านนี้? ไม่สามารถกู้คืนได้' },
      needTitle: { en: 'Please enter a title', th: 'กรุณากรอกหัวข้อ' },
      noStudent: { en: 'No student selected', th: 'ยังไม่ได้เลือกนักเรียน' },
      no_title: { en: 'Please enter a title', th: 'กรุณากรอกหัวข้อ' },
      no_access: { en: 'No access to this student', th: 'ไม่มีสิทธิ์สำหรับนักเรียนคนนี้' },
      forbidden: { en: 'Staff only', th: 'เฉพาะเจ้าหน้าที่' },
      not_found: { en: 'Not found', th: 'ไม่พบข้อมูล' }
    },

    // ---------- Behavior / Conduct Points (Sprint 19) ----------
    behavior: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '⭐ Behavior Points', th: '⭐ คะแนนพฤติกรรม' },
      subtitle: { en: 'Record conduct points and view history', th: 'บันทึกคะแนนความประพฤติและดูประวัติ' },
      student: { en: 'Student', th: 'นักเรียน' },
      baseNote: { en: 'Starts at 100', th: 'เริ่มต้น 100 คะแนน' },
      records: { en: 'records', th: 'รายการ' },
      type: { en: 'Type', th: 'ประเภท' },
      deduct: { en: '− Deduct', th: '− หักคะแนน' },
      add: { en: '+ Add', th: '+ เพิ่มคะแนน' },
      points: { en: 'Points', th: 'คะแนน' },
      reason: { en: 'Reason', th: 'เหตุผล' },
      save: { en: '💾 Record', th: '💾 บันทึก' },
      history: { en: 'History', th: 'ประวัติ' },
      empty: { en: 'No records yet', th: 'ยังไม่มีรายการ' },
      recorded: { en: '✅ Recorded', th: '✅ บันทึกแล้ว' },
      deleted: { en: 'Record deleted', th: 'ลบรายการแล้ว' },
      confirmDelete: { en: 'Delete this record?', th: 'ลบรายการนี้?' },
      noStudent: { en: 'No student selected', th: 'ยังไม่ได้เลือกนักเรียน' },
      noPoints: { en: 'Please enter points', th: 'กรุณากรอกคะแนน' },
      no_points: { en: 'Please enter points', th: 'กรุณากรอกคะแนน' },
      no_student: { en: 'No student selected', th: 'ยังไม่ได้เลือกนักเรียน' },
      forbidden: { en: 'Staff only', th: 'เฉพาะเจ้าหน้าที่' }
    },

    // ---------- Learning Materials (Sprint 20) ----------
    materials: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '📂 Learning Materials', th: '📂 สื่อการสอน' },
      subtitle: { en: 'Lesson files and links for students', th: 'ไฟล์/ลิงก์บทเรียนสำหรับนักเรียน' },
      new: { en: '➕ New Material', th: '➕ เพิ่มสื่อ' },
      newTitle: { en: '➕ New Material', th: '➕ เพิ่มสื่อการสอน' },
      editTitle: { en: '✏️ Edit Material', th: '✏️ แก้ไขสื่อ' },
      filterClass: { en: 'Class:', th: 'ห้อง:' },
      allClasses: { en: 'All classes', th: 'ทุกห้อง' },
      mineOnly: { en: 'Mine only', th: 'ของฉันเท่านั้น' },
      allSchool: { en: 'Whole school', th: 'ทั้งโรงเรียน' },
      fTitle: { en: 'Title', th: 'ชื่อสื่อ' },
      fType: { en: 'Type', th: 'ประเภท' },
      fClass: { en: 'Target class', th: 'ห้องที่ให้' },
      fUrl: { en: 'Link (URL)', th: 'ลิงก์ (URL)' },
      fSubject: { en: 'Subject', th: 'วิชา' },
      fDesc: { en: 'Description', th: 'รายละเอียด' },
      save: { en: '💾 Save', th: '💾 บันทึก' },
      tLink: { en: 'Link', th: 'ลิงก์' },
      tDocument: { en: 'Document', th: 'เอกสาร' },
      tVideo: { en: 'Video', th: 'วิดีโอ' },
      tFile: { en: 'File', th: 'ไฟล์' },
      tOther: { en: 'Other', th: 'อื่นๆ' },
      open: { en: '🔗 Open', th: '🔗 เปิด' },
      empty: { en: 'No materials yet', th: 'ยังไม่มีสื่อการสอน' },
      emptyDesc: { en: 'Shared lesson materials will appear here', th: 'สื่อที่แชร์จะปรากฏที่นี่' },
      created: { en: '✅ Material added', th: '✅ เพิ่มสื่อแล้ว' },
      saved: { en: '✅ Saved', th: '✅ บันทึกแล้ว' },
      deleted: { en: 'Material deleted', th: 'ลบสื่อแล้ว' },
      confirmDelete: { en: 'Delete this material?', th: 'ลบสื่อนี้?' },
      needTitle: { en: 'Please enter a title', th: 'กรุณากรอกชื่อสื่อ' },
      no_title: { en: 'Please enter a title', th: 'กรุณากรอกชื่อสื่อ' },
      forbidden: { en: 'Staff only', th: 'เฉพาะเจ้าหน้าที่' },
      not_found: { en: 'Not found', th: 'ไม่พบข้อมูล' }
    },

    // ---------- Online Quiz (Sprint 21) ----------
    quiz: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      backList: { en: '← Back to list', th: '← กลับไปรายการ' },
      title: { en: '📝 Quizzes', th: '📝 ข้อสอบออนไลน์' },
      subtitle: { en: 'Online tests, auto-graded', th: 'ข้อสอบออนไลน์ ตรวจอัตโนมัติ' },
      new: { en: '➕ New Quiz', th: '➕ สร้างข้อสอบ' },
      fTitle: { en: 'Quiz title', th: 'ชื่อข้อสอบ' },
      fSubject: { en: 'Subject', th: 'วิชา' },
      fClass: { en: 'Class', th: 'ห้อง' },
      allSchool: { en: 'Whole school', th: 'ทั้งโรงเรียน' },
      fTime: { en: 'Time limit (min)', th: 'จำกัดเวลา (นาที)' },
      fDue: { en: 'Due date', th: 'กำหนดส่ง' },
      fStatus: { en: 'Status', th: 'สถานะ' },
      draft: { en: 'Draft', th: 'ร่าง' },
      open: { en: 'Open', th: 'เปิดสอบ' },
      closed: { en: 'Closed', th: 'ปิดแล้ว' },
      questions: { en: 'Questions', th: 'คำถาม' },
      addQ: { en: '➕ Add question', th: '➕ เพิ่มคำถาม' },
      removeQ: { en: 'Remove', th: 'ลบ' },
      save: { en: '💾 Save quiz', th: '💾 บันทึกข้อสอบ' },
      items: { en: 'questions', th: 'ข้อ' },
      min: { en: 'min', th: 'นาที' },
      done: { en: 'submitted', th: 'ส่งแล้ว' },
      results: { en: 'Results', th: 'ผลสอบ' },
      take: { en: '▶ Take', th: '▶ ทำข้อสอบ' },
      empty: { en: 'No quizzes yet', th: 'ยังไม่มีข้อสอบ' },
      qNo: { en: 'Question', th: 'คำถามข้อ' },
      qText: { en: 'Question text', th: 'โจทย์คำถาม' },
      qType: { en: 'Type', th: 'ชนิด' },
      tMc: { en: 'Choice', th: 'ตัวเลือก' },
      tTf: { en: 'True/False', th: 'ถูก/ผิด' },
      tShort: { en: 'Short', th: 'เติมคำ' },
      points: { en: 'Points', th: 'คะแนน' },
      correct: { en: 'Correct answer', th: 'คำตอบที่ถูก' },
      option: { en: 'Option', th: 'ตัวเลือก' },
      'true': { en: 'True', th: 'ถูก' },
      'false': { en: 'False', th: 'ผิด' },
      answer: { en: 'Answer', th: 'คำตอบ' },
      needTitle: { en: 'Please enter a quiz title', th: 'กรุณากรอกชื่อข้อสอบ' },
      saved: { en: '✅ Quiz saved', th: '✅ บันทึกข้อสอบแล้ว' },
      deleted: { en: 'Quiz deleted', th: 'ลบข้อสอบแล้ว' },
      confirmDelete: { en: 'Delete this quiz? Attempts are removed too.', th: 'ลบข้อสอบนี้? ผลสอบจะถูกลบด้วย' },
      noAttempts: { en: 'No one has taken this yet', th: 'ยังไม่มีคนทำ' },
      noStudent: { en: 'No student found', th: 'ไม่พบนักเรียน' },
      alreadyDone: { en: 'You already submitted this quiz', th: 'คุณส่งข้อสอบนี้แล้ว' },
      submit: { en: '📤 Submit', th: '📤 ส่งคำตอบ' },
      submitted: { en: 'Submitted! Auto-graded.', th: 'ส่งแล้ว! ตรวจอัตโนมัติ' },
      not_open: { en: 'Quiz is not open', th: 'ข้อสอบยังไม่เปิด' },
      no_access: { en: 'No access', th: 'ไม่มีสิทธิ์' },
      no_title: { en: 'Please enter a quiz title', th: 'กรุณากรอกชื่อข้อสอบ' },
      not_found: { en: 'Not found', th: 'ไม่พบข้อมูล' },
      forbidden: { en: 'Staff only', th: 'เฉพาะเจ้าหน้าที่' }
    },

    // ---------- Library (Sprint 22) ----------
    library: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '📚 Library', th: '📚 ห้องสมุด' },
      subtitle: { en: 'Catalog and borrow / return', th: 'แค็ตตาล็อกหนังสือ + ยืม-คืน' },
      addBook: { en: '➕ Add Book', th: '➕ เพิ่มหนังสือ' },
      editBook: { en: '✏️ Edit Book', th: '✏️ แก้ไขหนังสือ' },
      catalog: { en: 'Catalog', th: 'รายการหนังสือ' },
      loans: { en: 'Loans', th: 'การยืม-คืน' },
      searchPh: { en: 'Search title / author / ISBN', th: 'ค้นหา ชื่อ / ผู้แต่ง / ISBN' },
      status: { en: 'Status:', th: 'สถานะ:' },
      all: { en: 'All', th: 'ทั้งหมด' },
      borrowed: { en: 'Borrowed', th: 'ยืมอยู่' },
      returned: { en: 'Returned', th: 'คืนแล้ว' },
      overdue: { en: 'Overdue', th: 'เกินกำหนด' },
      fTitle: { en: 'Title', th: 'ชื่อหนังสือ' },
      fAuthor: { en: 'Author', th: 'ผู้แต่ง' },
      fCategory: { en: 'Category', th: 'หมวด' },
      fIsbn: { en: 'ISBN', th: 'ISBN' },
      fLocation: { en: 'Shelf', th: 'ชั้น/ตู้' },
      fCopies: { en: 'Total copies', th: 'จำนวนเล่ม' },
      save: { en: '💾 Save', th: '💾 บันทึก' },
      borrowTitle: { en: '📖 Issue Loan', th: '📖 ให้ยืม' },
      student: { en: 'Student', th: 'นักเรียน' },
      due: { en: 'Due date', th: 'กำหนดคืน' },
      dueShort: { en: 'due', th: 'คืน' },
      issue: { en: '📖 Issue', th: '📖 ให้ยืม' },
      avail: { en: 'Available', th: 'เหลือ' },
      borrow: { en: 'Borrow', th: 'ให้ยืม' },
      return: { en: '✓ Return', th: '✓ รับคืน' },
      empty: { en: 'No books yet', th: 'ยังไม่มีหนังสือ' },
      noLoans: { en: 'No loans', th: 'ยังไม่มีการยืม' },
      needTitle: { en: 'Please enter a title', th: 'กรุณากรอกชื่อหนังสือ' },
      saved: { en: '✅ Saved', th: '✅ บันทึกแล้ว' },
      deleted: { en: 'Book deleted', th: 'ลบหนังสือแล้ว' },
      confirmDelete: { en: 'Delete this book?', th: 'ลบหนังสือนี้?' },
      noStudent: { en: 'No student selected', th: 'ยังไม่ได้เลือกนักเรียน' },
      issued: { en: '✅ Loan issued', th: '✅ ให้ยืมแล้ว' },
      returnedMsg: { en: '✅ Returned', th: '✅ รับคืนแล้ว' },
      none_available: { en: 'No copies available', th: 'หนังสือหมด' },
      already_returned: { en: 'Already returned', th: 'คืนไปแล้ว' },
      no_title: { en: 'Please enter a title', th: 'กรุณากรอกชื่อหนังสือ' },
      not_found: { en: 'Not found', th: 'ไม่พบข้อมูล' },
      forbidden: { en: 'Staff only', th: 'เฉพาะเจ้าหน้าที่' }
    },

    // ---------- Health / Infirmary (Sprint 23) ----------
    health: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '🏥 Health Records', th: '🏥 ห้องพยาบาล' },
      subtitle: { en: 'Health profile and infirmary visits', th: 'ข้อมูลสุขภาพและการเข้าห้องพยาบาล' },
      student: { en: 'Student', th: 'นักเรียน' },
      profile: { en: 'Health Profile', th: 'ข้อมูลสุขภาพ' },
      edit: { en: '✏️ Edit', th: '✏️ แก้ไข' },
      editProfile: { en: '✏️ Health Profile', th: '✏️ ข้อมูลสุขภาพ' },
      visits: { en: 'Infirmary Visits', th: 'ประวัติเข้าห้องพยาบาล' },
      addVisit: { en: '➕ New Visit', th: '➕ บันทึกการเข้า' },
      newVisit: { en: '➕ Infirmary Visit', th: '➕ บันทึกการเข้าห้องพยาบาล' },
      blood: { en: 'Blood type', th: 'กรุ๊ปเลือด' },
      height: { en: 'Height (cm)', th: 'ส่วนสูง (ซม.)' },
      weight: { en: 'Weight (kg)', th: 'น้ำหนัก (กก.)' },
      allergies: { en: 'Allergies', th: 'อาการแพ้' },
      chronic: { en: 'Chronic conditions', th: 'โรคประจำตัว' },
      meds: { en: 'Regular medications', th: 'ยาประจำ' },
      ecName: { en: 'Emergency contact', th: 'ผู้ติดต่อฉุกเฉิน' },
      ecPhone: { en: 'Phone', th: 'เบอร์โทร' },
      emergency: { en: 'Emergency contact', th: 'ผู้ติดต่อฉุกเฉิน' },
      date: { en: 'Date', th: 'วันที่' },
      symptoms: { en: 'Symptoms', th: 'อาการ' },
      treatment: { en: 'Treatment', th: 'การรักษา' },
      medicine: { en: 'Medicine given', th: 'ยาที่ให้' },
      sentHome: { en: 'Sent home', th: 'ส่งกลับบ้าน' },
      save: { en: '💾 Save', th: '💾 บันทึก' },
      noStudent: { en: 'No student selected', th: 'ยังไม่ได้เลือกนักเรียน' },
      noVisits: { en: 'No visits recorded', th: 'ยังไม่มีประวัติ' },
      saved: { en: '✅ Saved', th: '✅ บันทึกแล้ว' },
      recorded: { en: '✅ Visit recorded', th: '✅ บันทึกแล้ว' },
      deleted: { en: 'Record deleted', th: 'ลบรายการแล้ว' },
      confirmDelete: { en: 'Delete this visit?', th: 'ลบรายการนี้?' },
      no_student: { en: 'No student selected', th: 'ยังไม่ได้เลือกนักเรียน' },
      no_access: { en: 'No access', th: 'ไม่มีสิทธิ์' },
      forbidden: { en: 'Staff only', th: 'เฉพาะเจ้าหน้าที่' },
      not_found: { en: 'Not found', th: 'ไม่พบข้อมูล' }
    },

    // ---------- Exam Schedule (Sprint 24) ----------
    exam: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '🗒️ Exam Schedule', th: '🗒️ ตารางสอบ' },
      subtitle: { en: 'Exam timetable and seating', th: 'ตารางสอบและผังที่นั่ง' },
      new: { en: '➕ New Exam', th: '➕ เพิ่มตารางสอบ' },
      edit: { en: '✏️ Edit Exam', th: '✏️ แก้ไขตารางสอบ' },
      class: { en: 'Class:', th: 'ห้อง:' },
      allClasses: { en: 'All classes', th: 'ทุกห้อง' },
      allSchool: { en: 'Whole school', th: 'ทั้งโรงเรียน' },
      fTitle: { en: 'Exam name', th: 'ชื่อการสอบ' },
      fSubject: { en: 'Subject', th: 'วิชา' },
      fClass: { en: 'Class', th: 'ห้อง' },
      fDate: { en: 'Date', th: 'วันที่' },
      fRoom: { en: 'Room', th: 'ห้องสอบ' },
      fStart: { en: 'Start', th: 'เริ่ม' },
      fEnd: { en: 'End', th: 'สิ้นสุด' },
      save: { en: '💾 Save', th: '💾 บันทึก' },
      seating: { en: 'Seating', th: 'ผังที่นั่ง' },
      seats: { en: 'seats', th: 'ที่นั่ง' },
      noStudents: { en: 'No students in this class', th: 'ไม่มีนักเรียนในห้องนี้' },
      empty: { en: 'No exams scheduled', th: 'ยังไม่มีตารางสอบ' },
      needTitle: { en: 'Please enter exam name', th: 'กรุณากรอกชื่อการสอบ' },
      saved: { en: '✅ Saved', th: '✅ บันทึกแล้ว' },
      deleted: { en: 'Exam deleted', th: 'ลบแล้ว' },
      confirmDelete: { en: 'Delete this exam?', th: 'ลบตารางสอบนี้?' },
      no_title: { en: 'Please enter exam name', th: 'กรุณากรอกชื่อการสอบ' },
      forbidden: { en: 'Staff only', th: 'เฉพาะเจ้าหน้าที่' },
      not_found: { en: 'Not found', th: 'ไม่พบข้อมูล' }
    },

    // ---------- Student ID Cards (Sprint 25) ----------
    idcard: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '🪪 Student ID Cards', th: '🪪 บัตรนักเรียน' },
      subtitle: { en: 'Printable student cards with QR', th: 'บัตรนักเรียนพร้อมพิมพ์ + QR' },
      print: { en: '🖨️ Print', th: '🖨️ พิมพ์' },
      class: { en: 'Class:', th: 'ห้อง:' },
      pickClass: { en: '— Select class —', th: '— เลือกห้อง —' },
      hint: { en: 'Select a class to generate cards', th: 'เลือกห้องเพื่อสร้างบัตร' },
      none: { en: 'No students in this class', th: 'ไม่มีนักเรียนในห้องนี้' },
      no: { en: 'ID', th: 'เลขประจำตัว' },
      room: { en: 'Class', th: 'ห้อง' }
    },

    // ---------- Messaging (Sprint 26) ----------
    msg: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '💬 Messages', th: '💬 ข้อความ' },
      threads: { en: 'Conversations', th: 'การสนทนา' },
      startNew: { en: '+ Start new...', th: '+ เริ่มสนทนาใหม่...' },
      pick: { en: 'Select a conversation', th: 'เลือกการสนทนา' },
      pickHint: { en: 'Pick a conversation to start chatting', th: 'เลือกการสนทนาเพื่อเริ่มแชท' },
      send: { en: 'Send', th: 'ส่ง' },
      type: { en: 'Type a message...', th: 'พิมพ์ข้อความ...' },
      none: { en: 'No conversations yet', th: 'ยังไม่มีการสนทนา' },
      noMsg: { en: 'No messages yet — say hi 👋', th: 'ยังไม่มีข้อความ — ทักทายได้เลย 👋' },
      staff: { en: 'Teacher', th: 'ครู' },
      parent: { en: 'Parent', th: 'ผู้ปกครอง' }
    },

    // ---------- Academic Calendar (Sprint 27) ----------
    cal: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '📅 Academic Calendar', th: '📅 ปฏิทินการศึกษา' },
      add: { en: '➕ Add Event', th: '➕ เพิ่มกิจกรรม' },
      editEvent: { en: '✏️ Edit Event', th: '✏️ แก้ไขกิจกรรม' },
      today: { en: 'Today', th: 'วันนี้' },
      holiday: { en: 'Holiday', th: 'วันหยุด' },
      exam: { en: 'Exam', th: 'สอบ' },
      activity: { en: 'Activity', th: 'กิจกรรม' },
      important: { en: 'Important', th: 'สำคัญ' },
      event: { en: 'Event', th: 'ทั่วไป' },
      monthEvents: { en: 'This month', th: 'เดือนนี้' },
      noEvents: { en: 'No events this month', th: 'ไม่มีกิจกรรมเดือนนี้' },
      fTitle: { en: 'Title', th: 'ชื่อกิจกรรม' },
      fCategory: { en: 'Category', th: 'ประเภท' },
      fDate: { en: 'Date', th: 'วันที่' },
      fEnd: { en: 'End (optional)', th: 'ถึงวันที่ (ถ้ามี)' },
      fDesc: { en: 'Description', th: 'รายละเอียด' },
      save: { en: '💾 Save', th: '💾 บันทึก' },
      delete: { en: '🗑️ Delete', th: '🗑️ ลบ' },
      needTitle: { en: 'Please enter a title', th: 'กรุณากรอกชื่อกิจกรรม' },
      saved: { en: '✅ Saved', th: '✅ บันทึกแล้ว' },
      deleted: { en: 'Deleted', th: 'ลบแล้ว' },
      confirmDelete: { en: 'Delete this event?', th: 'ลบกิจกรรมนี้?' },
      no_title: { en: 'Please enter a title', th: 'กรุณากรอกชื่อกิจกรรม' },
      no_date: { en: 'Please select a date', th: 'กรุณาเลือกวันที่' },
      forbidden: { en: 'Staff only', th: 'เฉพาะเจ้าหน้าที่' },
      not_found: { en: 'Not found', th: 'ไม่พบข้อมูล' }
    },

    // ---------- Onboarding Wizard (Sprint 16.X) ----------
    onboarding: {
      back: { en: '← Dashboard', th: '← แดชบอร์ด' },
      title: { en: '🚀 School Setup Guide', th: '🚀 คู่มือตั้งค่าโรงเรียน' },
      subtitle: { en: 'Complete these steps to get your school fully running on PanyaSchoolKit.', th: 'ทำตามขั้นตอนเหล่านี้ให้ครบ เพื่อเริ่มใช้ระบบเต็มรูปแบบ' },
      essential: { en: 'Essential Setup', th: 'ตั้งค่าที่จำเป็น' },
      optional: { en: 'Optional (recommended)', th: 'เพิ่มเติม (แนะนำ)' },
      stepsDone: { en: 'steps done', th: 'ขั้นตอนเสร็จ' },
      done: { en: '✓ Done', th: '✓ เสร็จ' },
      todo: { en: 'To do', th: 'ยังไม่ทำ' },
      optionalTag: { en: 'Optional', th: 'ไม่บังคับ' },
      setup: { en: 'Set up', th: 'ตั้งค่า' },
      review: { en: 'Review', th: 'ดู/แก้ไข' },
      allDoneTitle: { en: 'All set! Your school is fully configured.', th: 'เสร็จครบแล้ว! โรงเรียนพร้อมใช้งานเต็มรูปแบบ' },
      allDoneDesc: { en: 'You can revisit any step anytime from the dashboard.', th: 'กลับมาแก้ไขแต่ละขั้นตอนได้ทุกเมื่อจากแดชบอร์ด' },
      s_subjects: { en: 'Add Subjects', th: 'เพิ่มวิชา' },
      s_subjects_d: { en: 'Define the subjects taught at your school (MATH, ENG, SCI...).', th: 'กำหนดวิชาที่สอนในโรงเรียน (คณิต อังกฤษ วิทย์...)' },
      s_periods: { en: 'Set Class Periods', th: 'ตั้งคาบเรียน' },
      s_periods_d: { en: 'Define daily time slots (Period 1 = 08:30-09:20, breaks...).', th: 'กำหนดเวลาคาบเรียนในแต่ละวัน (คาบ 1 = 08:30-09:20, พัก...)' },
      s_grading: { en: 'Configure Grading Scale', th: 'ตั้งระบบเกรด' },
      s_grading_d: { en: 'Choose how grades are calculated (A-F, 4.0 GPA, Pass/Fail).', th: 'เลือกระบบเกรด (A-F, 4.0 GPA, ผ่าน/ไม่ผ่าน)' },
      s_students: { en: 'Import Students', th: 'นำเข้านักเรียน' },
      s_students_d: { en: 'Add students manually or import via CSV.', th: 'เพิ่มนักเรียนทีละคน หรือนำเข้าด้วย CSV' },
      s_teachers: { en: 'Import Teachers', th: 'นำเข้าครู' },
      s_teachers_d: { en: 'Add your teaching staff manually or via CSV.', th: 'เพิ่มครูทีละคน หรือนำเข้าด้วย CSV' },
      s_payment: { en: 'Payment / PromptPay', th: 'ตั้งค่าการชำระเงิน / PromptPay' },
      s_payment_d: { en: 'Enter PromptPay ID to auto-generate QR on tuition bills.', th: 'ใส่ PromptPay ID เพื่อสร้าง QR ในบิลอัตโนมัติ' },
      s_schedule: { en: 'Build Timetables', th: 'สร้างตารางเรียน' },
      s_schedule_d: { en: 'Assign subjects + teachers to each class period.', th: 'ใส่วิชา + ครู ในแต่ละคาบของห้องเรียน' },
      s_line: { en: 'LINE Notifications', th: 'แจ้งเตือน LINE' },
      s_line_d: { en: 'Connect LINE OA to notify parents (attendance, bills...).', th: 'เชื่อม LINE OA แจ้งเตือนผู้ปกครอง (เช็คชื่อ บิล...)' },
      s_users: { en: 'Invite Staff', th: 'เชิญทีมงาน' },
      s_users_d: { en: 'Invite teachers/admins to access the system.', th: 'เชิญครู/ฝ่ายธุรการเข้าใช้ระบบ' }
    },

    // ---------- ปพ. Documents (Sprint 13.7) — Thai Ministry of Education official report formats ----------
    popor: {
      title: { en: '📑 Official Documents (ปพ.)', th: '📑 เอกสารทางการ (ปพ.)' },
      subtitle: { en: 'Thai Ministry of Education official report formats', th: 'แบบรายงานตามมาตรฐานกระทรวงศึกษาธิการ' },
      dl1: { en: '📄 ปพ.1 Transcript', th: '📄 ปพ.1 ระเบียนแสดงผลการเรียน' },
      dl5Admin: { en: '📊 ปพ.5 (Class Roster)', th: '📊 ปพ.5 (บันทึกผลรายวิชา)' },
      dl6: { en: '📋 ปพ.6 Progress Book', th: '📋 ปพ.6 รายงานพัฒนาผู้เรียน' },
      noStudent: { en: 'Student not loaded yet — please wait or refresh.', th: 'ข้อมูลนักเรียนยังไม่โหลด กรุณารอสักครู่หรือรีเฟรช' },
      needClassYear: { en: 'Please select class + year before downloading ปพ.5', th: 'กรุณาเลือกห้องเรียนและปีการศึกษาก่อนดาวน์โหลด ปพ.5' },
      downloaded: { en: 'Document downloaded', th: 'ดาวน์โหลดเอกสารเรียบร้อย' },
      downloadFailed: { en: 'Download failed', th: 'ดาวน์โหลดไม่ได้' }
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
