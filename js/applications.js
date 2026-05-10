/* ===========================================
   SKKS - Applications Management
   =========================================== */

const appNames = [
  ['ด.ญ.', 'อัยยา', 'ทองคำ', 'อัยย์'],
  ['ด.ช.', 'ธนภัทร', 'ศรีสวัสดิ์', 'ภีม'],
  ['ด.ญ.', 'ปานวาด', 'รุ่งเรือง', 'ปลื้ม'],
  ['ด.ช.', 'กฤษณ์', 'เจริญสุข', 'ปอนด์'],
  ['ด.ญ.', 'ภัทรวดี', 'วงศ์ไทย', 'หมิว'],
  ['ด.ช.', 'นพรุจ', 'พงษ์ศักดิ์', 'ฟร้องค์'],
  ['ด.ญ.', 'กานต์ธิดา', 'สมบูรณ์', 'ใบเฟิร์น'],
  ['ด.ช.', 'พีรพัฒน์', 'อุทัยรัตน์', 'ก็อต'],
  ['ด.ญ.', 'รัตนวดี', 'ชูวิทย์', 'อิงค์'],
  ['ด.ช.', 'ชยพล', 'สุขสวัสดิ์', 'ปริ๊นซ์'],
  ['ด.ญ.', 'เปมิกา', 'ภาคภูมิ', 'อิ้งค์'],
  ['ด.ช.', 'ชนาธิป', 'กล้าหาญ', 'กัปตัน'],
  ['ด.ญ.', 'ปิยะวรรณ', 'ดวงสุริยา', 'ปอ'],
  ['ด.ช.', 'ภูริพัฒน์', 'พรประเสริฐ', 'พีท'],
  ['ด.ญ.', 'ฐิติกานต์', 'บุญมาก', 'มายด์'],
  ['ด.ช.', 'กฤตเมธ', 'ศรีสุข', 'มิว'],
  ['ด.ญ.', 'ลดา', 'รักสุภาษิต', 'แอน']
];

const grades = ['Pre-K', 'K1', 'K2', 'K3', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3'];
const gradeNamesShort = {
  'Pre-K': 'ตอ.', 'K1': 'อ.1', 'K2': 'อ.2', 'K3': 'อ.3',
  'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6',
  'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3'
};
const gradeNames = {
  'Pre-K': 'เตรียมอนุบาล', 'K1': 'อนุบาล 1', 'K2': 'อนุบาล 2', 'K3': 'อนุบาล 3',
  'P1': 'ประถมศึกษาปีที่ 1', 'P2': 'ประถมศึกษาปีที่ 2', 'P3': 'ประถมศึกษาปีที่ 3',
  'P4': 'ประถมศึกษาปีที่ 4', 'P5': 'ประถมศึกษาปีที่ 5', 'P6': 'ประถมศึกษาปีที่ 6',
  'M1': 'มัธยมศึกษาปีที่ 1', 'M2': 'มัธยมศึกษาปีที่ 2', 'M3': 'มัธยมศึกษาปีที่ 3'
};

const statuses = [
  { v: 'pending', label: 'รอพิจารณา', cls: 'pending' },
  { v: 'interview', label: 'นัดสัมภาษณ์', cls: 'info' },
  { v: 'approved', label: 'อนุมัติ', cls: 'success' },
  { v: 'rejected', label: 'ไม่ผ่าน', cls: 'warning' },
];

function generateApps() {
  const apps = [];
  for (let i = 1; i <= 28; i++) {
    const n = appNames[(i-1) % appNames.length];
    const grade = grades[Math.floor(Math.random() * grades.length)];
    const program = Math.random() > 0.5 ? 'EP' : 'MEP';
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const paid = Math.random() > 0.25;
    const days = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    const parentTitle = ['นาย', 'นาง', 'นางสาว'][Math.floor(Math.random() * 3)];
    const parentFnames = ['สมชาย', 'สมศรี', 'มาลี', 'ปราณี', 'อนันต์', 'วราภรณ์', 'ธนากร', 'ศิริพร'];
    
    apps.push({
      id: `APP2569-${String(i).padStart(4, '0')}`,
      prefix: n[0],
      firstName: n[1],
      lastName: n[2],
      nickname: n[3],
      gender: n[0] === 'ด.ช.' ? 'ชาย' : 'หญิง',
      birthDate: '15/' + (Math.floor(Math.random()*12)+1) + '/' + (2555 + Math.floor(Math.random()*10)),
      nationality: 'ไทย',
      religion: 'พุทธ',
      currentSchool: ['โรงเรียนชุมชนบ้านสวนสน', 'โรงเรียนอนุบาลขอนแก่น', 'โรงเรียนสาธิต', 'โรงเรียนเทศบาล'][Math.floor(Math.random()*4)],
      grade,
      program,
      applyDate: date,
      
      parentName: `${parentTitle} ${parentFnames[Math.floor(Math.random()*parentFnames.length)]} ${n[2]}`,
      parentRelation: Math.random() > 0.5 ? 'มารดา' : 'บิดา',
      parentOccupation: ['ข้าราชการ', 'พนักงานบริษัท', 'ธุรกิจส่วนตัว', 'ครู'][Math.floor(Math.random()*4)],
      parentPhone: '08' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'),
      parentEmail: `parent${i}@example.com`,
      address: `${Math.floor(Math.random()*999)+1} หมู่ ${Math.floor(Math.random()*15)+1} ตำบลในเมือง อำเภอเมือง จังหวัดขอนแก่น 40000`,
      
      status: status.v,
      statusLabel: status.label,
      statusClass: status.cls,
      paymentStatus: paid ? 'paid' : 'pending',
      paymentAmount: 1550,
      paymentMethod: paid ? ['PromptPay', 'บัตรเครดิต', 'โอนผ่านธนาคาร'][Math.floor(Math.random()*3)] : '-',
      
      interviewDate: status.v === 'interview' ? formatThai(addDays(new Date(), 3 + Math.floor(Math.random()*7))) : null,
      
      notes: ''
    });
  }
  return apps;
}

function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate()+n); return c; }
function formatThai(d) {
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
}
function todayThai() {
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
}

const apps = generateApps();
let currentDetailId = null;

// ===== Render List =====
function renderList() {
  const status = document.getElementById('filterAppStatus').value;
  const program = document.getElementById('filterAppProgram').value;
  const search = document.getElementById('searchApp').value.toLowerCase();
  
  const filtered = apps.filter(a => {
    if (status && a.status !== status) return false;
    if (program && a.program !== program) return false;
    if (search) {
      const name = (a.firstName + ' ' + a.lastName + ' ' + a.nickname).toLowerCase();
      if (!name.includes(search) && !a.id.toLowerCase().includes(search)) return false;
    }
    return true;
  });
  
  document.getElementById('appCount').textContent = apps.length;
  
  const tbody = document.getElementById('appsTableBody');
  tbody.innerHTML = filtered.map(a => `
    <tr style="cursor:pointer" onclick="viewDetail('${a.id}')">
      <td><code style="font-size:12px;color:#6B7280">${a.id}</code></td>
      <td>
        <div class="student-info-cell">
          <div class="avatar">${a.firstName.charAt(0)}</div>
          <div>
            <strong>${a.prefix} ${a.firstName} ${a.lastName}</strong>
            <span>${a.nickname} • ${a.gender}</span>
          </div>
        </div>
      </td>
      <td><span class="status-badge info">${a.program}</span></td>
      <td>${gradeNamesShort[a.grade]}</td>
      <td>${formatThai(a.applyDate)}</td>
      <td><span class="status-badge ${a.paymentStatus === 'paid' ? 'success' : 'pending'}">${a.paymentStatus === 'paid' ? 'ชำระแล้ว' : 'รอชำระ'}</span></td>
      <td><span class="status-badge ${a.statusClass}">${a.statusLabel}</span></td>
      <td>
        <button class="action-btn" onclick="event.stopPropagation();viewDetail('${a.id}')" title="ดูรายละเอียด">👁️</button>
        <button class="action-btn" onclick="event.stopPropagation();printDetail('${a.id}')" title="พิมพ์">🖨️</button>
      </td>
    </tr>
  `).join('');
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:48px;color:#6B7280">ไม่พบใบสมัครที่ตรงกับเงื่อนไข</td></tr>`;
  }
}

// ===== Detail View =====
function viewDetail(id) {
  currentDetailId = id;
  const app = apps.find(a => a.id === id);
  if (!app) return;
  
  document.getElementById('listView').style.display = 'none';
  document.getElementById('detailView').style.display = 'block';
  
  document.getElementById('appDetailContainer').innerHTML = renderAppDocument(app);
  window.scrollTo(0, 0);
}

function showList() {
  document.getElementById('listView').style.display = 'block';
  document.getElementById('detailView').style.display = 'none';
}

function showCurrentDetail() {
  if (currentDetailId) viewDetail(currentDetailId);
  else if (apps.length) viewDetail(apps[0].id);
}

function printDetail(id) {
  viewDetail(id);
  setTimeout(() => window.print(), 200);
}

// ===== Render A4 Application Document =====
function renderAppDocument(app) {
  return `
    <div class="no-print" style="padding:16px 24px;background:#FEF3C7;border-bottom:1px solid #FDE68A;display:flex;justify-content:space-between;align-items:center">
      <div>
        <strong>กำลังดูใบสมัคร: ${app.id}</strong>
        <span style="color:#6B7280;font-size:13px;margin-left:12px">คลิก "พิมพ์ A4" เพื่อพิมพ์เอกสารนี้</span>
      </div>
      <button class="toolbar-btn" onclick="showList()">← กลับสู่รายการ</button>
    </div>
    
    <div class="a4-page">
      <div class="doc-header">
        <div class="doc-header-left">
          <img src="../images/logo.png" alt="SKKS" />
          <div class="doc-header-school">
            <h1>โรงเรียนสวนสนขอนแก่น</h1>
            <p>Suanson Khon Kaen School (SKKS)</p>
            <p style="font-size:9pt">ขอนแก่น • โทร 043-XXX-XXXX • suansonkk.com</p>
          </div>
        </div>
        <div class="doc-header-right">
          <strong>เลขใบสมัคร: ${app.id}</strong>
          <p>วันที่ยื่น: ${formatThai(app.applyDate)}</p>
          <p>ปีการศึกษา 2569</p>
        </div>
      </div>
      
      <div class="doc-title">
        <h2>ใบสมัครเข้าเรียน</h2>
        <p>${gradeNames[app.grade]} • ${app.program === 'EP' ? 'English Program' : 'Mini English Program'}</p>
        <span class="doc-subtitle">สถานะ: ${app.statusLabel}</span>
      </div>
      
      <!-- Student Info -->
      <div class="doc-section">
        <div class="doc-section-title">📋 ส่วนที่ 1: ข้อมูลนักเรียน</div>
        <table class="print-table">
          <tbody>
            <tr>
              <td style="width:25%;background:#F9FAFB" class="text-bold">ชื่อ - นามสกุล</td>
              <td>${app.prefix} ${app.firstName} ${app.lastName}</td>
              <td style="width:18%;background:#F9FAFB" class="text-bold">ชื่อเล่น</td>
              <td>${app.nickname}</td>
            </tr>
            <tr>
              <td style="background:#F9FAFB" class="text-bold">เพศ</td>
              <td>${app.gender}</td>
              <td style="background:#F9FAFB" class="text-bold">วันเกิด</td>
              <td>${app.birthDate}</td>
            </tr>
            <tr>
              <td style="background:#F9FAFB" class="text-bold">สัญชาติ</td>
              <td>${app.nationality}</td>
              <td style="background:#F9FAFB" class="text-bold">ศาสนา</td>
              <td>${app.religion}</td>
            </tr>
            <tr>
              <td style="background:#F9FAFB" class="text-bold">โรงเรียนเดิม</td>
              <td colspan="3">${app.currentSchool}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Program Info -->
      <div class="doc-section">
        <div class="doc-section-title">🎓 ส่วนที่ 2: หลักสูตรที่สมัคร</div>
        <div class="doc-info">
          <div class="doc-info-item">
            <label>หลักสูตร</label>
            <strong>${app.program === 'EP' ? 'English Program (EP)' : 'Mini English Program (MEP)'}</strong>
          </div>
          <div class="doc-info-item">
            <label>ระดับชั้น</label>
            <strong>${gradeNames[app.grade]}</strong>
          </div>
          <div class="doc-info-item">
            <label>ปีการศึกษา</label>
            <strong>2569</strong>
          </div>
          <div class="doc-info-item">
            <label>สถานะใบสมัคร</label>
            <strong><span class="print-badge ${app.statusClass}">${app.statusLabel}</span></strong>
          </div>
        </div>
      </div>
      
      <!-- Parent Info -->
      <div class="doc-section">
        <div class="doc-section-title">👨‍👩‍👧 ส่วนที่ 3: ข้อมูลผู้ปกครอง</div>
        <table class="print-table">
          <tbody>
            <tr>
              <td style="width:25%;background:#F9FAFB" class="text-bold">ชื่อผู้ปกครอง</td>
              <td>${app.parentName}</td>
              <td style="width:18%;background:#F9FAFB" class="text-bold">ความสัมพันธ์</td>
              <td>${app.parentRelation}</td>
            </tr>
            <tr>
              <td style="background:#F9FAFB" class="text-bold">อาชีพ</td>
              <td>${app.parentOccupation}</td>
              <td style="background:#F9FAFB" class="text-bold">เบอร์โทร</td>
              <td>${app.parentPhone}</td>
            </tr>
            <tr>
              <td style="background:#F9FAFB" class="text-bold">อีเมล</td>
              <td colspan="3">${app.parentEmail}</td>
            </tr>
            <tr>
              <td style="background:#F9FAFB" class="text-bold">ที่อยู่</td>
              <td colspan="3">${app.address}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Payment Info -->
      <div class="doc-section">
        <div class="doc-section-title">💳 ส่วนที่ 4: การชำระค่าธรรมเนียม</div>
        <table class="print-table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th class="text-right">จำนวนเงิน (บาท)</th>
              <th class="text-center">สถานะ</th>
              <th class="text-center">วิธีชำระ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ค่าใบสมัคร</td>
              <td class="text-right">500.00</td>
              <td class="text-center">${app.paymentStatus === 'paid' ? '<span class="print-badge success">ชำระแล้ว</span>' : '<span class="print-badge pending">รอชำระ</span>'}</td>
              <td class="text-center">${app.paymentMethod}</td>
            </tr>
            <tr>
              <td>ค่าประเมินผล</td>
              <td class="text-right">1,000.00</td>
              <td class="text-center">${app.paymentStatus === 'paid' ? '<span class="print-badge success">ชำระแล้ว</span>' : '<span class="print-badge pending">รอชำระ</span>'}</td>
              <td class="text-center">${app.paymentMethod}</td>
            </tr>
            <tr>
              <td>ค่าธรรมเนียมระบบ</td>
              <td class="text-right">50.00</td>
              <td class="text-center">${app.paymentStatus === 'paid' ? '<span class="print-badge success">ชำระแล้ว</span>' : '<span class="print-badge pending">รอชำระ</span>'}</td>
              <td class="text-center">${app.paymentMethod}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="text-bold">รวมทั้งสิ้น</td>
              <td class="text-right text-bold">1,550.00</td>
              <td colspan="2" class="text-center text-bold">${app.paymentStatus === 'paid' ? 'ชำระเรียบร้อย' : 'รอการชำระเงิน'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      ${app.interviewDate ? `
        <div style="background:#FEF3C7;padding:10px 14px;border-radius:6px;border-left:4px solid #F59E0B;margin-bottom:6mm">
          <strong style="font-size:11pt">📅 นัดหมายสัมภาษณ์: ${app.interviewDate}</strong>
          <p style="font-size:9pt;color:#92400E;margin-top:2px">โปรดมาถึงโรงเรียนก่อนเวลานัด 15 นาที พร้อมเอกสารประกอบการสมัคร</p>
        </div>
      ` : ''}
      
      <div class="doc-signatures">
        <div class="signature-box">
          <div class="signature-line"></div>
          <strong>(${app.parentName})</strong>
          <span>ผู้ปกครอง</span>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <strong>(......................................)</strong>
          <span>เจ้าหน้าที่รับสมัคร</span>
        </div>
      </div>
      
      <div class="doc-footer">
        <span>โรงเรียนสวนสนขอนแก่น (SKKS) — suansonkk.com</span>
        <span>เลขใบสมัคร ${app.id} • พิมพ์ ${todayThai()}</span>
      </div>
    </div>
  `;
}

// ===== Export =====
function exportApps() {
  const rows = [['เลขใบสมัคร','คำนำหน้า','ชื่อ','นามสกุล','ชื่อเล่น','เพศ','วันเกิด','โรงเรียนเดิม','หลักสูตร','ระดับชั้น','ผู้ปกครอง','ความสัมพันธ์','เบอร์','อีเมล','ที่อยู่','สถานะ','การชำระ','วันที่สมัคร']];
  apps.forEach(a => {
    rows.push([
      a.id, a.prefix, a.firstName, a.lastName, a.nickname, a.gender,
      a.birthDate, a.currentSchool, a.program, gradeNames[a.grade],
      a.parentName, a.parentRelation, a.parentPhone, a.parentEmail, a.address,
      a.statusLabel, a.paymentStatus === 'paid' ? 'ชำระแล้ว' : 'รอชำระ', formatThai(a.applyDate)
    ]);
  });
  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `applications_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

window.viewDetail = viewDetail;
window.showList = showList;
window.showCurrentDetail = showCurrentDetail;
window.printDetail = printDetail;
window.renderList = renderList;
window.exportApps = exportApps;

renderList();
