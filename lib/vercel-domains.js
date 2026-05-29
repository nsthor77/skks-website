// ==========================================================================
// lib/vercel-domains.js
// Helper to attach a school's CUSTOM DOMAIN to our Vercel project so Vercel
// routes it to the app and auto-issues SSL (https). Server-side ONLY.
//
// Env vars (Vercel project → Settings → Environment Variables):
//   VERCEL_API_TOKEN   - token with access to the project (REQUIRED for automation)
//   VERCEL_PROJECT_ID  - project id or name (e.g. "skks-website" or "prj_xxxx")
//   VERCEL_TEAM_ID     - optional, set if the project lives under a team
//
// If VERCEL_API_TOKEN / VERCEL_PROJECT_ID are not set, the helper degrades
// gracefully: it returns { configured:false } and the caller falls back to
// "add the domain in the Vercel dashboard manually" — the DB custom_domain is
// still saved either way, so tenant detection keeps working.
// ==========================================================================

const VERCEL_API = 'https://api.vercel.com';

function vercelEnv() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID || '';
  return { token, projectId, teamId, configured: !!(token && projectId) };
}

function teamQuery(teamId) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

// ---- normalize / validate -------------------------------------------------
function normDomain(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')   // strip scheme if pasted
    .replace(/\/.*$/, '')          // strip path
    .replace(/\.$/, '');           // strip trailing dot
}

// RFC-ish hostname check (one or more labels + a TLD)
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function isValidDomain(domain) {
  const d = normDomain(domain);
  if (!d || d.length > 253) return false;
  if (/\.panyaschoolkit\.com$/.test(d)) return false; // that's the default subdomain mechanism
  return DOMAIN_RE.test(d);
}

// ---- Thai-aware apex vs subdomain detection (for manual DNS hint fallback) -
// Covers common multi-label public suffixes so .ac.th / .co.th are treated as
// apex correctly (a school root domain), not as a subdomain.
const MULTI_LABEL_SUFFIXES = [
  'ac.th', 'co.th', 'go.th', 'or.th', 'in.th', 'net.th', 'mi.th', 're.th',
  'co.uk', 'org.uk', 'gov.uk', 'com.au', 'net.au', 'co.nz', 'com.sg', 'edu.sg'
];

function isApex(domain) {
  const d = normDomain(domain);
  const labels = d.split('.');
  for (const suf of MULTI_LABEL_SUFFIXES) {
    if (d === suf || d.endsWith('.' + suf)) {
      return labels.length === suf.split('.').length + 1;
    }
  }
  // default single-label TLD (.com, .net, .org, bare .th, ...)
  return labels.length === 2;
}

// The DNS record the SCHOOL must add at their registrar.
function dnsInstructionsFor(domain) {
  const d = normDomain(domain);
  if (isApex(d)) {
    return { kind: 'apex', type: 'A', name: '@', value: '76.76.21.21' };
  }
  return { kind: 'subdomain', type: 'CNAME', name: d.split('.')[0], value: 'cname.vercel-dns.com' };
}

// ---- Vercel API calls -----------------------------------------------------
async function addDomainToVercel(domainRaw) {
  const domain = normDomain(domainRaw);
  const dns = dnsInstructionsFor(domain);
  const { token, projectId, teamId, configured } = vercelEnv();

  if (!configured) {
    return {
      configured: false, ok: false, verified: false, dns,
      message: 'VERCEL_API_TOKEN/VERCEL_PROJECT_ID not set — saved to DB; add the domain in the Vercel dashboard manually.'
    };
  }

  try {
    const r = await fetch(
      `${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/domains${teamQuery(teamId)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: domain })
      }
    );
    const data = await r.json().catch(() => ({}));

    // already attached to THIS project → treat as success
    const alreadyHere = data?.error?.code === 'domain_already_exists';
    if (!r.ok && !alreadyHere) {
      return {
        configured: true, ok: false, verified: false, dns,
        error: (data && data.error && data.error.message) || `Vercel API ${r.status}`,
        code: data?.error?.code || null
      };
    }

    // learn verification / misconfiguration status
    const cfg = await getDomainConfig(domain);
    const verified = (typeof data.verified === 'boolean' ? data.verified : false) || cfg.verified === true;

    return {
      configured: true, ok: true, verified, dns,
      verification: data.verification || [],
      misconfigured: cfg.misconfigured
    };
  } catch (e) {
    return { configured: true, ok: false, verified: false, dns, error: e.message };
  }
}

async function getDomainConfig(domainRaw) {
  const domain = normDomain(domainRaw);
  const { token, teamId, configured } = vercelEnv();
  if (!configured) return { configured: false };
  try {
    const r = await fetch(
      `${VERCEL_API}/v6/domains/${encodeURIComponent(domain)}/config${teamQuery(teamId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await r.json().catch(() => ({}));
    return {
      configured: true,
      misconfigured: data.misconfigured === true,
      verified: data.misconfigured === false,
      raw: data
    };
  } catch (e) {
    return { configured: true, error: e.message };
  }
}

async function removeDomainFromVercel(domainRaw) {
  const domain = normDomain(domainRaw);
  const { token, projectId, teamId, configured } = vercelEnv();
  if (!configured) return { configured: false, ok: false };
  try {
    const r = await fetch(
      `${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}${teamQuery(teamId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    );
    return { configured: true, ok: r.ok || r.status === 404 };
  } catch (e) {
    return { configured: true, ok: false, error: e.message };
  }
}

module.exports = {
  addDomainToVercel,
  getDomainConfig,
  removeDomainFromVercel,
  dnsInstructionsFor,
  isApex,
  isValidDomain,
  normDomain
};
