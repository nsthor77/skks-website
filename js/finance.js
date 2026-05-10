/* ===========================================
   SKKS - Finance / Payment Management
   =========================================== */

// ===== Mock Payment Data =====
const paymentMethods = ['PromptPay', 'บัตรเครดิต', 'โอนผ่านธนาคาร', 'เงินสด'];
const grades = ['Pre-K', 'K1', 'K2', 'K3', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3'];
const gradeNamesShort = {
  'Pre-K': 'ตอ.', 'K1': 'อ.1', 'K2': 'อ.2', 'K3': 'อ.3',
  'P1': 'ป.1', 'P2': 'ป.2', 'P3': 'ป.3', 'P4': 'ป.4', 'P5': 'ป.5', 'P6': 'ป.6',
  'M1': 'ม.1', 'M2': 'ม.2', 'M3': 'ม.3'
};

const sampleNames = [
  ['ด.ญ.', 'อัยยา', 'ทองคำ'], ['ด.ช.', 'ธนภัทร', 'ศรีสวัสดิ์'], ['ด.ญ.', 'ปานวาด', 'รุ่งเรือง'],
  ['ด.ช.', 'กฤษณ์', 'เจริญสุข'], ['ด.ญ.', 'ภัทรวดี', 'วงศ์ไทย'], ['ด.ช.', 'นพรุจ', 'พงษ์ศักดิ์'],
  ['ด.ญ.', 'กานต์ธิดา', 'สมบูรณ์'], ['ด.ช.', 'พีรพัฒน์', 'อุทัยรัตน์'], ['ด.ญ.', 'รัตนวดี', 'ชูวิทย์'],
  ['ด.ช.', 'ชยพล', 'สุขสวัสดิ์'], ['ด.ญ.', 'เปมิกา', 'ภาคภูมิ'], ['ด.ช.', 'ชนาธิป', 'กล้าหาญ'],
  ['ด.ญ.', 'ธิดารัตน์', 'มงคลรัตน์'], ['ด.ช.', 'รัฐกานต์', 'พิทักษ์ไทย'], ['ด.ญ.', 'กมลชนก', 'ภิรมย์'],
  ['ด.ช.', 'อนุชิต', 'ก้องไกล'], ['ด.ญ.', 'พลอยพรรณ', 'ใจดี'], ['ด.ช.', 'กิตติพศ', 'ศรีสมบัติ'],
  ['ด.ญ.', 'ณัฐชยา', 'ปัญญาดี'], ['ด.ช.', 'ปวริศ', 'ชัยมงคล'], ['ด.ญ.', 'ปิยะวรรณ', 'ดวงสุริยา'],
  ['ด.ช.', 'ภูริพัฒน์', 'พรประเสริฐ'], ['ด.ญ.', 'ฐิติกานต์', 'บุญมาก'], ['ด.ช.', 'กฤตเมธ', 'ศรีสุข'],
  ['ด.ญ.', 'ลดา', 'รักสุภาษิต']
];

function tuitionFeeFor(grade, program) {
  const base = {
    'Pre-K': 35000, 'K1': 40000, 'K2': 40000, 'K3': 40000,
    'P1': 45000, 'P2': 45000, 'P3': 45000, 'P4': 50000, 'P5': 50000, 'P6': 50000,
    'M1': 55000, 'M2': 55000, 'M3': 55000
  };
  return Math.round((base[grade] || 45000) * (program === 'EP' ? 1.5 : 1));
}

function generatePayments() {
  const payments = [];
  let id = 1;
  for (let i = 0; i < 80; i++) {
    const name = sampleNames[i % sampleNames.length];
    const grade = grades[Math.floor(Math.random() * grades.length)];
    const program = Math.random() > 0.5 ? 'EP' : 'MEP';
    const fee = tuitionFeeFor(grade, program);
    const r = Math.random();
    let status, paidDate, paymentMethod;
    
    if (r < 0.78) {
      status = 'paid';
      const days = Math.floor(Math.random() * 60);
      const d = new Date();
      d.setDate(d.getDate() - days);
      paidDate = d;
      paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    } else if (r < 0.92) {
      status = 'pending';
      paidDate = null;
      paymentMethod = '-';
    } else {
      status = 'overdue';
      paidDate = null;
      paymentMethod = '-';
    }
    
    const studentNo = String(i + 1).padStart(3, '0');
    payments.push({
      receiptNo: `RC2569-${String(id).padStart(5, '0')}`,
      studentId: `STD${grade}${program}-${studentNo}`,
      prefix: name[0],
      firstName: name[1] + (i > 24 ? ' ' + (i - 24) : ''),
      lastName: name[2],
      grade,
      program,
      room: `${program}/${Math.random() > 0.5 ? 1 : 2}`,
      term: '1/2569',
      tuitionFee: fee,
      otherFees: Math.random() > 0.7 ? 2500 : 0,
      total: fee + (Math.random() > 0.7 ? 2500 : 0),
      status,
      paidDate,
      paymentMethod,
      dueDate: '15 พ.ค. 2569',
      parentName: 'นาย/นาง ' + sampleNames[(i+5) % sampleNames.length][1] + ' ' + name[2]
    });
    id++;
  }
  return payments;
}

const allPayments = generatePayments();
let currentTab = 'summary';

// ===== Format Helpers =====
function formatMoney(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '-';
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function todayThai() {
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function statusBadge(s) {
  const map = {
    paid: ['success', 'ชำระแล้ว'],
    pending: ['pending', 'รอชำระ'],
    overdue: ['danger', 'ค้างชำระ']
  };
  const [cls, label] = map[s] || ['', s];
  return `<span class="print-badge ${cls}">${label}</span>`;
}

// Convert number to Thai text (simplified for display)
function bahtText(amount) {
  const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const places = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  
  function readNum(n) {
    if (n === 0) return '';
    const s = String(n);
    let result = '';
    for (let i = 0; i < s.length; i++) {
      const digit = parseInt(s[i]);
      const place = s.length - i - 1;
      if (digit === 0) continue;
      if (digit === 1 && place === 0 && s.length > 1) result += 'เอ็ด';
      else if (digit === 2 && place === 1) result += 'ยี่' + places[place];
      else if (digit === 1 && place === 1) result += places[place];
      else result += numbers[digit] + places[place];
    }
    return result;
  }
  
  let txt = readNum(intPart) + 'บาท';
  if (decPart > 0) txt += readNum(decPart) + 'สตางค์';
  else txt += 'ถ้วน';
  return txt;
}

// ===== Filter Helper =====
function getFiltered() {
  const status = document.getElementById('filterStatus').value;
  const program = document.getElementById('filterProgram').value;
  const search = document.getElementById('searchInput').value.toLowerCase();
  
  return allPayments.filter(p => {
    if (status && p.status !== status) return false;
    if (program && p.program !== program) return false;
    if (search) {
      const fullName = (p.firstName + ' ' + p.lastName).toLowerCase();
      if (!fullName.includes(search) && !p.receiptNo.toLowerCase().includes(search)) return false;
    }
    return true;
  });
}

// ===== Render Summary Tab =====
function renderSummary() {
  const filtered = getFiltered();
  
  const paid = filtered.filter(p => p.status === 'paid');
  const pending = filtered.filter(p => p.status === 'pending');
  const overdue = filtered.filter(p => p.status === 'overdue');
  
  const totalIncome = paid.reduce((sum, p) => sum + p.total, 0);
  const totalPending = pending.reduce((sum, p) => sum + p.total, 0);
  const totalOverdue = overdue.reduce((sum, p) => sum + p.total, 0);
  
  document.getElementById('totalIncome').textContent = (totalIncome / 1000).toFixed(0) + 'K';
  document.getElementById('paidCount').textContent = paid.length;
  document.getElementById('pendingCount').textContent = pending.length;
  document.getElementById('overdueCount').textContent = overdue.length;
  
  // By grade summary
  const byGrade = {};
  filtered.forEach(p => {
    const key = `${gradeNamesShort[p.grade]} (${p.program})`;
    if (!byGrade[key]) byGrade[key] = { paid: 0, pending: 0, overdue: 0, totalPaid: 0, total: 0, count: 0 };
    byGrade[key].count++;
    byGrade[key].total += p.total;
    if (p.status === 'paid') {
      byGrade[key].paid++;
      byGrade[key].totalPaid += p.total;
    } else if (p.status === 'pending') byGrade[key].pending++;
    else byGrade[key].overdue++;
  });
  
  // Render A4 summary
  document.getElementById('summaryReport').innerHTML = `
    <div class="doc-header">
      <div class="doc-header-left">
        <img src="../images/logo.png" alt="SKKS" />
        <div class="doc-header-school">
          <h1>โรงเรียนสวนสนขอนแก่น</h1>
          <p>Suanson Khon Kaen School (SKKS)</p>
        </div>
      </div>
      <div class="doc-header-right">
        <strong>รายงานการเงิน</strong>
        <p>วันที่: ${todayThai()}</p>
        <p>ภาคเรียนที่ 1/2569</p>
      </div>
    </div>
    
    <div class="doc-title">
      <h2>สรุปยอดเก็บค่าเทอม</h2>
      <p>ภาคเรียนที่ 1 ปีการศึกษา 2569</p>
      <span class="doc-subtitle">รายงานสำหรับผู้บริหาร</span>
    </div>
    
    <!-- Summary Cards -->
    <div class="print-summary">
      <div class="print-summary-card green">
        <label>รายรับที่เก็บได้</label>
        <div class="val">${formatMoney(totalIncome)}</div>
        <div class="sub">บาท จาก ${paid.length} รายการ</div>
      </div>
      <div class="print-summary-card yellow">
        <label>ยอดรอชำระ</label>
        <div class="val">${formatMoney(totalPending)}</div>
        <div class="sub">บาท จาก ${pending.length} รายการ</div>
      </div>
      <div class="print-summary-card pink">
        <label>ยอดค้างชำระ</label>
        <div class="val">${formatMoney(totalOverdue)}</div>
        <div class="sub">บาท จาก ${overdue.length} รายการ</div>
      </div>
      <div class="print-summary-card">
        <label>เก็บได้ %</label>
        <div class="val">${filtered.length ? Math.round(paid.length / filtered.length * 100) : 0}%</div>
        <div class="sub">รายการชำระเรียบร้อย</div>
      </div>
    </div>
    
    <div class="doc-section">
      <div class="doc-section-title">📊 สรุปแยกตามระดับชั้น / หลักสูตร</div>
      <table class="print-table">
        <thead>
          <tr>
            <th>ระดับชั้น / หลักสูตร</th>
            <th class="text-center">จำนวนนักเรียน</th>
            <th class="text-center">ชำระแล้ว</th>
            <th class="text-center">รอชำระ</th>
            <th class="text-center">ค้างชำระ</th>
            <th class="text-right">ยอดเก็บได้ (บาท)</th>
            <th class="text-right">ยอดรวมทั้งหมด (บาท)</th>
            <th class="text-center">% เก็บได้</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(byGrade).map(([key, val]) => `
            <tr>
              <td class="text-bold">${key}</td>
              <td class="text-center">${val.count}</td>
              <td class="text-center"><span class="print-badge success">${val.paid}</span></td>
              <td class="text-center"><span class="print-badge pending">${val.pending}</span></td>
              <td class="text-center"><span class="print-badge danger">${val.overdue}</span></td>
              <td class="text-right">${formatMoney(val.totalPaid)}</td>
              <td class="text-right">${formatMoney(val.total)}</td>
              <td class="text-center text-bold">${Math.round(val.totalPaid/val.total*100)}%</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td class="text-bold">รวมทั้งสิ้น</td>
            <td class="text-center text-bold">${filtered.length}</td>
            <td class="text-center text-bold">${paid.length}</td>
            <td class="text-center text-bold">${pending.length}</td>
            <td class="text-center text-bold">${overdue.length}</td>
            <td class="text-right text-bold">${formatMoney(totalIncome)}</td>
            <td class="text-right text-bold">${formatMoney(totalIncome + totalPending + totalOverdue)}</td>
            <td class="text-center text-bold">${filtered.length ? Math.round(paid.length/filtered.length*100) : 0}%</td>
          </tr>
        </tfoot>
      </table>
    </div>
    
    <div class="doc-section">
      <div class="doc-section-title">💳 ช่องทางการชำระเงิน</div>
      <table class="print-table">
        <thead>
          <tr>
            <th>วิธีการชำระ</th>
            <th class="text-center">จำนวนรายการ</th>
            <th class="text-right">ยอดรวม (บาท)</th>
            <th class="text-center">% สัดส่วน</th>
          </tr>
        </thead>
        <tbody>
          ${paymentMethods.map(method => {
            const items = paid.filter(p => p.paymentMethod === method);
            const sum = items.reduce((s,p) => s+p.total, 0);
            return `
              <tr>
                <td class="text-bold">${method}</td>
                <td class="text-center">${items.length}</td>
                <td class="text-right">${formatMoney(sum)}</td>
                <td class="text-center">${totalIncome ? Math.round(sum/totalIncome*100) : 0}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="doc-signatures">
      <div class="signature-box">
        <div class="signature-line"></div>
        <strong>(......................................)</strong>
        <span>เจ้าหน้าที่การเงิน</span>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <strong>(......................................)</strong>
        <span>ผู้อำนวยการโรงเรียน</span>
      </div>
    </div>
    
    <div class="doc-footer">
      <span>โรงเรียนสวนสนขอนแก่น (SKKS) — suansonkk.com</span>
      <span>รายงานการเงิน • พิมพ์เมื่อ ${todayThai()}</span>
    </div>
  `;
}

// ===== Render Payments Tab =====
function renderPayments() {
  const filtered = getFiltered();
  const total = filtered.reduce((s, p) => s + p.total, 0);
  const paid = filtered.filter(p => p.status === 'paid').reduce((s, p) => s + p.total, 0);
  
  document.getElementById('paymentsReport').innerHTML = `
    <div class="doc-header">
      <div class="doc-header-left">
        <img src="../images/logo.png" alt="SKKS" />
        <div class="doc-header-school">
          <h1>โรงเรียนสวนสนขอนแก่น</h1>
          <p>Suanson Khon Kaen School (SKKS)</p>
        </div>
      </div>
      <div class="doc-header-right">
        <strong>รายการชำระเงิน</strong>
        <p>วันที่: ${todayThai()}</p>
        <p>${filtered.length} รายการ</p>
      </div>
    </div>
    
    <div class="doc-title">
      <h2>รายงานรายการชำระเงิน</h2>
      <p>ภาคเรียนที่ 1 ปีการศึกษา 2569</p>
    </div>
    
    <table class="print-table">
      <thead>
        <tr>
          <th style="width:30px" class="text-center">#</th>
          <th style="width:110px">เลขใบเสร็จ</th>
          <th>ชื่อ - นามสกุล</th>
          <th style="width:90px" class="text-center">ระดับชั้น</th>
          <th style="width:80px" class="text-center">หลักสูตร</th>
          <th style="width:100px" class="text-right">ยอดชำระ</th>
          <th style="width:90px" class="text-center">วันที่ชำระ</th>
          <th style="width:90px" class="text-center">วิธี</th>
          <th style="width:80px" class="text-center">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.slice(0, 30).map((p, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td><code style="font-size:9pt">${p.receiptNo}</code></td>
            <td>${p.prefix} ${p.firstName} ${p.lastName}</td>
            <td class="text-center">${gradeNamesShort[p.grade]}</td>
            <td class="text-center">${p.room}</td>
            <td class="text-right text-bold">${formatMoney(p.total)}</td>
            <td class="text-center">${formatDate(p.paidDate)}</td>
            <td class="text-center">${p.paymentMethod}</td>
            <td class="text-center">${statusBadge(p.status)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5" class="text-bold">รวมที่แสดง (${Math.min(30, filtered.length)} รายการ)</td>
          <td class="text-right text-bold">${formatMoney(filtered.slice(0, 30).reduce((s,p)=>s+p.total,0))}</td>
          <td colspan="3"></td>
        </tr>
        <tr>
          <td colspan="5" class="text-bold">รวมทั้งหมด (${filtered.length} รายการ)</td>
          <td class="text-right text-bold">${formatMoney(total)}</td>
          <td colspan="3" class="text-center text-bold">เก็บแล้ว ${formatMoney(paid)} บาท</td>
        </tr>
      </tfoot>
    </table>
    
    ${filtered.length > 30 ? `<p style="text-align:center;color:#6B7280;font-size:9pt;margin-top:10mm">📄 แสดง 30 รายการแรก จากทั้งหมด ${filtered.length} รายการ — กรองเพื่อดูรายการอื่น</p>` : ''}
    
    <div class="doc-footer">
      <span>โรงเรียนสวนสนขอนแก่น (SKKS) — suansonkk.com</span>
      <span>รายการชำระ • พิมพ์เมื่อ ${todayThai()}</span>
    </div>
  `;
}

// ===== Render Receipts Tab =====
function renderReceipts() {
  const filtered = getFiltered().filter(p => p.status === 'paid').slice(0, 6);
  
  document.getElementById('receiptsContainer').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;padding:24px;max-width:1200px;margin:0 auto">
      ${filtered.map(p => `
        <div class="receipt">
          <div class="receipt-header">
            <img src="../images/logo.png" alt="SKKS" />
            <h3>โรงเรียนสวนสนขอนแก่น</h3>
            <p>Suanson Khon Kaen School</p>
            <p>โทร 043-XXX-XXXX</p>
            <p style="margin-top:6px"><strong>ใบเสร็จรับเงิน / Receipt</strong></p>
            <p>${p.receiptNo}</p>
          </div>
          
          <div class="receipt-row">
            <span>วันที่:</span>
            <span>${formatDate(p.paidDate)}</span>
          </div>
          <div class="receipt-row">
            <span>ผู้ชำระ:</span>
            <span>${p.parentName}</span>
          </div>
          <div class="receipt-row">
            <span>นักเรียน:</span>
            <span>${p.prefix} ${p.firstName}</span>
          </div>
          <div class="receipt-row">
            <span>ระดับชั้น:</span>
            <span>${gradeNamesShort[p.grade]} ${p.room}</span>
          </div>
          
          <div class="receipt-divider">━━━━━━━━━━━━━━━━━━━</div>
          
          <div class="receipt-row">
            <span>ค่าเทอม ${p.term}</span>
            <span>${formatMoney(p.tuitionFee)}</span>
          </div>
          ${p.otherFees ? `
            <div class="receipt-row">
              <span>ค่าอุปกรณ์การเรียน</span>
              <span>${formatMoney(p.otherFees)}</span>
            </div>
          ` : ''}
          
          <div class="receipt-row total">
            <span>รวมทั้งสิ้น</span>
            <span>${formatMoney(p.total)} ฿</span>
          </div>
          
          <div class="receipt-divider">${bahtText(p.total)}</div>
          
          <div class="receipt-row" style="margin-top:8px">
            <span>ชำระโดย:</span>
            <span>${p.paymentMethod}</span>
          </div>
          
          <div class="receipt-divider">━━━━━━━━━━━━━━━━━━━</div>
          
          <p style="text-align:center;font-size:8pt;margin-top:6px">ขอบคุณที่ใช้บริการ</p>
          <p style="text-align:center;font-size:8pt">www.suansonkk.com</p>
          
          <div style="margin-top:8px;text-align:center;font-size:8pt;color:#6B7280">
            <button class="no-print" onclick="window.print()" style="padding:4px 10px;font-size:8pt;border:1px solid #5BB8E0;color:#5BB8E0;background:white;border-radius:4px;cursor:pointer">🖨️ พิมพ์ใบเสร็จนี้</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== Tab Switching =====
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabSummary').style.display = 'none';
  document.getElementById('tabPayments').style.display = 'none';
  document.getElementById('tabReceipts').style.display = 'none';
  
  const titles = {
    summary: '💰 รายงานสรุปการเงิน',
    payments: '💳 รายการชำระเงิน',
    receipts: '📋 ใบเสร็จรับเงิน'
  };
  document.getElementById('pageTitle').textContent = titles[tab];
  
  if (tab === 'summary') {
    document.getElementById('tabSummary').style.display = 'block';
    renderSummary();
    renderCharts();
  } else if (tab === 'payments') {
    document.getElementById('tabPayments').style.display = 'block';
    renderPayments();
  } else if (tab === 'receipts') {
    document.getElementById('tabReceipts').style.display = 'block';
    renderReceipts();
  }
}

function renderFinance() {
  switchTab(currentTab);
}

// ===== Charts =====
let chartsRendered = false;
function renderCharts() {
  if (chartsRendered) return;
  chartsRendered = true;
  
  Chart.defaults.font.family = "'Sarabun', sans-serif";
  Chart.defaults.color = '#6B7280';
  
  const incomeCtx = document.getElementById('incomeChart');
  if (incomeCtx) {
    new Chart(incomeCtx, {
      type: 'bar',
      data: {
        labels: ['พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.'],
        datasets: [
          {
            label: 'รายรับจริง (แสน)',
            data: [12, 18, 22, 24, 20, 16],
            backgroundColor: '#7CB342',
            borderRadius: 8
          },
          {
            label: 'เป้าหมาย (แสน)',
            data: [15, 20, 25, 25, 22, 18],
            type: 'line',
            borderColor: '#5BB8E0',
            backgroundColor: 'rgba(91, 184, 224, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#5BB8E0',
            pointBorderWidth: 3,
            pointRadius: 5,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, boxWidth: 8 } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F3F4F6' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
  
  const statusCtx = document.getElementById('statusChart');
  if (statusCtx) {
    new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['ชำระแล้ว', 'รอชำระ', 'ค้างชำระ'],
        datasets: [{
          data: [78, 14, 8],
          backgroundColor: ['#16A34A', '#FCD34D', '#DC2626'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, boxWidth: 8 } }
        }
      }
    });
  }
}

// ===== Export =====
function exportFinanceCSV() {
  const filtered = getFiltered();
  const rows = [['เลขใบเสร็จ', 'รหัสนักเรียน', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ระดับชั้น', 'หลักสูตร', 'ภาคเรียน', 'ค่าเทอม', 'ค่าอื่น', 'รวม', 'สถานะ', 'วันที่ชำระ', 'วิธีชำระ']];
  filtered.forEach(p => {
    rows.push([
      p.receiptNo, p.studentId, p.prefix, p.firstName, p.lastName,
      gradeNamesShort[p.grade], p.program, p.term,
      p.tuitionFee, p.otherFees, p.total,
      p.status === 'paid' ? 'ชำระแล้ว' : p.status === 'pending' ? 'รอชำระ' : 'ค้างชำระ',
      p.paidDate ? formatDate(p.paidDate) : '-',
      p.paymentMethod
    ]);
  });
  
  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

window.switchTab = switchTab;
window.renderFinance = renderFinance;
window.exportFinanceCSV = exportFinanceCSV;

// Init
switchTab('summary');
