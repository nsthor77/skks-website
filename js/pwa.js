/* ===========================================================================
   js/pwa.js — Progressive Web App support (installable + offline shell)
   - Builds a per-school manifest (name/icon/theme from branding) as a Blob.
   - Registers /sw.js.
   - Shows a dismissible "ติดตั้งแอป" banner on beforeinstallprompt.
   Loaded on every app page (injected by role-guard.js) + login.html.
   =========================================================================== */
(function () {
  'use strict';
  if (window.__pkPwaLoaded) return;
  window.__pkPwaLoaded = true;

  var ORIGIN = location.origin;
  var DEFAULT_ICON = '/images/panya-mark.png';

  function brandFromCache() {
    try { return JSON.parse(sessionStorage.getItem('pk-pwa-brand') || 'null'); } catch (e) { return null; }
  }
  function cacheBrand(b) { try { sessionStorage.setItem('pk-pwa-brand', JSON.stringify(b)); } catch (e) {} }

  function themeColor() {
    var b = brandFromCache();
    if (b && b.theme_color) return b.theme_color;
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
      if (v) return v;
    } catch (e) {}
    return '#1B5E3F';
  }

  function buildManifest() {
    var b = brandFromCache() || {};
    var name = (b.name && b.name.trim()) || document.title.replace(/\s*[—-].*$/, '').trim() || 'PanyaSchoolKit';
    var icon = (b.logo_url && /^https?:\/\//.test(b.logo_url)) ? b.logo_url : DEFAULT_ICON;
    var theme = themeColor();
    return {
      name: name,
      short_name: (name.length > 12 ? name.slice(0, 12) : name),
      description: 'ระบบบริหารโรงเรียน',
      start_url: '/login.html',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: theme,
      icons: [
        { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: icon, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    };
  }

  function applyManifest() {
    try {
      var blob = new Blob([JSON.stringify(buildManifest())], { type: 'application/manifest+json' });
      var url = URL.createObjectURL(blob);
      var link = document.querySelector('link[rel="manifest"]');
      if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
      if (link.dataset.pkUrl) { try { URL.revokeObjectURL(link.dataset.pkUrl); } catch (e) {} }
      link.href = url; link.dataset.pkUrl = url;

      // theme-color + iOS meta
      var th = themeColor();
      setMeta('theme-color', th);
      setMeta('apple-mobile-web-app-capable', 'yes');
      setMeta('apple-mobile-web-app-status-bar-style', 'default');
      setMeta('apple-mobile-web-app-title', buildManifest().short_name);
      var b = brandFromCache();
      if (b && b.logo_url) setLink('apple-touch-icon', b.logo_url);
      else setLink('apple-touch-icon', DEFAULT_ICON);
    } catch (e) { /* non-critical */ }
  }
  function setMeta(name, content) {
    var m = document.querySelector('meta[name="' + name + '"]');
    if (!m) { m = document.createElement('meta'); m.name = name; document.head.appendChild(m); }
    m.content = content;
  }
  function setLink(rel, href) {
    var l = document.querySelector('link[rel="' + rel + '"]');
    if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l); }
    l.href = href;
  }

  // upgrade manifest with real school branding (cached per session)
  async function refreshBrand() {
    if (brandFromCache()) { applyManifest(); return; }
    if (!window.supabaseClient) { applyManifest(); return; }
    try {
      var res = await window.supabaseClient.rpc('get_school_branding');
      if (res && res.data) { cacheBrand({ name: res.data.name, logo_url: res.data.logo_url, theme_color: res.data.theme_color }); }
    } catch (e) {}
    applyManifest();
  }

  // ---- install banner ----
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (localStorage.getItem('pk-pwa-dismissed') === '1') return;
    showBanner();
  });
  window.addEventListener('appinstalled', function () {
    localStorage.setItem('pk-pwa-dismissed', '1');
    var el = document.getElementById('pk-pwa-banner'); if (el) el.remove();
  });

  function showBanner() {
    if (document.getElementById('pk-pwa-banner')) return;
    var bar = document.createElement('div');
    bar.id = 'pk-pwa-banner';
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:14px;max-width:460px;margin:0 auto;z-index:9000;'
      + 'background:#0F1A36;color:#fff;border-radius:12px;padding:12px 14px;display:flex;gap:12px;align-items:center;'
      + 'box-shadow:0 8px 26px rgba(0,0,0,.28);font-family:inherit;font-size:14px;';
    bar.innerHTML = '<span style="font-size:22px;">📲</span>'
      + '<span style="flex:1;line-height:1.4;">ติดตั้งแอปลงหน้าจอโฮม ใช้งานง่ายเหมือนแอปจริง</span>'
      + '<button id="pk-pwa-install" style="background:#fff;color:#0F1A36;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;font-family:inherit;">ติดตั้ง</button>'
      + '<button id="pk-pwa-x" style="background:transparent;color:#9AA3B5;border:0;font-size:20px;cursor:pointer;">&times;</button>';
    document.body.appendChild(bar);
    document.getElementById('pk-pwa-install').addEventListener('click', async function () {
      if (!deferredPrompt) { bar.remove(); return; }
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) {}
      deferredPrompt = null; bar.remove();
    });
    document.getElementById('pk-pwa-x').addEventListener('click', function () {
      localStorage.setItem('pk-pwa-dismissed', '1'); bar.remove();
    });
  }

  function init() {
    applyManifest();      // immediate (generic / cached)
    refreshBrand();       // upgrade to school branding
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () { /* ignore */ });
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
