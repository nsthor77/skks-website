/* ===========================================================================
   js/announce-banner.js — show active school announcements at the top of the
   dashboard. Dismissible (per announcement id, remembered in localStorage).
   Include on dashboards AFTER supabase-client.js. Fails silently if the
   sprint-30 RPC isn't deployed yet.
   =========================================================================== */
(function () {
  'use strict';
  var DISMISS_KEY = 'pk-ann-dismissed';

  function dismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'); } catch (e) { return []; }
  }
  function remember(id) {
    var d = dismissed(); if (d.indexOf(id) < 0) d.push(id);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(d.slice(-200))); } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // keep paragraph breaks, escape the rest
  function bodyHtml(s) { return esc(s).replace(/\n/g, '<br>'); }

  function injectStyles() {
    if (document.getElementById('pk-ann-style')) return;
    var css = ''
      + '#pk-ann-wrap{max-width:1100px;margin:14px auto 0;padding:0 16px;display:flex;flex-direction:column;gap:10px;}'
      + '.pk-ann{position:relative;background:#fff;border:1px solid #E5E7EB;border-left:4px solid var(--brand,#1B5E3F);'
      + 'border-radius:10px;padding:13px 40px 13px 15px;box-shadow:0 2px 10px rgba(0,0,0,.04);}'
      + '.pk-ann.pin{background:#FFFBEB;border-left-color:#D97706;}'
      + '.pk-ann h5{margin:0 0 3px;font-size:14.5px;font-weight:700;color:#0F1A36;}'
      + '.pk-ann p{margin:0;font-size:13px;color:#475569;line-height:1.6;}'
      + '.pk-ann .x{position:absolute;top:8px;right:10px;border:0;background:transparent;font-size:18px;'
      + 'line-height:1;color:#9AA3B5;cursor:pointer;padding:2px 4px;}'
      + '.pk-ann .x:hover{color:#475569;}'
      + '.pk-ann .pk-ann-meta{font-size:11px;color:#94A3B8;margin-top:4px;}';
    var st = document.createElement('style'); st.id = 'pk-ann-style'; st.textContent = css;
    document.head.appendChild(st);
  }

  function render(list) {
    var skip = dismissed();
    var show = list.filter(function (a) { return skip.indexOf(a.id) < 0; });
    if (!show.length) return;

    injectStyles();
    var wrap = document.createElement('div');
    wrap.id = 'pk-ann-wrap';

    show.forEach(function (a) {
      var card = document.createElement('div');
      card.className = 'pk-ann' + (a.pinned ? ' pin' : '');
      card.innerHTML =
        '<button class="x" title="ปิด">&times;</button>' +
        '<h5>' + (a.pinned ? '📌 ' : '📢 ') + esc(a.title) + '</h5>' +
        (a.body ? '<p>' + bodyHtml(a.body) + '</p>' : '');
      card.querySelector('.x').addEventListener('click', function () {
        remember(a.id);
        card.remove();
        if (!wrap.querySelector('.pk-ann')) wrap.remove();
      });
      wrap.appendChild(card);
    });

    // place just below the top bar if present, else at very top of body
    var topbar = document.querySelector('.admin-topbar, .topbar, header');
    if (topbar && topbar.parentNode) topbar.parentNode.insertBefore(wrap, topbar.nextSibling);
    else document.body.insertBefore(wrap, document.body.firstChild);
  }

  async function load() {
    if (!window.supabaseClient) return;
    try {
      var res = await window.supabaseClient.rpc('get_active_announcements');
      if (res.error) { console.warn('[announce-banner]', res.error.message); return; }
      if (res.data && res.data.length) render(res.data);
    } catch (e) { console.warn('[announce-banner]', e.message || e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
