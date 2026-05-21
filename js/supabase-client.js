/* ===========================================
   SchoolKit Supabase Client + Tenant Detection
   เชื่อมเว็บกับ Supabase + ระบุ tenant จาก URL
   =========================================== */

// ⚠️ Public configuration - ปลอดภัยที่จะเปิดเผย
const SUPABASE_URL = 'https://nuzhkhchimemuetoewzn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_prRghlKfBE1VqrpJDZmmSA_1XifObOJ';

// Fallback school_id (SKKS) for dev/preview/unknown hosts
const SKKS_FALLBACK_ID = 'b410af1d-ea8b-43b9-9ca8-26c4b4b46e3b';

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

// Set safe default — will be replaced by async tenant detection below
window.CURRENT_SCHOOL_ID = SKKS_FALLBACK_ID;
window.CURRENT_SCHOOL_SLUG = 'skks';
window.TENANT_RESOLVED = false;  // becomes true after async resolution

console.log('✅ Supabase client initialized');


// ============= TENANT DETECTION =============

/**
 * Parse hostname to figure out which tenant to load.
 * Returns: { type: 'slug'|'custom_domain'|'dev', value: string }
 */
function detectTenantFromHostname() {
  const host = window.location.hostname.toLowerCase();

  // Localhost / Vercel preview / IP → dev mode (use SKKS)
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.vercel.app') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return { type: 'dev', value: host };
  }

  // Subdomain pattern: {slug}.panyaschoolkit.com
  const subdomainMatch = host.match(/^([a-z0-9][a-z0-9-]*)\.panyaschoolkit\.com$/);
  if (subdomainMatch) {
    const slug = subdomainMatch[1];
    // 'www' and 'app' are reserved (not tenant slugs)
    if (slug === 'www' || slug === 'app') {
      return { type: 'dev', value: host };
    }
    return { type: 'slug', value: slug };
  }

  // Apex panyaschoolkit.com → marketing site (handled by different Vercel project)
  // If we reach this code on the apex, fallback to SKKS for safety
  if (host === 'panyaschoolkit.com') {
    return { type: 'dev', value: host };
  }

  // Custom domain (e.g., suansonkk.com, www.someschool.com)
  return { type: 'custom_domain', value: host };
}


/**
 * Resolve tenant to school_id via Supabase RPC.
 * Uses sessionStorage cache to avoid repeated DB calls.
 */
async function resolveTenantSchoolId() {
  const tenant = detectTenantFromHostname();
  const cacheKey = 'skks-tenant-' + tenant.type + '-' + tenant.value;

  // 1) Try sessionStorage cache (fast path)
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      if (data && data.id) {
        return { id: data.id, slug: data.slug, source: 'cache' };
      }
    }
  } catch (e) { /* ignore corrupted cache */ }

  // 2) Dev/preview/apex → fallback SKKS
  if (tenant.type === 'dev') {
    return { id: SKKS_FALLBACK_ID, slug: 'skks', source: 'fallback-dev' };
  }

  // 3) Resolve via RPC
  try {
    let rpcName, params;
    if (tenant.type === 'slug') {
      rpcName = 'get_school_by_slug';
      params = { p_slug: tenant.value };
    } else {
      rpcName = 'get_school_by_domain';
      params = { p_domain: tenant.value };
    }

    const { data, error } = await supabaseClient.rpc(rpcName, params);
    if (error) throw error;

    if (data && data.found) {
      // Cache result
      sessionStorage.setItem(cacheKey, JSON.stringify({
        id: data.id,
        slug: data.slug,
        cached_at: Date.now()
      }));
      return { id: data.id, slug: data.slug, source: 'rpc' };
    } else {
      console.warn('⚠️ Tenant not found in DB:', tenant);
      return { id: SKKS_FALLBACK_ID, slug: 'skks', source: 'fallback-notfound' };
    }
  } catch (err) {
    console.error('❌ Tenant resolution error:', err);
    return { id: SKKS_FALLBACK_ID, slug: 'skks', source: 'fallback-error' };
  }
}


// ============= INITIALIZE TENANT (async) =============
// Set CURRENT_SCHOOL_ID + CURRENT_SCHOOL_SLUG once resolved.
// Other modules can listen to 'tenant-resolved' event.

(async () => {
  const result = await resolveTenantSchoolId();
  window.CURRENT_SCHOOL_ID = result.id;
  window.CURRENT_SCHOOL_SLUG = result.slug;
  window.TENANT_RESOLVED = true;

  console.log(`🏫 Tenant resolved: ${result.slug} (${result.id}) [${result.source}]`);

  // Notify other modules
  window.dispatchEvent(new CustomEvent('tenant-resolved', {
    detail: {
      schoolId: result.id,
      slug: result.slug,
      source: result.source
    }
  }));
})();


/**
 * Helper for other modules: wait for tenant to be resolved.
 * Usage: const { schoolId, slug } = await window.getTenant();
 */
window.getTenant = function() {
  return new Promise((resolve) => {
    if (window.TENANT_RESOLVED) {
      resolve({ schoolId: window.CURRENT_SCHOOL_ID, slug: window.CURRENT_SCHOOL_SLUG });
    } else {
      window.addEventListener('tenant-resolved', (e) => {
        resolve({ schoolId: e.detail.schoolId, slug: e.detail.slug });
      }, { once: true });
    }
  });
};
