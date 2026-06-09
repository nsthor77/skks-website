/* ===========================================
   SKKS Role Guard
   ป้องกันหน้าตาม role ของ user
   =========================================== */

const roleGuard = {
  /**
   * Role hierarchy
   * developer > owner > staff > parent > student
   */
  ROLES: {
    student: 1,
    parent: 1,
    teacher: 2,   // teaching only
    staff: 3,     // = admin: manages site, no finance
    admin: 3,     // explicit admin role (same tier as staff)
    owner: 4,     // full incl finance
    developer: 5
  },
  
  /**
   * Require user to be logged in
   * Redirect to login if not
   */
  async requireAuth() {
    const session = await auth.getSession();

    if (!session) {
      // Save intended destination
      sessionStorage.setItem('skks_redirect_after_login', window.location.pathname);
      window.location.href = '/login.html';
      return null;
    }

    // Sprint 5.5: Check if school is in pending_payment state
    // If so, force redirect to /pages/add-payment.html (unless already there)
    await this.checkSchoolStatus();

    return session;
  },

  /**
   * Check school subscription status and redirect to /add-payment if pending_payment
   * Idempotent — safe to call on every page load
   */
  async checkSchoolStatus() {
    // Skip check if already on add-payment page (don't infinite-redirect)
    const currentPath = window.location.pathname;
    if (currentPath.includes('/add-payment')) {
      return;
    }

    // Skip check for /admin/* pages — admin pages have different context (platform-wide)
    if (currentPath.includes('/admin/')) {
      return;
    }

    // Skip check if no tenant context yet (will run again after tenant-resolved)
    const schoolId = window.CURRENT_SCHOOL_ID;
    if (!schoolId) {
      // Try again when tenant is resolved
      window.addEventListener('tenant-resolved', () => this.checkSchoolStatus(), { once: true });
      return;
    }

    try {
      const { data: school, error } = await supabaseClient
        .from('schools')
        .select('id, status, name')
        .eq('id', schoolId)
        .single();

      if (error || !school) {
        console.warn('[roleGuard] Could not fetch school status', error);
        return;
      }

      // If school is in pending_payment state → force to add-payment page
      if (school.status === 'pending_payment') {
        console.log('[roleGuard] School in pending_payment — redirecting to /pages/add-payment.html');
        // Always use absolute path from origin (works from any page)
        window.location.href = '/pages/add-payment.html';
        return;
      }

      // Sprint 7.D: If school is suspended (due to long past_due) → block + show recovery screen
      if (school.status === 'suspended') {
        // Allow access to /pages/add-payment.html (so user can recover) and /pages/billing.html (info)
        if (currentPath.includes('/add-payment') || currentPath.includes('/billing')) {
          return;
        }
        console.warn('[roleGuard] School suspended — showing recovery screen');
        this.showSuspendedScreen(school);
        return;
      }

      // Cancelled — just log for now (no auto-redirect, user might be viewing read-only)
      if (school.status === 'cancelled') {
        console.warn('[roleGuard] School cancelled');
      }
    } catch (err) {
      console.error('[roleGuard] checkSchoolStatus failed', err);
    }
  },
  
  /**
   * Require specific role(s)
   * @param {string[]} allowedRoles - e.g. ['staff', 'owner', 'developer']
   */
  async requireRole(allowedRoles) {
    const session = await this.requireAuth();
    if (!session) return null;
    
    const profile = await auth.getProfile();
    if (!profile) {
      window.location.href = '/login.html';
      return null;
    }
    
    if (!allowedRoles.includes(profile.role)) {
      // User doesn't have permission
      this.showAccessDenied(profile.role, allowedRoles);
      return null;
    }
    
    return profile;
  },
  
  /**
   * Require staff/admin or higher (staff=admin / owner / developer)
   * NOTE: 'staff' is the ADMIN tier — manages the whole site EXCEPT finance.
   */
  async requireStaff() {
    return this.requireRole(['staff', 'admin', 'owner', 'developer']);
  },

  /**
   * Alias of requireStaff — admin tier (manage site, no finance). Teachers are NOT admins.
   */
  async requireAdmin() {
    return this.requireRole(['staff', 'admin', 'owner', 'developer']);
  },

  /**
   * Require teacher or higher (teacher / staff=admin / owner / developer)
   * Use on teaching pages: attendance, grades, homework, students view, etc.
   */
  async requireTeacher() {
    return this.requireRole(['teacher', 'staff', 'admin', 'owner', 'developer']);
  },

  /**
   * Require owner or developer (finance / sensitive settings)
   */
  async requireOwner() {
    return this.requireRole(['owner', 'developer']);
  },
  
  /**
   * Require developer only
   */
  async requireDeveloper() {
    return this.requireRole(['developer']);
  },
  
  /**
   * Check role without redirecting
   */
  async hasRole(allowedRoles) {
    const profile = await auth.getProfile();
    return profile && allowedRoles.includes(profile.role);
  },
  
  /**
   * Show access denied page
   */
  showAccessDenied(currentRole, requiredRoles) {
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        padding: 24px;
        text-align: center;
        font-family: 'Prompt', 'Sarabun', sans-serif;
      ">
        <div style="font-size: 80px; margin-bottom: 20px;">🚫</div>
        <h1 style="color: #1E3A5F; margin-bottom: 16px; font-size: 32px;">
          Access Denied
        </h1>
        <p style="color: #6B7280; max-width: 500px; line-height: 1.6;">
          Your role <strong>${currentRole}</strong> doesn't have permission to view this page.<br/>
          Required: <strong>${requiredRoles.join(', ')}</strong>
        </p>
        <div style="margin-top: 32px; display: flex; gap: 12px;">
          <button onclick="window.history.back()" style="
            padding: 12px 24px;
            background: #5BB8E0;
            color: white;
            border: none;
            border-radius: 100px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
          ">← Go Back</button>
          <button onclick="auth.logout()" style="
            padding: 12px 24px;
            background: #EF4444;
            color: white;
            border: none;
            border-radius: 100px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
          ">Sign Out</button>
        </div>
      </div>
    `;
  },
  
  /**
   * Sprint 7.D — Show "Account Suspended" screen with recovery CTA
   */
  showSuspendedScreen(school) {
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 40px 24px;
        text-align: center;
        font-family: 'Sarabun', 'Prompt', sans-serif;
        background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
      ">
        <div style="
          background: #fff;
          border-radius: 16px;
          padding: 48px 40px;
          max-width: 560px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        ">
          <div style="font-size: 72px; margin-bottom: 16px;">🚫</div>
          <h1 style="color: #991B1B; margin: 0 0 12px; font-size: 28px; font-weight: 700;">
            บัญชีถูกระงับ
          </h1>
          <p style="color: #7F1D1D; margin: 0 0 8px; font-size: 16px; line-height: 1.6;">
            บัญชีของ <strong>${school.name || 'โรงเรียนของคุณ'}</strong> ถูกระงับชั่วคราว
          </p>
          <p style="color: #6B7280; margin: 0 0 32px; font-size: 14px; line-height: 1.6;">
            เนื่องจากระบบเรียกเก็บเงินไม่สำเร็จเป็นเวลานานเกินช่วงผ่อนผัน
          </p>

          <div style="
            background: #FEF3C7;
            border-left: 4px solid #F59E0B;
            text-align: left;
            padding: 16px 20px;
            border-radius: 8px;
            margin-bottom: 28px;
          ">
            <p style="margin: 0 0 8px; font-weight: 700; color: #92400E; font-size: 14px;">
              💡 วิธีกู้คืนบัญชี
            </p>
            <ol style="margin: 0; padding-left: 22px; color: #78350F; font-size: 13px; line-height: 1.8;">
              <li>กดปุ่ม "อัปเดตบัตรเครดิต" ด้านล่าง</li>
              <li>กรอกข้อมูลบัตรใหม่ → ยืนยัน</li>
              <li>ระบบจะเรียกเก็บยอดค้างชำระ + เปิดบัญชีอัตโนมัติ</li>
            </ol>
          </div>

          <a href="/pages/add-payment.html" style="
            display: inline-block;
            padding: 14px 32px;
            background: #2563EB;
            color: #fff;
            text-decoration: none;
            border-radius: 100px;
            font-weight: 700;
            font-size: 15px;
            margin-right: 8px;
          ">💳 อัปเดตบัตรเครดิต</a>

          <a href="/pages/billing.html" style="
            display: inline-block;
            padding: 14px 24px;
            background: transparent;
            color: #6B7280;
            text-decoration: none;
            border-radius: 100px;
            font-weight: 600;
            font-size: 14px;
            border: 1px solid #D1D5DB;
          ">ดูข้อมูล Billing</a>

          <p style="margin: 28px 0 0; font-size: 12px; color: #9CA3AF;">
            มีคำถาม? ติดต่อ <a href="mailto:support@panyaschoolkit.com" style="color: #2563EB;">support@panyaschoolkit.com</a>
          </p>

          <button onclick="auth.logout()" style="
            margin-top: 20px;
            padding: 8px 16px;
            background: transparent;
            color: #DC2626;
            border: none;
            cursor: pointer;
            font-size: 13px;
            text-decoration: underline;
            font-family: inherit;
          ">Sign Out</button>
        </div>
      </div>
    `;
  },

  /**
   * Get redirect URL after login based on role
   */
  getRedirectAfterLogin(role) {
    // Check if there's a saved redirect
    const saved = sessionStorage.getItem('skks_redirect_after_login');
    if (saved) {
      sessionStorage.removeItem('skks_redirect_after_login');
      return saved;
    }
    
    // Default redirects per role
    switch (role) {
      case 'developer':
      case 'owner':
        return '/pages/dashboard.html';
      case 'staff':
        return '/pages/dashboard.html';
      case 'student':
      case 'parent':
        return '/pages/profile.html';
      default:
        return '/';
    }
  }
};

window.roleGuard = roleGuard;

// ── Back-compat globals ──────────────────────────────────────────────────────
// Several pages call guard methods BARE (e.g. `await requireStaff()`) instead of
// `roleGuard.requireStaff()`. Without a global they throw ReferenceError, which
// rejects the page's init() and leaves it stuck on "Loading...". Expose every
// require* method as a global (bound to roleGuard) so those pages work.
Object.keys(roleGuard).forEach(function (k) {
  if (k.indexOf('require') === 0 && typeof roleGuard[k] === 'function' && typeof window[k] === 'undefined') {
    window[k] = roleGuard[k].bind(roleGuard);
  }
});

console.log('✅ Role guard loaded');

// ── Auto-load the shared left sidebar nav on every app page ──────────────────
// Derives sidebar.js URL from THIS script's own src so it works from /pages/.
// sidebar.js is guarded against double-load (skips /admin/, login, add-payment).
(function () {
  try {
    if (window.__pkSidebarLoaded) return;
    var ss = document.getElementsByTagName('script');
    for (var i = 0; i < ss.length; i++) {
      if (ss[i].src && ss[i].src.indexOf('role-guard.js') > -1) {
        var s = document.createElement('script');
        s.src = ss[i].src.replace('role-guard.js', 'sidebar.js');
        document.head.appendChild(s);
        break;
      }
    }
  } catch (e) { /* sidebar is non-critical */ }
})();

// ── Auto-load PWA support (manifest + service worker + install banner) ───────
(function () {
  try {
    if (window.__pkPwaLoaded) return;
    var ss = document.getElementsByTagName('script');
    for (var i = 0; i < ss.length; i++) {
      if (ss[i].src && ss[i].src.indexOf('role-guard.js') > -1) {
        var s = document.createElement('script');
        s.src = ss[i].src.replace('role-guard.js', 'pwa.js');
        document.head.appendChild(s);
        break;
      }
    }
  } catch (e) { /* pwa is non-critical */ }
})();

// ── Auto-load the notification bell on every app page ───────────────────────
(function () {
  try {
    if (window.__pkNotifLoaded) return;
    var ss = document.getElementsByTagName('script');
    for (var i = 0; i < ss.length; i++) {
      if (ss[i].src && ss[i].src.indexOf('role-guard.js') > -1) {
        var s = document.createElement('script');
        s.src = ss[i].src.replace('role-guard.js', 'notif-bell.js');
        document.head.appendChild(s);
        break;
      }
    }
  } catch (e) { /* notifications are non-critical */ }
})();

// ── Auto-load the mobile bottom tab bar on every app page ───────────────────
(function () {
  try {
    if (window.__pkTabbarLoaded) return;
    var ss = document.getElementsByTagName('script');
    for (var i = 0; i < ss.length; i++) {
      if (ss[i].src && ss[i].src.indexOf('role-guard.js') > -1) {
        var s = document.createElement('script');
        s.src = ss[i].src.replace('role-guard.js', 'tabbar.js');
        document.head.appendChild(s);
        break;
      }
    }
  } catch (e) { /* tab bar is non-critical */ }
})();
