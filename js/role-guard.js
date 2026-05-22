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
    staff: 2,
    owner: 3,
    developer: 4
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
        .select('id, status')
        .eq('id', schoolId)
        .single();

      if (error || !school) {
        console.warn('[roleGuard] Could not fetch school status', error);
        return;
      }

      // If school is in pending_payment state → force to add-payment page
      if (school.status === 'pending_payment') {
        console.log('[roleGuard] School in pending_payment — redirecting to /add-payment');
        // Determine path prefix based on current location
        const prefix = currentPath.startsWith('/pages/') ? '' : '/pages';
        window.location.href = `${prefix}/add-payment.html`;
        return;
      }

      // If school is suspended/cancelled, also block
      if (school.status === 'suspended' || school.status === 'cancelled') {
        console.warn('[roleGuard] School suspended/cancelled');
        // Could redirect to a "suspended" page in the future
        // For now just log — let the user see what they can
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
   * Require staff or higher (staff/owner/developer)
   */
  async requireStaff() {
    return this.requireRole(['staff', 'owner', 'developer']);
  },
  
  /**
   * Require owner or developer
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
console.log('✅ Role guard loaded');
