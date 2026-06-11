// slip-qr.js — อ่าน QR จากรูปสลิปโอนเงิน (ฝั่ง client, ฟรี ไม่มี API)
// ใช้งาน: const ref = await window.slipQR.decode(file); // -> string | null
(function () {
  let jsQRLoading = null;

  // โหลด jsQR จาก CDN ครั้งเดียว (lazy + cache promise)
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (jsQRLoading) return jsQRLoading;
    jsQRLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      s.onload = () => resolve(window.jsQR);
      s.onerror = () => { jsQRLoading = null; reject(new Error('jsQR load failed')); };
      document.head.appendChild(s);
    });
    return jsQRLoading;
  }

  // แปลง File -> Image element
  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
      img.src = url;
    });
  }

  // วาดรูปลง canvas (จำกัดขนาดสูงสุด) แล้วลอง decode
  function decodeAtSize(img, maxDim) {
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) return null;
    const scale = Math.min(1, maxDim / Math.max(natW, natH));
    const w = Math.max(1, Math.round(natW * scale));
    const h = Math.max(1, Math.round(natH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    return window.jsQR(imageData.data, w, h);
  }

  // อ่าน QR จากไฟล์รูป — คืน string (ตัดไม่เกิน 500 ตัวอักษร) หรือ null ถ้าอ่านไม่ได้
  async function decode(file) {
    try {
      if (!file) return null;
      await loadJsQR();
      const { img, url } = await fileToImage(file);
      try {
        let code = decodeAtSize(img, 1200);
        if (!code) code = decodeAtSize(img, 1600); // ลองอีกครั้งที่ความละเอียดสูงขึ้น
        if (code && code.data) {
          const data = String(code.data).trim();
          return data ? data.slice(0, 500) : null;
        }
        return null;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      return null; // อ่านไม่ได้ = ไม่บล็อกการส่งสลิป
    }
  }

  window.slipQR = { decode };
})();
