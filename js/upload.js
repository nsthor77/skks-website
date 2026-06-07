/* ===========================================================================
   js/upload.js — Self-service image upload to Supabase Storage
   Reusable across pages. Depends on window.supabaseClient (supabase-client.js).
   Usage:
     const url = await skUpload.image(file, 'logos');          // returns public URL
     skUpload.attachPicker({ button, fileInput, dropZone, subfolder:'students',
                             schoolId, onStart, onDone(url), onError(msg) });
   =========================================================================== */
(function () {
  'use strict';

  var BUCKET = 'school-assets';
  var MAX_BYTES = 3 * 1024 * 1024; // 3 MB (matches bucket cap)
  var OK_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'];

  function cleanName(n) {
    var base = (n || 'image').toLowerCase();
    var dot = base.lastIndexOf('.');
    var ext = dot >= 0 ? base.slice(dot) : '';
    var stem = (dot >= 0 ? base.slice(0, dot) : base).replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!stem) stem = 'image';
    return stem.slice(0, 30) + ext;
  }

  // Upload one image file. Returns the public URL string.
  async function image(file, subfolder, schoolId) {
    if (!file) throw new Error('ไม่พบไฟล์');
    if (OK_TYPES.indexOf(file.type) < 0) throw new Error('รองรับเฉพาะรูปภาพ (PNG, JPG, WEBP, GIF, SVG)');
    if (file.size > MAX_BYTES) throw new Error('ไฟล์ใหญ่เกิน 3MB — กรุณาย่อรูปก่อนอัปโหลด');

    var sid = schoolId || window.CURRENT_SCHOOL_ID;
    if (!sid) throw new Error('ไม่พบโรงเรียน (school id)');

    var sb = window.supabaseClient;
    if (!sb || !sb.storage) throw new Error('ระบบจัดเก็บไฟล์ยังไม่พร้อม');

    var path = sid + '/' + (subfolder || 'misc') + '/' + Date.now() + '-' + cleanName(file.name);

    var up = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });
    if (up.error) {
      var m = up.error.message || 'อัปโหลดไม่สำเร็จ';
      // friendlier message for the most common RLS / permission case
      if (/row-level security|denied|not authorized|permission/i.test(m)) {
        m = 'ไม่มีสิทธิ์อัปโหลด (ต้องเป็นเจ้าของหรือผู้ดูแลของโรงเรียนนี้)';
      }
      throw new Error(m);
    }
    var pub = sb.storage.from(BUCKET).getPublicUrl(path);
    return pub.data.publicUrl;
  }

  // Wire a button (and optional drop zone) to pick + upload a file.
  // Returns a function you can call to detach listeners (rarely needed).
  function attachPicker(opts) {
    opts = opts || {};
    var btn = opts.button;
    var input = opts.fileInput;
    var drop = opts.dropZone;
    var sub = opts.subfolder || 'misc';

    function start() { if (opts.onStart) try { opts.onStart(); } catch (e) {} }
    function done(u) { if (opts.onDone) try { opts.onDone(u); } catch (e) {} }
    function fail(m) { if (opts.onError) try { opts.onError(m); } catch (e) {} }

    async function handle(file) {
      if (!file) return;
      start();
      try {
        var schoolId = (typeof opts.schoolId === 'function') ? opts.schoolId() : opts.schoolId;
        var url = await image(file, sub, schoolId);
        done(url);
      } catch (e) {
        fail(e.message || String(e));
      }
    }

    if (btn && input) {
      btn.addEventListener('click', function (e) { e.preventDefault(); input.click(); });
      input.addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        handle(f);
        input.value = ''; // allow re-picking the same file
      });
    }

    if (drop) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.remove('drag'); });
      });
      drop.addEventListener('drop', function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        handle(f);
      });
    }
  }

  window.skUpload = { image: image, attachPicker: attachPicker, BUCKET: BUCKET, MAX_BYTES: MAX_BYTES };
})();
