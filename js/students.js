/* ===========================================
   SKKS - Student Management
   =========================================== */

// ===== Mock Data Generation =====
const thaiFirstNames = {
  male: ['ธนภัทร', 'กฤษณ์', 'นพรุจ', 'ปวริศ', 'ชยพล', 'กิตติพศ', 'ปกรณ์', 'อัครพล', 'ภูวเดช', 'ณัฐภูมิ',
         'ภูริ', 'ศุภกร', 'ปุณยวีร์', 'จิรายุ', 'ณัฐวุฒิ', 'พีรพัฒน์', 'รัฐกานต์', 'ชนาธิป', 'อนุชิต', 'วรพล'],
  female: ['อัยยา', 'ปานวาด', 'ปิยะวรรณ', 'ฐิติกานต์', 'กานต์ธิดา', 'ภัทรวดี', 'รัตนวดี', 'ธิดารัตน์', 'กมลชนก',
           'พลอยพรรณ', 'ณัฐชยา', 'เปมิกา', 'ลดา', 'ชนิสรา', 'พิมพ์ลภัส', 'ศศิกานต์', 'ปุณิกา', 'นภัสสร', 'อรพรรณ', 'ปัณฑิตา']
};

const thaiLastNames = ['ทองคำ', 'ศรีสวัสดิ์', 'รุ่งเรือง', 'เจริญสุข', 'วงศ์ไทย', 'ชูวิทย์', 'พงษ์ศักดิ์',
                      'สมบูรณ์', 'อุทัยรัตน์', 'สุขสวัสดิ์', 'ภาคภูมิ', 'กล้าหาญ', 'มงคลรัตน์', 'พิทักษ์ไทย',
                      'ภิรมย์', 'ก้องไกล', 'ใจดี', 'ศรีสมบัติ', 'ปัญญาดี', 'ชัยมงคล', 'พรประเสริฐ',
                      'บุญมาก', 'ดวงสุริยา', 'รักสุภาษิต', 'มั่นคง', 'พิทักษ์', 'จิตรอารี', 'แสงอรุณ', 'พิทักษ์รัตน์'];

// Generate students for a classroom
function generateStudents(grade, program, room, count) {
  const students = [];
  const startId = `${program}${grade}${room}`.replace(/[^A-Z0-9]/gi, '');
  
  for (let i = 1; i <= count; i++) {
    const isMale = Math.random() > 0.48;
    const firstNames = isMale ? thaiFirstNames.male : thaiFirstNames.female;
    const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lname = thaiLastNames[Math.floor(Math.random() * thaiLastNames.length)];
    
    students.push({
      id: `${startId}-${String(i).padStart(3, '0')}`,
      no: i,
      prefix: isMale ? 'ด.ช.' : 'ด.ญ.',
      firstName: fname,
      lastName: lname,
      gender: isMale ? 'ชาย' : 'หญิง',
      grade,
      program,
      room,
      birthDate: randomBirthDate(grade),
      parentPhone: '08' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'),
      paymentStatus: Math.random() > 0.15 ? 'paid' : (Math.random() > 0.5 ? 'pending' : 'overdue'),
      tuitionFee: getTuitionFee(grade, program)
    });
  }
  return students;
}

function randomBirthDate(grade) {
  const gradeAge = {
    'Pre-K': 3, 'K1': 4, 'K2': 5, 'K3': 6,
    'P1': 7, 'P2': 8, 'P3': 9, 'P4': 10, 'P5': 11, 'P6': 12,
    'M1': 13, 'M2': 14, 'M3': 15
  };
  const age = gradeAge[grade] || 10;
  const year = (new Date().getFullYear() - age) + 543;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${day}/${month}/${year}`;
}

function getTuitionFee(grade, program) {
  const base = {
    'Pre-K': 35000, 'K1': 40000, 'K2': 40000, 'K3': 40000,
    'P1': 45000, 'P2': 45000, 'P3': 45000, 'P4': 50000, 'P5': 50000, 'P6': 50000,
    'M1': 55000, 'M2': 55000, 'M3': 55000
  };
  const multiplier = program === 'EP' ? 1.5 : 1;
  return Math.round((base[grade] || 45000) * multiplier);
}

const gradeNames = {
  'Pre-K': 'เตรียมอนุบาล', 'K1': 'อนุบาล 1', 'K2': 'อนุบาล 2', 'K3': 'อนุบาล 3',
  'P1': 'ประถมศึกษาปีที่ 1', 'P2': 'ประถมศึกษาปีที่ 2', 'P3': 'ประถมศึกษาปีที่ 3',
  'P4': 'ประถมศึกษาปีที่ 4', 'P5': 'ประถมศึกษาปีที่ 5', 'P6': 'ประถมศึกษาปีที่ 6',
  'M1': 'มัธยมศึกษาปีที่ 1', 'M2': 'มัธยมศึกษาปีที่ 2', 'M3': 'มัธยมศึกษาปีที่ 3'
};

// Build classrooms
const classroomsConfig = [
  { grade: 'Pre-K', program: 'MEP', room: '/1', count: 12 },
  { grade: 'K1', program: 'EP', room: '/1', count: 18 },
  { grade: 'K1', program: 'MEP', room: '/2', count: 22 },
  { grade: 'K2', program: 'EP', room: '/1', count: 20 },
  { grade: 'K2', program: 'MEP', room: '/2', count: 24 },
  { grade: 'K3', program: 'EP', room: '/1', count: 22 },
  { grade: 'K3', program: 'MEP', room: '/2', count: 24 },
  { grade: 'P1', program: 'EP', room: '/1', count: 25 },
  { grade: 'P1', program: 'MEP', room: '/2', count: 28 },
  { grade: 'P2', program: 'EP', room: '/1', count: 24 },
  { grade: 'P2', program: 'MEP', room: '/2', count: 26 },
  { grade: 'P3', program: 'EP', room: '/1', count: 26 },
  { grade: 'P3', program: 'MEP', room: '/2', count: 28 },
  { grade: 'P4', program: 'EP', room: '/1', count: 25 },
  { grade: 'P4', program: 'MEP', room: '/2', count: 27 },
  { grade: 'P5', program: 'EP', room: '/1', count: 23 },
  { grade: 'P5', program: 'MEP', room: '/2', count: 25 },
  { grade: 'P6', program: 'EP', room: '/1', count: 22 },
  { grade: 'P6', program: 'MEP', room: '/2', count: 24 },
  { grade: 'M1', program: 'EP', room: '/1', count: 20 },
  { grade: 'M1', program: 'MEP', room: '/2', count: 22 },
  { grade: 'M2', program: 'EP', room: '/1', count: 18 },
  { grade: 'M2', program: 'MEP', room: '/2', count: 20 },
  { grade: 'M3', program: 'EP', room: '/1', count: 17 },
  { grade: 'M3', program: 'MEP', room: '/2', count: 19 },
];

const allClassrooms = classroomsConfig.map((c, idx) => ({
  id: 'CLS' + String(idx + 1).padStart(3, '0'),
  ...c,
  students: generateStudents(c.grade, c.program, c.room, c.count),
  homeroom: getRandomTeacher()
}));

function getRandomTeacher() {
  const titles = ['อ.', 'นาง', 'นาย', 'น.ส.'];
  const fnames = ['สมศรี', 'สมหญิง', 'มาลี', 'ปราณี', 'สมชาย', 'อรุณี', 'สุพัตรา', 'นภาพร', 'รัตนา', 'วรรณา', 'ชนิดาภา', 'พิมพ์ใจ'];
  const lnames = ['สวัสดี', 'พิทักษ์', 'รักษา', 'แสงทอง', 'พงศ์ภัค', 'ใจดี', 'ทองพูล', 'มาลีรัตน์', 'แก้วใส', 'ศรีนวล'];
  return `${titles[Math.floor(Math.random()*titles.length)]} ${fnames[Math.floor(Math.random()*fnames.length)]} ${lnames[Math.floor(Math.random()*lnames.length)]}`;
}

// ===== Format Date =====
function todayThai() {
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// ===== Render Classrooms =====
function renderClassrooms() {
  const container = document.getElementById('classroomsContainer');
  const filterProgram = document.getElementById('filterProgram').value;
  const filterGrade = document.getElementById('filterGrade').value;
  const search = document.getElementById('searchInput').value.toLowerCase();
  
  const filtered = allClassrooms.filter(c => {
    if (filterProgram && c.program !== filterProgram) return false;
    if (filterGrade && c.grade !== filterGrade) return false;
    if (search) {
      return c.students.some(s => 
        (s.firstName + s.lastName).toLowerCase().includes(search) ||
        s.id.toLowerCase().includes(search)
      );
    }
    return true;
  });
  
  let totalStudents = 0;
  let totalMale = 0;
  let totalFemale = 0;
  
  container.innerHTML = filtered.map(cls => {
    const males = cls.students.filter(s => s.gender === 'ชาย').length;
    const females = cls.students.filter(s => s.gender === 'หญิง').length;
    totalStudents += cls.students.length;
    totalMale += males;
    totalFemale += females;
    
    let students = cls.students;
    if (search) {
      students = students.filter(s => 
        (s.firstName + s.lastName).toLowerCase().includes(search)
      );
    }
    
    return `
      <div class="a4-page" data-classroom="${cls.id}">
        <!-- Document Header -->
        <div class="doc-header">
          <div class="doc-header-left">
            <img src="../images/logo.png" alt="SKKS" />
            <div class="doc-header-school">
              <h1>โรงเรียนสวนสนขอนแก่น</h1>
              <p>Suanson Khon Kaen School (SKKS)</p>
            </div>
          </div>
          <div class="doc-header-right">
            <strong>เลขที่: ${cls.id}</strong>
            <p>วันที่: ${todayThai()}</p>
            <p>ปีการศึกษา 2569</p>
          </div>
        </div>
        
        <!-- Title -->
        <div class="doc-title">
          <h2>รายชื่อนักเรียน</h2>
          <p>${gradeNames[cls.grade]} (${cls.program})${cls.room}</p>
          <span class="doc-subtitle">${cls.program === 'EP' ? 'English Program' : 'Mini English Program'}</span>
        </div>
        
        <!-- Info Grid -->
        <div class="doc-info">
          <div class="doc-info-item">
            <label>ระดับชั้น</label>
            <strong>${gradeNames[cls.grade]}</strong>
          </div>
          <div class="doc-info-item">
            <label>หลักสูตร / ห้อง</label>
            <strong>${cls.program}${cls.room}</strong>
          </div>
          <div class="doc-info-item">
            <label>ครูประจำชั้น</label>
            <strong>${cls.homeroom}</strong>
          </div>
          <div class="doc-info-item">
            <label>จำนวนนักเรียน</label>
            <strong>${cls.students.length} คน (ช ${males} / ญ ${females})</strong>
          </div>
        </div>
        
        <!-- Students Table -->
        <table class="print-table">
          <thead>
            <tr>
              <th style="width:40px" class="text-center">เลขที่</th>
              <th style="width:90px">รหัสนักเรียน</th>
              <th>ชื่อ - นามสกุล</th>
              <th style="width:60px" class="text-center">เพศ</th>
              <th style="width:90px" class="text-center">วันเกิด</th>
              <th style="width:120px">เบอร์ผู้ปกครอง</th>
              <th style="width:90px" class="text-center">การชำระเงิน</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td class="text-center text-bold">${s.no}</td>
                <td><code style="font-size:9pt;color:#6B7280">${s.id}</code></td>
                <td>${s.prefix} ${s.firstName} ${s.lastName}</td>
                <td class="text-center">${s.gender}</td>
                <td class="text-center">${s.birthDate}</td>
                <td>${s.parentPhone}</td>
                <td class="text-center">
                  <span class="print-badge ${s.paymentStatus === 'paid' ? 'success' : s.paymentStatus === 'pending' ? 'pending' : 'danger'}">
                    ${s.paymentStatus === 'paid' ? 'ชำระแล้ว' : s.paymentStatus === 'pending' ? 'รอชำระ' : 'ค้างชำระ'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="text-bold">รวมทั้งหมด</td>
              <td class="text-bold">${cls.students.length} คน</td>
              <td colspan="4">ชำระแล้ว ${cls.students.filter(s=>s.paymentStatus==='paid').length} คน • รอชำระ ${cls.students.filter(s=>s.paymentStatus!=='paid').length} คน</td>
            </tr>
          </tfoot>
        </table>
        
        <!-- Signatures -->
        <div class="doc-signatures">
          <div class="signature-box">
            <div class="signature-line"></div>
            <strong>(${cls.homeroom})</strong>
            <span>ครูประจำชั้น</span>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <strong>(......................................)</strong>
            <span>ผู้อำนวยการโรงเรียน</span>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="doc-footer">
          <span>โรงเรียนสวนสนขอนแก่น (SKKS) — suansonkk.com</span>
          <span>เอกสาร ${cls.id} • พิมพ์เมื่อ ${todayThai()}</span>
        </div>
      </div>
    `;
  }).join('');
  
  // Update summary
  document.getElementById('classCount').textContent = filtered.length;
  document.getElementById('totalCount').textContent = totalStudents;
  document.getElementById('maleCount').textContent = totalMale;
  document.getElementById('femaleCount').textContent = totalFemale;
  document.getElementById('avgPerClass').textContent = filtered.length ? Math.round(totalStudents / filtered.length) : 0;
  document.getElementById('visibleCount').textContent = filtered.length;
}

// ===== Export Functions =====
function exportCSV() {
  const filterProgram = document.getElementById('filterProgram').value;
  const filterGrade = document.getElementById('filterGrade').value;
  
  const rows = [['เลขที่', 'รหัสนักเรียน', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'เพศ', 'ระดับชั้น', 'หลักสูตร', 'ห้อง', 'วันเกิด', 'เบอร์ผู้ปกครอง', 'ค่าเทอม', 'สถานะการชำระ']];
  
  allClassrooms
    .filter(c => (!filterProgram || c.program === filterProgram) && (!filterGrade || c.grade === filterGrade))
    .forEach(c => {
      c.students.forEach(s => {
        rows.push([
          s.no, s.id, s.prefix, s.firstName, s.lastName, s.gender,
          gradeNames[s.grade], s.program, s.room, s.birthDate,
          s.parentPhone, s.tuitionFee, s.paymentStatus === 'paid' ? 'ชำระแล้ว' : s.paymentStatus === 'pending' ? 'รอชำระ' : 'ค้างชำระ'
        ]);
      });
    });
  
  const csv = '\uFEFF' + rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
  downloadFile(csv, `students_${Date.now()}.csv`, 'text/csv;charset=utf-8');
}

function exportJSON() {
  const data = allClassrooms.map(c => ({
    classroom: c.id,
    grade: gradeNames[c.grade],
    program: c.program,
    room: c.room,
    homeroom: c.homeroom,
    studentCount: c.students.length,
    students: c.students
  }));
  downloadFile(JSON.stringify(data, null, 2), `students_${Date.now()}.json`, 'application/json');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

window.exportCSV = exportCSV;
window.exportJSON = exportJSON;
window.renderClassrooms = renderClassrooms;

// Initial render
renderClassrooms();
