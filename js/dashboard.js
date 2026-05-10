/* ===========================================
   SKKS Admin Dashboard JS
   =========================================== */

// Today's date in Thai
function setTodayDate() {
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const d = new Date();
  const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  const el = document.getElementById('todayDate');
  if (el) el.textContent = dateStr;
}
setTodayDate();

// Chart.js global config
Chart.defaults.font.family = "'Sarabun', 'Inter', sans-serif";
Chart.defaults.color = '#6B7280';
Chart.defaults.font.size = 12;

// Brand colors
const colors = {
  sky: '#5BB8E0',
  skyLight: 'rgba(91, 184, 224, 0.15)',
  green: '#7CB342',
  greenLight: 'rgba(124, 179, 66, 0.15)',
  navy: '#1E3A5F',
  pink: '#EC4899',
  yellow: '#FCD34D',
  gray: '#E5E7EB'
};

// ========= Enrollment Chart (Bar + Line combo) =========
const enrollmentCtx = document.getElementById('enrollmentChart');
if (enrollmentCtx) {
  new Chart(enrollmentCtx, {
    type: 'bar',
    data: {
      labels: ['ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.'],
      datasets: [
        {
          label: 'ใบสมัคร',
          data: [18, 25, 32, 45, 38, 42],
          backgroundColor: colors.sky,
          borderRadius: 8,
          barThickness: 28,
          yAxisID: 'y'
        },
        {
          label: 'รายได้ (แสน)',
          data: [15, 22, 28, 38, 32, 36],
          type: 'line',
          borderColor: colors.green,
          backgroundColor: colors.greenLight,
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: '#fff',
          pointBorderColor: colors.green,
          pointBorderWidth: 3,
          pointRadius: 6,
          fill: true,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: colors.navy,
          padding: 12,
          cornerRadius: 8,
          titleFont: { weight: 700 },
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 0) return ` ${ctx.dataset.label}: ${ctx.parsed.y} ใบ`;
              return ` ${ctx.dataset.label}: ${ctx.parsed.y * 100000} บาท`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#F3F4F6' },
          ticks: { padding: 10 }
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          border: { display: false },
          grid: { display: false },
          ticks: { display: false }
        }
      }
    }
  });
}

// ========= Program Chart (Doughnut) =========
const programCtx = document.getElementById('programChart');
if (programCtx) {
  new Chart(programCtx, {
    type: 'doughnut',
    data: {
      labels: ['English Program (EP)', 'Mini English (MEP)', 'Kindergarten', 'Pre-K'],
      datasets: [{
        data: [220, 180, 90, 34],
        backgroundColor: [colors.sky, colors.green, colors.yellow, colors.pink],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 12,
            boxWidth: 8,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: colors.navy,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} คน`
          }
        }
      }
    }
  });
}

// ========= O-NET Chart (Bar comparison) =========
const onetCtx = document.getElementById('onetChart');
if (onetCtx) {
  new Chart(onetCtx, {
    type: 'bar',
    data: {
      labels: ['ภาษาอังกฤษ', 'คณิตศาสตร์', 'วิทยาศาสตร์', 'ภาษาไทย', 'สังคม'],
      datasets: [
        {
          label: 'SKKS',
          data: [92.5, 85.2, 80.5, 88.3, 82.1],
          backgroundColor: colors.sky,
          borderRadius: 6,
          barThickness: 18
        },
        {
          label: 'ค่าเฉลี่ยประเทศ',
          data: [37.5, 28.4, 35.2, 50.1, 45.3],
          backgroundColor: colors.gray,
          borderRadius: 6,
          barThickness: 18
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: colors.navy,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} คะแนน`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: {
          beginAtZero: true,
          max: 100,
          border: { display: false },
          grid: { color: '#F3F4F6' }
        }
      }
    }
  });
}

// ========= Payment Chart =========
const paymentCtx = document.getElementById('paymentChart');
if (paymentCtx) {
  new Chart(paymentCtx, {
    type: 'doughnut',
    data: {
      labels: ['ชำระแล้ว', 'รอชำระ', 'เกินกำหนด'],
      datasets: [{
        data: [78, 17, 5],
        backgroundColor: ['#16A34A', '#FCD34D', '#DC2626'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: colors.navy,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`
          }
        }
      }
    }
  });
}

// ========= Applications Table =========
const sampleApps = [
  { name: 'ด.ญ. ปิยะวรรณ ดวงสุริยา', initials: 'ปว', program: 'EP', grade: 'ป.1', date: '8 พ.ค. 69', status: 'pending', payment: 'success' },
  { name: 'ด.ช. ภูริพัฒน์ พรประเสริฐ', initials: 'ภพ', program: 'MEP', grade: 'อ.2', date: '8 พ.ค. 69', status: 'success', payment: 'success' },
  { name: 'ด.ญ. ฐิติกานต์ บุญมาก', initials: 'ฐก', program: 'EP', grade: 'ป.4', date: '7 พ.ค. 69', status: 'pending', payment: 'pending' },
  { name: 'ด.ช. กฤตเมธ ศรีสุข', initials: 'กม', program: 'EP', grade: 'ม.1', date: '7 พ.ค. 69', status: 'success', payment: 'success' },
  { name: 'ด.ญ. ลดา รักสุภาษิต', initials: 'ลด', program: 'MEP', grade: 'ป.3', date: '6 พ.ค. 69', status: 'info', payment: 'pending' },
];

const statusMap = {
  success: { label: 'ผ่านการพิจารณา', cls: 'success' },
  pending: { label: 'รอพิจารณา', cls: 'pending' },
  info: { label: 'นัดสัมภาษณ์', cls: 'info' },
  warning: { label: 'ยกเลิก', cls: 'warning' }
};

const paymentMap = {
  success: { label: 'ชำระแล้ว', cls: 'success' },
  pending: { label: 'รอชำระ', cls: 'pending' },
};

const applicationsTable = document.getElementById('applicationsTable');
if (applicationsTable) {
  applicationsTable.innerHTML = sampleApps.map(app => `
    <tr>
      <td>
        <div class="student-info-cell">
          <div class="avatar">${app.initials}</div>
          <div>
            <strong>${app.name}</strong>
            <span>นักเรียนใหม่</span>
          </div>
        </div>
      </td>
      <td><span class="status-badge info">${app.program}</span></td>
      <td>${app.grade}</td>
      <td>${app.date}</td>
      <td><span class="status-badge ${statusMap[app.status].cls}">${statusMap[app.status].label}</span></td>
      <td><span class="status-badge ${paymentMap[app.payment].cls}">${paymentMap[app.payment].label}</span></td>
      <td><button class="action-btn">⋮</button></td>
    </tr>
  `).join('');
}

// ========= Top Students Table =========
const topStudents = [
  { rank: 1, name: 'ด.ญ. อัยยา ทองคำ', initials: 'อย', grade: 'ป.6 EP', subject: 'ภาษาอังกฤษ', score: 100, status: 'success' },
  { rank: 2, name: 'ด.ช. นพรุจ พงษ์ศักดิ์', initials: 'นร', grade: 'ป.6 EP', subject: 'ภาษาอังกฤษ', score: 97.5, status: 'success' },
  { rank: 3, name: 'ด.ช. ธนภัทร ศรีสวัสดิ์', initials: 'ธภ', grade: 'ป.6 EP', subject: 'คณิตศาสตร์', score: 95, status: 'success' },
  { rank: 4, name: 'ด.ญ. รัตนวดี ชูวิทย์', initials: 'รว', grade: 'ป.6 EP', subject: 'ภาษาอังกฤษ', score: 95, status: 'success' },
  { rank: 5, name: 'ด.ญ. กานต์ธิดา สมบูรณ์', initials: 'กธ', grade: 'ป.6 EP', subject: 'คณิตศาสตร์', score: 92.5, status: 'success' },
  { rank: 6, name: 'ด.ญ. ธิดารัตน์ มงคลรัตน์', initials: 'ธร', grade: 'ป.6 EP', subject: 'ภาษาอังกฤษ', score: 92.5, status: 'success' },
  { rank: 7, name: 'ด.ญ. ปานวาด รุ่งเรือง', initials: 'ปว', grade: 'ป.6 MEP', subject: 'วิทยาศาสตร์', score: 92, status: 'success' },
  { rank: 8, name: 'ด.ญ. ณัฐชยา ปัญญาดี', initials: 'ณช', grade: 'ป.6 EP', subject: 'วิทยาศาสตร์', score: 91, status: 'success' },
  { rank: 9, name: 'ด.ช. กฤษณ์ เจริญสุข', initials: 'กษ', grade: 'ป.6 EP', subject: 'ภาษาไทย', score: 90, status: 'success' },
  { rank: 10, name: 'ด.ช. ชยพล สุขสวัสดิ์', initials: 'ชพ', grade: 'ป.6 EP', subject: 'คณิตศาสตร์', score: 90, status: 'success' },
];

const rankColor = (rank) => {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return '#E5E7EB';
};

const topStudentsTable = document.getElementById('topStudentsTable');
if (topStudentsTable) {
  topStudentsTable.innerHTML = topStudents.map(s => `
    <tr>
      <td>
        <div style="width:32px;height:32px;border-radius:50%;background:${rankColor(s.rank)};display:flex;align-items:center;justify-content:center;font-weight:700;color:${s.rank <= 3 ? 'white' : '#374151'};font-size:13px">
          ${s.rank}
        </div>
      </td>
      <td>
        <div class="student-info-cell">
          <div class="avatar">${s.initials}</div>
          <strong>${s.name}</strong>
        </div>
      </td>
      <td>${s.grade}</td>
      <td>${s.subject}</td>
      <td>
        <strong style="font-size:18px;color:${s.score === 100 ? '#16A34A' : '#1E3A5F'};font-family:'Prompt',sans-serif">
          ${s.score}
        </strong>
        <span style="color:#6B7280;font-size:12px"> / 100</span>
      </td>
      <td><span class="status-badge success">ดีเยี่ยม</span></td>
    </tr>
  `).join('');
}
