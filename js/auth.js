/* ===========================================
   SKKS Authentication Module
   จัดการ login, logout, signup, session
   =========================================== */

const auth = {
  /**
   * Sign up new user
   */
  async signup({ email, password, firstName, lastName, role = 'student' }) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: role
          }
        }
      });
      
      if (error) throw error;
      
      return { success: true, data };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Sign in existing user
   */
  async login({ email, password }) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      // Get user profile with role
      const profile = await this.getProfile();
      
      return { 
        success: true, 
        data: { ...data, profile } 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Sign out current user
   */
  async logout() {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      
      // Redirect to login
      window.location.href = '/login.html';
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Get current session
   */
  async getSession() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    return session;
  },
  
  /**
   * Get current user
   */
  async getUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
  },
  
  /**
   * Get user's profile (with role)
   */
  async getProfile() {
    const user = await this.getUser();
    if (!user) return null;
    
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Profile fetch error:', error);
      return null;
    }
    
    return data;
  },
  
  /**
   * Update profile
   */
  async updateProfile(updates) {
    try {
      const user = await this.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Change password
   */
  async changePassword(newPassword) {
    try {
      const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Reset password (send email)
   */
  async resetPassword(email) {
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password.html'
      });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Listen to auth state changes
   */
  onAuthChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
  }
};

window.auth = auth;
console.log('✅ Auth module loaded');
