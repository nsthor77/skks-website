/* ===========================================
   SKKS Supabase Client
   เชื่อมเว็บไซต์กับ Supabase Database
   =========================================== */

// ⚠️ Public configuration - ปลอดภัยที่จะเปิดเผย
const SUPABASE_URL = 'https://nuzhkhchimemuetoewzn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_prRghlKfBE1VqrpJDZmmSA_1XifObOJ';

// Initialize Supabase client (loads from CDN in HTML)
const { createClient } = window.supabase;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'skks-auth-token'
  },
  db: {
    schema: 'public'
  }
});

// Make available globally
window.supabaseClient = supabaseClient;

console.log('✅ Supabase client initialized');
