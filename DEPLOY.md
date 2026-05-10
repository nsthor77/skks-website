# 🚀 คู่มือ Deploy SKKS — สำหรับมือใหม่

คู่มือนี้พาคุณ Deploy เว็บ SKKS ขึ้น **suansonkk.com** ทีละขั้น ใช้เวลาประมาณ **30-45 นาที**

ไม่ต้องลงโปรแกรมอะไร ทำผ่านเว็บเบราว์เซอร์ทั้งหมด!

---

## 📋 สิ่งที่คุณมีอยู่แล้ว

- ✅ บัญชี GitHub
- ✅ โดเมน suansonkk.com (Namecheap)
- ✅ ไฟล์เว็บใน zip

## 🎯 สิ่งที่จะได้ตอนจบ

- 🌐 เว็บไซต์ออนไลน์ที่ https://suansonkk.com
- 🔒 SSL (https://) อัตโนมัติ ฟรี
- 🔄 อัปเดตเว็บได้ตลอด แค่อัปโหลดไฟล์

---

## ขั้นตอนรวม 3 ส่วน

```
1️⃣ GitHub  →  อัปโหลดไฟล์เว็บ
2️⃣ Vercel  →  เชื่อมกับ GitHub และ Deploy
3️⃣ Namecheap → ชี้โดเมน suansonkk.com มาที่ Vercel
```

---

# 1️⃣ อัปโหลดเว็บไซต์ขึ้น GitHub

### Step 1.1 — สร้าง Repository ใหม่

1. เข้า https://github.com แล้วล็อกอิน
2. คลิกปุ่ม **"+"** มุมบนขวา → เลือก **"New repository"**

3. กรอกข้อมูล:
   - **Repository name**: `skks-website`
   - **Description**: `Suanson Khon Kaen School Website`
   - เลือก **Public** (ฟรี + Vercel เชื่อมต่อได้)
   - ☑️ **Add a README file** (ติ๊กถูก)

4. คลิก **"Create repository"**

### Step 1.2 — อัปโหลดไฟล์เว็บ

1. ในหน้า repo ที่เพิ่งสร้าง คลิก **"Add file"** → **"Upload files"**

2. **แตก zip** `skks-website.zip` ในเครื่องคุณก่อน — จะได้โฟลเดอร์ `skks-website/`

3. **เปิดโฟลเดอร์ `skks-website`** แล้วเลือกไฟล์/โฟลเดอร์ทั้งหมด **"ภายใน"** โฟลเดอร์ (ไม่ใช่โฟลเดอร์ตัวมันเอง):
   ```
   index.html
   404.html
   robots.txt
   sitemap.xml
   vercel.json
   .gitignore
   README.md
   css/
   js/
   pages/
   images/
   ```

4. **ลากไปวาง** ในกรอบ "Drag files here" บนหน้าเว็บ GitHub

5. รอให้ไฟล์ทั้งหมดอัปโหลดเสร็จ (ประมาณ 1-2 นาที)

6. ด้านล่างเลื่อนลงมา ในช่อง **"Commit changes"**:
   - กรอก: `Initial commit - SKKS website`
   - คลิกปุ่มเขียว **"Commit changes"**

✅ **เสร็จขั้นที่ 1!** ตอนนี้ไฟล์ขึ้น GitHub แล้ว

---

# 2️⃣ Deploy ผ่าน Vercel

### Step 2.1 — สมัคร Vercel ด้วย GitHub

1. เข้า https://vercel.com
2. คลิก **"Sign Up"** มุมบนขวา
3. เลือก **"Continue with GitHub"**
4. กด **"Authorize Vercel"** อนุญาตให้ Vercel ดู repo ของคุณ
5. กรอกข้อมูลพื้นฐาน (ชื่อ, ใช้แบบส่วนตัว/ฟรี)

### Step 2.2 — Import Project

1. ที่หน้า Dashboard ของ Vercel คลิก **"Add New..."** → **"Project"**

2. คุณจะเห็นรายชื่อ repo จาก GitHub — หา **`skks-website`** แล้วคลิก **"Import"**

   > ถ้าไม่เห็น repo → คลิก "Adjust GitHub App Permissions" → อนุญาตให้ Vercel เข้าถึง repo นี้

3. ในหน้า Configure Project:
   - **Project Name**: ปล่อยเป็น `skks-website` หรือเปลี่ยนได้
   - **Framework Preset**: เลือก **"Other"** (เพราะเป็น HTML ธรรมดา)
   - **Root Directory**: ปล่อยว่าง (= /)
   - ส่วนอื่นๆ ปล่อยตามค่า default

4. คลิก **"Deploy"** 🚀

5. รอประมาณ 30 วินาที — Vercel จะ build และ deploy ให้

6. เสร็จแล้วจะเห็นข้อความ **"Congratulations!"** พร้อม URL ชั่วคราว เช่น:
   ```
   https://skks-website-xyz.vercel.app
   ```

7. **คลิกที่ URL เพื่อดูเว็บได้แล้ว!** 🎉

✅ **เสร็จขั้นที่ 2!** เว็บออนไลน์แล้ว แต่ยังเป็น URL ของ Vercel

---

# 3️⃣ ตั้ง Domain suansonkk.com

### Step 3.1 — เพิ่มโดเมนใน Vercel

1. ที่ Vercel Dashboard เปิด project **`skks-website`**
2. ไปที่แท็บ **"Settings"** ด้านบน
3. เลือกเมนู **"Domains"** ทางซ้าย
4. ในช่อง "Add Domain" พิมพ์:
   ```
   suansonkk.com
   ```
5. คลิก **"Add"**

6. Vercel จะแสดงคำแนะนำ DNS — มีให้เลือก 2 แบบ:

   **แบบ A (แนะนำ — ใช้ A Record):**
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   ```
   
   > 💡 **สำคัญ**: Vercel อาจแสดง IP ที่เฉพาะเจาะจงสำหรับ project ของคุณ (เร็วกว่า) — ถ้าหน้า Domain ของ Vercel แสดง IP อื่น **ให้ใช้ IP ที่ Vercel แสดง** ตามนั้นจะดีกว่า
   
   **แบบ B (ใช้ Nameservers ของ Vercel):**
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```

   👉 **แนะนำใช้แบบ A** เพราะง่ายกว่า ไม่ต้องเปลี่ยน Nameserver ทั้งหมด

7. **อย่าเพิ่งปิดหน้านี้** — ไปทำขั้นตอนถัดไปก่อน แล้วกลับมาเช็ก

### Step 3.2 — เพิ่ม www subdomain (ทำเพื่อให้ www.suansonkk.com ก็ใช้ได้)

1. กลับมาที่ "Add Domain" 
2. พิมพ์: `www.suansonkk.com`
3. คลิก **"Add"**
4. Vercel จะแสดงค่า:
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

### Step 3.3 — ตั้ง DNS ใน Namecheap

1. เข้า https://namecheap.com แล้วล็อกอิน
2. ไปที่ **"Domain List"** ทางซ้าย
3. หา **suansonkk.com** แล้วคลิก **"Manage"**
4. คลิกแท็บ **"Advanced DNS"**

5. ในส่วน **"Host Records"** — **ลบ records เก่าทั้งหมด** ที่มีอยู่ (กดถังขยะ 🗑️)

6. คลิก **"Add New Record"** แล้วเพิ่ม **2 records**:

   **Record ที่ 1:**
   ```
   Type:  A Record
   Host:  @
   Value: 76.76.21.21
   TTL:   Automatic
   ```

   **Record ที่ 2:**
   ```
   Type:  CNAME Record
   Host:  www
   Value: cname.vercel-dns.com
   TTL:   Automatic
   ```

7. คลิก **"Save All Changes"** ✅

### Step 3.4 — รอ DNS Propagate

- DNS ใช้เวลา **5 นาที - 1 ชั่วโมง** กว่าจะเชื่อม (บางกรณี 24 ชม.)
- กลับไปที่ Vercel → Domains
- รีเฟรชหน้า — ถ้าเชื่อมสำเร็จจะเห็นเครื่องหมาย ✅ สีเขียว
- Vercel จะออก SSL (https) ให้อัตโนมัติฟรี

🎉 **เสร็จสมบูรณ์!** เปิดเบราว์เซอร์แล้วเข้า https://suansonkk.com

---

# 🔄 วิธีอัปเดตเว็บในอนาคต

ทุกครั้งที่อยากแก้ไขเว็บ:

### วิธีที่ 1 — แก้ผ่าน GitHub Web (มือใหม่ใช้ได้)

1. เข้า https://github.com/USERNAME/skks-website
2. หาไฟล์ที่อยากแก้ (เช่น `index.html`)
3. คลิกที่ไฟล์ → คลิกไอคอนดินสอ ✏️ มุมขวาบน
4. แก้ไขเสร็จ → เลื่อนลงมาล่าง → คลิก **"Commit changes"**
5. **Vercel จะ deploy ใหม่อัตโนมัติภายใน 30 วินาที!**

### วิธีที่ 2 — อัปโหลดไฟล์ใหม่ทั้งโฟลเดอร์

1. **"Add file"** → **"Upload files"** ใน GitHub
2. ลากไฟล์ใหม่มาวาง → **"Commit changes"**
3. Vercel deploy ใหม่อัตโนมัติ

---

# ❓ ปัญหาที่อาจพบ + วิธีแก้

### ❌ "เว็บโหลดไม่ขึ้น / DNS_PROBE_FINISHED_NXDOMAIN"
- **สาเหตุ**: DNS ยังไม่ propagate
- **แก้**: รอ 30 นาที - 2 ชั่วโมง แล้วลองใหม่
- เช็คได้ที่ https://dnschecker.org → กรอก suansonkk.com

### ❌ ไม่เห็น repo ใน Vercel
- กลับไป https://github.com/settings/installations
- คลิก "Configure" ที่ Vercel
- เพิ่ม repo `skks-website` ใน list

### ❌ รูปไม่ขึ้น
- เช็คว่าไฟล์รูปอยู่ในโฟลเดอร์ `images/` ตอนอัปโหลด
- เช็คว่าชื่อไฟล์เหมือนกันทุกตัวอักษร (case-sensitive)

### ❌ หน้า admin (dashboard) เปิดไม่ได้
- ตรวจสอบว่าโฟลเดอร์ `pages/` ถูกอัปโหลด
- URL ที่ถูกคือ: https://suansonkk.com/pages/dashboard.html

### ❌ "Domain is already in use"
- โดเมนถูกใช้ในบัญชี Vercel อื่น
- ติดต่อ Vercel support หรือใช้บัญชีนั้น

---

# 💰 ค่าใช้จ่าย

| บริการ | ค่าใช้จ่าย |
|--------|----------|
| GitHub (Public repo) | ฟรี |
| Vercel (Hobby plan) | ฟรี |
| Namecheap (โดเมน) | ~400-500 บาท/ปี |
| **รวม** | **~40 บาท/เดือน** |

Vercel Hobby plan ฟรีให้:
- ✅ Bandwidth 100GB/เดือน (เพียงพอสำหรับเว็บโรงเรียน)
- ✅ SSL ฟรี
- ✅ Deploy ไม่จำกัดครั้ง
- ✅ Custom domain
- ✅ CDN ทั่วโลก

---

# 📞 หากติดปัญหา

1. **Vercel Docs**: https://vercel.com/docs
2. **Namecheap DNS Help**: https://www.namecheap.com/support/knowledgebase/category/2200/
3. **กลับมาถามผมได้เลย** — บอกว่าติดปัญหาอะไร ผมจะช่วยแก้

---

## ✅ Checklist ก่อนเริ่ม

- [ ] ล็อกอิน GitHub ได้
- [ ] ล็อกอิน Namecheap ได้
- [ ] แตก `skks-website.zip` แล้ว
- [ ] อ่านคู่มือนี้จบแล้ว

พร้อมแล้ว → เริ่มขั้น 1️⃣ ได้เลย 🚀

---

© 2026 SKKS — Suanson Khon Kaen School
