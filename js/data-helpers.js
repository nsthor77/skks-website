/* ===========================================
   SKKS Data Helpers
   ฟังก์ชันรวมสำหรับใช้ในทุกหน้า admin
   =========================================== */

const dataHelpers = {
  /**
   * Format date to Thai locale
   */
  formatDate(date, locale = null) {
    if (!date) return '—';
    const lang = locale || localStorage.getItem('skks_lang') || 'en';
    const d = new Date(date);
    return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },
  
  /**
   * Format datetime
   */
  formatDateTime(date, locale = null) {
    if (!date) return '—';
    const lang = locale || localStorage.getItem('skks_lang') || 'en';
    return new Date(date).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US');
  },
  
  /**
   * Format money (THB)
   */
  formatMoney(amount) {
    if (amount === null || amount === undefined) return '฿0';
    return '฿' + parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  },
  
  /**
   * Generate Student Number
   * Format: YY-PROGRAM-NNNN
   * e.g., "26-EP-0001"
   */
  generateStudentNumber(program, sequence) {
    const yr = new Date().getFullYear().toString().slice(-2);
    const seq = String(sequence).padStart(4, '0');
    return `${yr}-${program.toUpperCase()}-${seq}`;
  },
  
  /**
   * Generate Receipt Number
   * Format: RC-YYYYMMDD-NNNN
   */
  generateReceiptNumber(sequence) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(sequence).padStart(4, '0');
    return `RC-${date}-${seq}`;
  },
  
  /**
   * Generate Application Number
   * Format: APP-YYYY-NNNN
   */
  generateApplicationNumber(sequence) {
    const yr = new Date().getFullYear();
    const seq = String(sequence).padStart(4, '0');
    return `APP-${yr}-${seq}`;
  },
  
  /**
   * Get next sequence number for a table
   */
  async getNextSequence(table) {
    const { count } = await supabaseClient
      .from(table)
      .select('*', { count: 'exact', head: true });
    return (count || 0) + 1;
  },
  
  /**
   * Common stats query
   */
  async getStats() {
    const stats = {};
    
    try {
      // Total students
      const { count: studentCount } = await supabaseClient
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      stats.students = studentCount || 0;
      
      // Pending applications
      const { count: appCount } = await supabaseClient
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      stats.pendingApplications = appCount || 0;
      
      // Total revenue this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data: payments } = await supabaseClient
        .from('payments')
        .select('amount')
        .eq('status', 'completed')
        .gte('paid_at', startOfMonth.toISOString());
      
      stats.monthlyRevenue = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      
      // Total users
      const { count: userCount } = await supabaseClient
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      stats.users = userCount || 0;
      
    } catch (e) {
      console.error('Stats error:', e);
    }
    
    return stats;
  },
  
  /**
   * Show toast notification
   */
  toast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        display: flex; flex-direction: column; gap: 8px;
      `;
      document.body.appendChild(container);
    }
    
    const colors = {
      success: { bg: '#DCFCE7', text: '#166534', border: '#16A34A' },
      error: { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
      info: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
      warning: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' }
    };
    const c = colors[type] || colors.success;
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      padding: 12px 18px; background: ${c.bg}; color: ${c.text};
      border-left: 4px solid ${c.border}; border-radius: 12px;
      font-family: 'Prompt', sans-serif; font-size: 13px; font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08); min-width: 250px;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },
  
  /**
   * Confirm dialog (better than browser confirm)
   */
  async confirm(message, options = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Prompt', sans-serif;
      `;
      
      overlay.innerHTML = `
        <div style="background: white; border-radius: 18px; padding: 28px; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
          <h3 style="margin: 0 0 12px 0; color: #1E3A5F; font-size: 18px;">${options.title || 'Confirm'}</h3>
          <p style="margin: 0 0 24px 0; color: #6B7280; font-size: 14px; line-height: 1.5;">${message}</p>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn-cancel" style="padding: 10px 20px; background: #F3F4F6; color: #374151; border: none; border-radius: 100px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 13px;">${options.cancelText || 'Cancel'}</button>
            <button class="btn-confirm" style="padding: 10px 20px; background: ${options.danger ? '#EF4444' : '#5BB8E0'}; color: white; border: none; border-radius: 100px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 13px;">${options.confirmText || 'Confirm'}</button>
          </div>
        </div>
      `;
      
      overlay.querySelector('.btn-cancel').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('.btn-confirm').onclick = () => { overlay.remove(); resolve(true); };
      overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); }};
      
      document.body.appendChild(overlay);
    });
  },
  
  /**
   * Convert role to display name
   */
  roleLabel(role, lang = null) {
    const l = lang || localStorage.getItem('skks_lang') || 'en';
    const labels = {
      en: { student: 'Student', parent: 'Parent', staff: 'Staff', owner: 'Owner', developer: 'Developer' },
      th: { student: 'นักเรียน', parent: 'ผู้ปกครอง', staff: 'พนักงาน', owner: 'เจ้าของ', developer: 'ผู้พัฒนา' }
    };
    return labels[l][role] || role;
  },
  
  /**
   * Render role badge HTML
   */
  roleBadge(role) {
    const colors = {
      student: { bg: '#DBEAFE', text: '#1E40AF' },
      parent: { bg: '#FEF3C7', text: '#92400E' },
      staff: { bg: '#DCFCE7', text: '#166534' },
      owner: { bg: '#FCE7F3', text: '#9F1239' },
      developer: { bg: '#E9D5FF', text: '#6B21A8' }
    };
    const c = colors[role] || colors.student;
    return `<span style="display:inline-block; padding:3px 10px; border-radius:100px; font-size:11px; font-weight:600; background:${c.bg}; color:${c.text}; text-transform:uppercase; letter-spacing:0.5px;">${role}</span>`;
  },
  
  /**
   * Status badge HTML
   */
  statusBadge(status, type = 'student') {
    const styles = {
      active: { bg: '#DCFCE7', text: '#166534' },
      inactive: { bg: '#E5E7EB', text: '#4B5563' },
      pending: { bg: '#FEF3C7', text: '#92400E' },
      reviewing: { bg: '#DBEAFE', text: '#1E40AF' },
      accepted: { bg: '#DCFCE7', text: '#166534' },
      rejected: { bg: '#FEE2E2', text: '#991B1B' },
      enrolled: { bg: '#E9D5FF', text: '#6B21A8' },
      graduated: { bg: '#DBEAFE', text: '#1E40AF' },
      transferred: { bg: '#FEF3C7', text: '#92400E' },
      completed: { bg: '#DCFCE7', text: '#166534' },
      cancelled: { bg: '#FEE2E2', text: '#991B1B' },
      refunded: { bg: '#FEF3C7', text: '#92400E' }
    };
    const c = styles[status] || styles.inactive;
    return `<span style="display:inline-block; padding:3px 10px; border-radius:100px; font-size:11px; font-weight:600; background:${c.bg}; color:${c.text};">${status}</span>`;
  }
};

window.dataHelpers = dataHelpers;
console.log('✅ Data helpers loaded');
  /**
   * Load students with profile data (flattened)
   * รวมข้อมูลจาก profiles เข้ามาใน student object โดยตรง
   * เพื่อให้ใช้ s.first_name แทน s.profiles.first_name
   */
  async loadStudentsWithProfiles(supabaseClient, filters = {}) {
    let query = supabaseClient
      .from('students')
      .select('*, profiles!profile_id(first_name, last_name, first_name_th, last_name_th, nickname, email, phone)');
    
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.program) query = query.eq('program', filters.program);
    if (filters.grade) query = query.eq('grade', filters.grade);
    
    const { data, error } = await query;
    if (error) {
      console.error('loadStudentsWithProfiles error:', error);
      return [];
    }
    
    return (data || []).map(s => ({
      ...s,
      first_name: s.profiles?.first_name || '',
      last_name: s.profiles?.last_name || '',
      first_name_th: s.profiles?.first_name_th || '',
      last_name_th: s.profiles?.last_name_th || '',
      nickname: s.profiles?.nickname || '',
      email: s.profiles?.email || '',
      phone: s.profiles?.phone || ''
    }));
  },
  
  /**
   * Flatten a single student record (for use after queries that return profiles)
   */
  flattenStudent(s) {
    if (!s) return s;
    if (!s.profiles) return s;
    return {
      ...s,
      first_name: s.profiles.first_name || s.first_name || '',
      last_name: s.profiles.last_name || s.last_name || '',
      first_name_th: s.profiles.first_name_th || s.first_name_th || '',
      last_name_th: s.profiles.last_name_th || s.last_name_th || '',
      nickname: s.profiles.nickname || s.nickname || ''
    };
  },
  /**
   * Flatten nested students.profiles join into students directly
   * Use after queries that return: { students: { profiles: { first_name, ... } } }
   */
  flattenStudentJoin(records) {
    return (records || []).map(r => {
      if (r.students && r.students.profiles) {
        r.students = {
          ...r.students,
          first_name: r.students.profiles.first_name || '',
          last_name: r.students.profiles.last_name || '',
          first_name_th: r.students.profiles.first_name_th || '',
          last_name_th: r.students.profiles.last_name_th || '',
          nickname: r.students.profiles.nickname || ''
        };
      }
      return r;
    });
  },
