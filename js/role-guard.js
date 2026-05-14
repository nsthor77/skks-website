/* ===========================================
   SKKS Role Guard — Production-grade RBAC v2
   ===========================================
   Roles:
   - student: นักเรียน (ดูข้อมูลตัวเอง)
   - teacher: ครู (เกรด + ตรวจข้อสอบ + เช็คชื่อ)
   - admin:   ผู้ดูแลระบบ (ข่าว + บิล + การเงิน operational)
   - owner:   เจ้าของ (ทุกอย่าง + Settings)
   - developer: dev (เท่า owner)
   =========================================== */

const roleGuard = {
  ROLES: {
    student: 1,
    parent: 1,
    teacher: 2,
    staff: 2,
    admin: 3,
    owner: 4,
    developer: 5
  },
  
  async requireAuth() {
    const session = await auth.getSession();
    if (!session) {
      sessionStorage.setItem('skks_redirect_after_login', window.location.pathname);
      window.location.href = '/login.html';
      return null;
    }
    return session;
  },
  
  async requireRole(allowedRoles) {
    const session = await this.requireAuth();
    if (!session) return null;
    
    const profile = await auth.getProfile();
    if (!profile) {
      window.location.href = '/login.html';
      return null;
    }
    
    if (!allowedRoles.includes(profile.role)) {
      this.showAccessDenied(profile.role, allowedRoles);
      return null;
    }
    
    return profile;
  },
  
  async requireStudent() {
    return this.requireRole(['student', 'parent', 'teacher', 'admin', 'owner', 'developer']);
  },
  
  async requireTeacher() {
    return this.requireRole(['teacher', 'staff', 'admin', 'owner', 'developer']);
  },
  
  async requireAdmin() {
    return this.requireRole(['admin', 'staff', 'owner', 'developer']);
  },
  
  async requireStaff() {
    return this.requireRole(['teacher', 'staff', 'admin', 'owner', 'developer']);
  },
  
  async requireOwner() {
    return this.requireRole(['owner', 'developer']);
  },
  
  async requireDeveloper() {
    return this.requireRole(['developer']);
  },
  
  async hasRole(allowedRoles) {
    const profile = await auth.getProfile();
    return profile && allowedRoles.includes(profile.role);
  },
  
  showAccessDenied(currentRole, requiredRoles) {
    const roleNames = {
      student: '🎓 Student',
      teacher: '👨‍🏫 Teacher',
      admin: '👨‍💼 Admin',
      owner: '👑 Owner',
      developer: '🛠️ Developer',
      staff: '👨‍💼 Staff (legacy)',
      parent: '👨‍👩‍👧 Parent'
    };
    
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;font-family:'Prompt','Sarabun',sans-serif;background:linear-gradient(135deg,#F0FDF4 0%,#DBEAFE 100%);">
        <div style="font-size:80px;margin-bottom:20px;">🚫</div>
        <h1 style="color:#1B5E3F;margin-bottom:16px;font-size:32px;">Access Denied</h1>
        <p style="color:#6B7280;max-width:500px;line-height:1.6;margin-bottom:24px;">
          Your role <strong style="color:#1B5E3F;">${roleNames[currentRole] || currentRole}</strong> doesn't have permission to view this page.<br/>
          Required: <strong style="color:#5BB8E0;">${requiredRoles.map(r => roleNames[r] || r).join(', ')}</strong>
        </p>
        <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
          <button onclick="window.history.back()" style="padding:12px 24px;background:#5BB8E0;color:white;border:none;border-radius:100px;font-weight:600;cursor:pointer;font-size:14px;">← Go Back</button>
          <button onclick="window.location.href='/'" style="padding:12px 24px;background:#1B5E3F;color:white;border:none;border-radius:100px;font-weight:600;cursor:pointer;font-size:14px;">🏠 Home</button>
          <button onclick="auth.logout()" style="padding:12px 24px;background:#EF4444;color:white;border:none;border-radius:100px;font-weight:600;cursor:pointer;font-size:14px;">Sign Out</button>
        </div>
      </div>
    `;
  },
  
  getRedirectAfterLogin(role) {
    const saved = sessionStorage.getItem('skks_redirect_after_login');
    if (saved) {
      sessionStorage.removeItem('skks_redirect_after_login');
      return saved;
    }
    
    switch (role) {
      case 'developer':
      case 'owner':
      case 'admin':
      case 'staff':
        return '/pages/dashboard.html';
      case 'teacher':
        return '/pages/grades-admin.html';
      case 'student':
      case 'parent':
        return '/pages/student-dashboard.html';
      default:
        return '/';
    }
  }
};

window.roleGuard = roleGuard;
window.requireAuth = () => roleGuard.requireAuth();
window.requireStudent = () => roleGuard.requireStudent();
window.requireTeacher = () => roleGuard.requireTeacher();
window.requireAdmin = () => roleGuard.requireAdmin();
window.requireStaff = () => roleGuard.requireStaff();
window.requireOwner = () => roleGuard.requireOwner();
window.requireDeveloper = () => roleGuard.requireDeveloper();

console.log('✅ Role guard loaded (RBAC v2)');
