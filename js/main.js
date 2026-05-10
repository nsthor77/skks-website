/* ===========================================
   SKKS Main JavaScript
   =========================================== */

// ===== Navigation =====
const navbar = document.getElementById('navbar');
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('open');
  });
}

// Close menu on link click (mobile)
document.querySelectorAll('.nav-menu a').forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('open');
  });
});

// Active link on scroll
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
  const scrollPos = window.scrollY + 100;
  sections.forEach(section => {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const id = section.getAttribute('id');
    const link = document.querySelector(`.nav-menu a[href="#${id}"]`);
    if (link) {
      if (scrollPos >= top && scrollPos < bottom) {
        document.querySelectorAll('.nav-menu a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    }
  });
});

// ===== Students Data (O-NET Achievement) =====
const students = [
  {
    name: 'ด.ญ. อัยยา ทองคำ',
    nick: 'พี่อัยย์',
    grade: 'G.6 EP',
    subject: 'ภาษาอังกฤษ',
    score: 100,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#FEF3C7'
  },
  {
    name: 'ด.ช. ธนภัทร ศรีสวัสดิ์',
    nick: 'พี่ภีม',
    grade: 'G.6 EP',
    subject: 'คณิตศาสตร์',
    score: 95,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#DBEAFE'
  },
  {
    name: 'ด.ญ. ปานวาด รุ่งเรือง',
    nick: 'พี่ปลื้ม',
    grade: 'G.6 MEP',
    subject: 'วิทยาศาสตร์',
    score: 92,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#DCFCE7'
  },
  {
    name: 'ด.ช. กฤษณ์ เจริญสุข',
    nick: 'พี่ปอนด์',
    grade: 'G.6 EP',
    subject: 'ภาษาไทย',
    score: 90,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#FCE7F3'
  },
  {
    name: 'ด.ญ. ภัทรวดี วงศ์ไทย',
    nick: 'พี่หมิว',
    grade: 'G.6 MEP',
    subject: 'สังคมศึกษา',
    score: 88,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#E0E7FF'
  },
  {
    name: 'ด.ช. นพรุจ พงษ์ศักดิ์',
    nick: 'พี่ฟร้องค์',
    grade: 'G.6 EP',
    subject: 'ภาษาอังกฤษ',
    score: 97.5,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#FEF3C7'
  },
  {
    name: 'ด.ญ. กานต์ธิดา สมบูรณ์',
    nick: 'พี่ใบเฟิร์น',
    grade: 'G.6 EP',
    subject: 'คณิตศาสตร์',
    score: 92.5,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#DBEAFE'
  },
  {
    name: 'ด.ช. พีรพัฒน์ อุทัยรัตน์',
    nick: 'พี่ก็อต',
    grade: 'G.6 MEP',
    subject: 'วิทยาศาสตร์',
    score: 89,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#DCFCE7'
  },
  {
    name: 'ด.ญ. รัตนวดี ชูวิทย์',
    nick: 'พี่อิงค์',
    grade: 'G.6 EP',
    subject: 'ภาษาอังกฤษ',
    score: 95,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#FEF3C7'
  },
  {
    name: 'ด.ช. ชยพล สุขสวัสดิ์',
    nick: 'พี่ปริ๊นซ์',
    grade: 'G.6 EP',
    subject: 'คณิตศาสตร์',
    score: 90,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#DBEAFE'
  },
  {
    name: 'ด.ญ. เปมิกา ภาคภูมิ',
    nick: 'พี่อิ้งค์',
    grade: 'G.6 MEP',
    subject: 'ภาษาไทย',
    score: 88,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#FCE7F3'
  },
  {
    name: 'ด.ช. ชนาธิป กล้าหาญ',
    nick: 'พี่กัปตัน',
    grade: 'G.6 EP',
    subject: 'สังคมศึกษา',
    score: 85,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#E0E7FF'
  },
  {
    name: 'ด.ญ. ธิดารัตน์ มงคลรัตน์',
    nick: 'พี่ฝน',
    grade: 'G.6 EP',
    subject: 'ภาษาอังกฤษ',
    score: 92.5,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#FEF3C7'
  },
  {
    name: 'ด.ช. รัฐกานต์ พิทักษ์ไทย',
    nick: 'พี่กาน',
    grade: 'G.6 MEP',
    subject: 'วิทยาศาสตร์',
    score: 87,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#DCFCE7'
  },
  {
    name: 'ด.ญ. กมลชนก ภิรมย์',
    nick: 'พี่ฟ้า',
    grade: 'G.6 EP',
    subject: 'คณิตศาสตร์',
    score: 88,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#DBEAFE'
  },
  {
    name: 'ด.ช. อนุชิต ก้องไกล',
    nick: 'พี่ตั้ม',
    grade: 'G.6 EP',
    subject: 'ภาษาอังกฤษ',
    score: 90,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#FEF3C7'
  },
  {
    name: 'ด.ญ. พลอยพรรณ ใจดี',
    nick: 'พี่พลอย',
    grade: 'G.6 MEP',
    subject: 'ภาษาไทย',
    score: 86,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#FCE7F3'
  },
  {
    name: 'ด.ช. กิตติพศ ศรีสมบัติ',
    nick: 'พี่กิต',
    grade: 'G.6 EP',
    subject: 'สังคมศึกษา',
    score: 88,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#E0E7FF'
  },
  {
    name: 'ด.ญ. ณัฐชยา ปัญญาดี',
    nick: 'พี่นิว',
    grade: 'G.6 EP',
    subject: 'วิทยาศาสตร์',
    score: 91,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#DCFCE7'
  },
  {
    name: 'ด.ช. ปวริศ ชัยมงคล',
    nick: 'พี่อาร์ม',
    grade: 'G.6 MEP',
    subject: 'คณิตศาสตร์',
    score: 85,
    test: 'O-NET ปีการศึกษา 2568',
    color: '#DBEAFE'
  }
];

// Render students slider
function renderStudents() {
  const slider = document.getElementById('studentsSlider');
  if (!slider) return;
  
  slider.innerHTML = students.map((s, i) => {
    const initials = s.name.replace(/^ด\.[ญช]\.\s*/, '').split(' ')[0].charAt(0);
    return `
      <div class="student-card">
        <div class="student-card-header">
          <div class="student-photo">
            ${i === 0 ? 
              `<img src="images/student-onet.png" alt="${s.name}" />` : 
              `<div style="width:100%;height:100%;background:linear-gradient(135deg, var(--color-sky-light), var(--color-green-light));display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:700;color:var(--color-navy);font-family:var(--font-display)">${initials}</div>`
            }
          </div>
        </div>
        <div class="student-card-body">
          <div class="student-name">${s.nick}</div>
          <div class="student-grade">${s.name} • ${s.grade}</div>
          <div class="student-score" style="background: linear-gradient(135deg, ${s.color}, ${s.color}dd)">
            <div class="score-subject">${s.subject}</div>
            <div class="score-value">${s.score}<span> คะแนน</span></div>
          </div>
          <div class="student-test">${s.test}</div>
        </div>
      </div>
    `;
  }).join('');
}

renderStudents();

// Slider controls
const slider = document.getElementById('studentsSlider');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

if (prevBtn && nextBtn && slider) {
  prevBtn.addEventListener('click', () => {
    slider.scrollBy({ left: -304, behavior: 'smooth' });
  });
  
  nextBtn.addEventListener('click', () => {
    slider.scrollBy({ left: 304, behavior: 'smooth' });
  });
}

// ===== Multi-step Form =====
let currentStep = 1;
let formData = {};

function goToStep(step) {
  // Validate before going forward
  if (step > currentStep) {
    if (!validateStep(currentStep)) return;
  }
  
  document.querySelectorAll('.form-step').forEach(s => s.style.display = 'none');
  const target = document.getElementById('step' + step);
  if (target) {
    target.style.display = 'block';
    currentStep = step;
    
    // Generate ref number on success step
    if (step === 4) {
      saveApplication();
      const ref = 'SKKS-2569-' + String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0');
      const refEl = document.getElementById('refNumber');
      if (refEl) refEl.textContent = ref;
    }
    
    // Scroll into view
    document.getElementById('admissions').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function validateStep(step) {
  let valid = true;
  let firstInvalid = null;
  
  if (step === 1) {
    ['firstName', 'lastName', 'birthDate', 'gender'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value) {
        el.style.borderColor = 'var(--color-pink)';
        if (!firstInvalid) firstInvalid = el;
        valid = false;
      } else if (el) {
        el.style.borderColor = '';
        formData[id] = el.value;
      }
    });
  }
  
  if (step === 2) {
    ['program', 'grade', 'parentName', 'relation', 'phone', 'email'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value) {
        el.style.borderColor = 'var(--color-pink)';
        if (!firstInvalid) firstInvalid = el;
        valid = false;
      } else if (el) {
        el.style.borderColor = '';
        formData[id] = el.value;
      }
    });
  }
  
  if (!valid && firstInvalid) {
    firstInvalid.focus();
    showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
  }
  
  return valid;
}

function selectPayment(el) {
  document.querySelectorAll('.payment-method').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  formData.paymentMethod = el.dataset.method;
}

function resetForm() {
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
    if (el.id !== 'nationality') el.value = '';
  });
  formData = {};
  goToStep(1);
}

// Save application to localStorage (or window storage in production)
function saveApplication() {
  try {
    const apps = JSON.parse(localStorage.getItem('skks_applications') || '[]');
    formData.id = Date.now();
    formData.appliedAt = new Date().toISOString();
    formData.status = 'pending';
    apps.push(formData);
    localStorage.setItem('skks_applications', JSON.stringify(apps));
  } catch (e) {
    console.warn('Could not save:', e);
  }
}

// Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 32px;
    right: 32px;
    background: ${type === 'error' ? '#DC2626' : 'var(--color-navy)'};
    color: white;
    padding: 14px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: slideUp 0.3s ease-out;
    font-size: 14px;
    font-weight: 500;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

// Make functions globally available
window.goToStep = goToStep;
window.selectPayment = selectPayment;
window.resetForm = resetForm;

// ===== Animate stat numbers on scroll =====
const animateNumbers = () => {
  const numbers = document.querySelectorAll('.stat-number, .achievement-stat .number');
  numbers.forEach(num => {
    const text = num.textContent;
    const finalNum = parseInt(text.replace(/[^0-9]/g, ''));
    if (isNaN(finalNum)) return;
    
    const suffix = text.replace(/[0-9]/g, '');
    let current = 0;
    const duration = 1500;
    const step = finalNum / (duration / 16);
    
    const timer = setInterval(() => {
      current += step;
      if (current >= finalNum) {
        current = finalNum;
        clearInterval(timer);
      }
      num.textContent = Math.floor(current) + suffix;
    }, 16);
  });
};

// IntersectionObserver to trigger animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      if (entry.target.classList.contains('hero-stats') ||
          entry.target.classList.contains('achievements-stats')) {
        animateNumbers();
        observer.unobserve(entry.target);
      }
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.hero-stats, .achievements-stats').forEach(el => {
  observer.observe(el);
});

/* ===========================================
   ✨ ADDITIONS — Complete Site
   =========================================== */

// ===== Scroll to Top Button =====
const scrollTopBtn = document.getElementById('scrollTop');
if (scrollTopBtn) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 600) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
  });
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== Mobile Dropdown Toggle =====
document.querySelectorAll('.has-dropdown > a').forEach(link => {
  link.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      e.preventDefault();
      link.parentElement.classList.toggle('expanded');
    }
  });
});

// ===== Contact Form Submit =====
function submitContact() {
  const name = document.getElementById('contactName')?.value.trim();
  const phone = document.getElementById('contactPhone')?.value.trim();
  const message = document.getElementById('contactMessage')?.value.trim();
  
  if (!name || !phone || !message) {
    alert('กรุณากรอกชื่อ เบอร์โทร และข้อความให้ครบถ้วน');
    return;
  }
  
  // Mock submission
  alert(`✓ ส่งข้อความเรียบร้อยแล้ว!\n\nคุณ ${name}\nเบอร์: ${phone}\n\nทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง ขอบคุณครับ/ค่ะ`);
  
  // Clear form
  ['contactName', 'contactPhone', 'contactEmail', 'contactMessage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}
window.submitContact = submitContact;

// ===== Smooth scroll for in-page links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#' || targetId.length <= 1) return;
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      const navHeight = document.getElementById('navbar')?.offsetHeight || 70;
      const topBarHeight = document.querySelector('.top-bar')?.offsetHeight || 0;
      const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }
  });
});

// ===== Animate elements on scroll =====
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      fadeObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.timeline-item, .program-card, .feature-card, .staff-card, .facility-card, .news-card, .testimonial-card, .vm-card, .tuition-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
  fadeObserver.observe(el);
});
