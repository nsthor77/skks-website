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
// Current tenant school_id — for single-tenant SKKS deployment
// TODO Sprint 3.2: detect from subdomain for multi-tenant
const CURRENT_SCHOOL_ID = 'b410af1d-ea8b-43b9-9ca8-26c4b4b46e3b'; // SKKS
window.CURRENT_SCHOOL_ID = CURRENT_SCHOOL_ID;
