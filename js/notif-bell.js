/* ===========================================================================
   js/notif-bell.js — floating notification bell (pull model).
   Calls get_notifications(), shows an unread badge + dropdown. Read-state in
   localStorage. Injected by role-guard.js on app pages. Non-critical.
   =========================================================================== */
(function () {
  'use strict';
  if (window.__pkNotifLoaded) return;
  window.__pkNotifLoaded = true;

  var READ_KEY = 'pk-notif-read';
  var ICON = { announcement:'📢', consent:'✍️', survey:'📊', bill:'💰' };

  function readSet() { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch (e) { return new Set(); } }
  function saveRead(set) { try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(set).slice(-400))); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function keyOf(n) { var s = (n.kind||'')+'|'+(n.title||'')+'|'+(n.url||''); var h=0; for (var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return 'k'+(h>>>0); }

  function styleOnce() {
    if (document.getElementById('pk-notif-style')) return;
    var css =
      '#pk-bell{position:fixed;bottom:78px;right:18px;z-index:8500;}' +
      '#pk-bell .bbtn{width:46px;height:46px;border-radius:50%;border:1px solid #E2E8F0;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.16);cursor:pointer;font-size:21px;line-height:46px;text-align:center;padding:0;}' +
      '#pk-bell .badge{position:absolute;top:-3px;right:-3px;background:#DC2626;color:#fff;border-radius:11px;min-width:18px;height:18px;font-size:11px;font-weight:700;line-height:18px;text-align:center;padding:0 4px;}' +
      '#pk-bell .panel{position:absolute;bottom:54px;right:0;width:320px;max-width:86vw;max-height:60vh;overflow-y:auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.18);display:none;}' +
      '#pk-bell.open .panel{display:block;}' +
      '#pk-bell .phead{padding:11px 14px;font-weight:700;font-size:14px;border-bottom:1px solid #EEF2F7;color:#0F1A36;}' +
      '#pk-bell .it{display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid #F1F5F9;cursor:pointer;text-decoration:none;color:#0F1A36;}' +
      '#pk-bell .it:hover{background:#F8FAFC;}' +
      '#pk-bell .it .ic{font-size:18px;}' +
      '#pk-bell .it .t{font-size:13.5px;font-weight:600;line-height:1.35;}' +
      '#pk-bell .it .d{font-size:12px;color:#64748B;margin-top:2px;}' +
      '#pk-bell .empty{padding:24px 14px;text-align:center;color:#9AA3B5;font-size:13px;}';
    var st = document.createElement('style'); st.id = 'pk-notif-style'; st.textContent = css; document.head.appendChild(st);
  }

  function pageBase() { return location.pathname.indexOf('/pages/') > -1 ? '' : 'pages/'; }

  function render(items) {
    styleOnce();
    var read = readSet();
    var unread = items.filter(function (n) { return !read.has(keyOf(n)); }).length;

    var el = document.getElementById('pk-bell');
    if (!el) {
      el = document.createElement('div'); el.id = 'pk-bell';
      el.innerHTML = '<button class="bbtn" aria-label="แจ้งเตือน">🔔<span class="badge" style="display:none;"></span></button><div class="panel"></div>';
      document.body.appendChild(el);
      el.querySelector('.bbtn').addEventListener('click', function (e) {
        e.stopPropagation();
        var open = el.classList.toggle('open');
        if (open) {
          var rs = readSet(); items.forEach(function (n) { rs.add(keyOf(n)); }); saveRead(rs);
          var b = el.querySelector('.badge'); b.style.display = 'none';
        }
      });
      document.addEventListener('click', function () { el.classList.remove('open'); });
    }

    var badge = el.querySelector('.badge');
    if (unread > 0) { badge.textContent = unread > 99 ? '99+' : unread; badge.style.display = ''; }
    else badge.style.display = 'none';

    var base = pageBase();
    var panel = el.querySelector('.panel');
    panel.innerHTML = '<div class="phead">การแจ้งเตือน</div>' + (items.length
      ? items.map(function (n) {
          return '<a class="it" href="' + base + esc(n.url) + '.html">' +
            '<span class="ic">' + (ICON[n.kind] || '🔔') + '</span>' +
            '<span><span class="t">' + esc(n.title) + '</span>' +
            (n.detail ? '<span class="d">' + esc(n.detail) + '</span>' : '') + '</span></a>';
        }).join('')
      : '<div class="empty">ไม่มีการแจ้งเตือน</div>');
  }

  async function load() {
    if (!window.supabaseClient) return;
    try {
      var res = await window.supabaseClient.rpc('get_notifications');
      if (res && res.error) return;
      var items = (res && res.data) || [];
      if (!items.length) return;           // no bell when nothing to show
      items.sort(function (a, b) { return new Date(b.ts || 0) - new Date(a.ts || 0); });
      render(items);
    } catch (e) { /* non-critical */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(load, 600); });
  else setTimeout(load, 600);
})();
