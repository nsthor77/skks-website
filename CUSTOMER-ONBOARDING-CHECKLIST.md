# 📋 PanyaSchoolKit — Customer Onboarding Checklist

> **เอกสารนี้คือสิ่งที่ลูกค้าต้องทำเอง** เพื่อให้ระบบทำงานเต็มประสิทธิภาพ
> ผมจะรวบรวมระหว่างพัฒนา แล้วจัดทำคู่มือสุดท้ายตอน Sprint 16

---

## 🎯 Phase 1: Account Setup (วันที่สมัคร)

### ✅ 1.1 สมัครใช้งาน PanyaSchoolKit
- ไป https://panyaschoolkit.com
- กรอกข้อมูลโรงเรียน
- ใส่บัตรเครดิตเพื่อเริ่ม Trial 14 วัน
- โรงเรียนจะได้ subdomain: `{slug}.panyaschoolkit.com`

### ✅ 1.2 ตั้งค่าโปรไฟล์โรงเรียน
- Login → Settings → School Profile
- กรอก: ที่อยู่, เบอร์โทร, อีเมล, โลโก้
- (Optional) เชื่อม Custom Domain เช่น `school.com`

### ✅ 1.3 เพิ่มผู้ใช้ระดับ Staff
- Settings → Users → Invite Users
- ส่ง invite codes ให้ครู / ฝ่ายธุรการ
- กำหนด role: staff / owner / developer

---

## 🎯 Phase 2: Data Setup (สัปดาห์แรก)

### ✅ 2.1 กำหนดวิชา (Subjects)
- ไป `/pages/subjects-config.html` (เฉพาะ owner/developer)
- เพิ่มวิชาที่สอนในโรงเรียน เช่น:
  - MATH — คณิตศาสตร์
  - ENG — ภาษาอังกฤษ
  - SCI — วิทยาศาสตร์
  - ฯลฯ

### ✅ 2.2 กำหนด Custom Fields นักเรียน (ถ้ามี)
- ไป `/pages/student-fields-config.html`
- เพิ่มฟิลด์เฉพาะของโรงเรียน เช่น:
  - Passport Number (นานาชาติ)
  - กลุ่มเลือด
  - กีฬาที่เล่น (multi-select)

### ✅ 2.3 กำหนด Custom Fields ครู (ถ้ามี)
- ไป `/pages/teacher-fields-config.html`
- เพิ่มฟิลด์เฉพาะ เช่น:
  - ภาษาที่พูดได้
  - การอบรมพิเศษ
  - LINE ID

### ✅ 2.4 Import นักเรียน
- ไป `/pages/students.html` → Import CSV
- Download template ก่อน
- เติมข้อมูล → upload

### ✅ 2.5 Import ครู
- ไป `/pages/teachers.html` → Import CSV
- Download template ก่อน
- เติมข้อมูล → upload

---

## 🎯 Phase 3: LINE Messaging Setup (Sprint 12) ⚠️ สำคัญ

### ✅ 3.1 สมัคร LINE Official Account (LINE OA)

🔗 https://www.linebiz.com/th/

**ขั้นตอน:**
1. คลิก "เริ่มต้นใช้งานฟรี"
2. Login ด้วย LINE account
3. สร้าง LINE OA สำหรับโรงเรียน
   - ชื่อ: "โรงเรียน[ชื่อ]"
   - หมวด: Education
   - คำอธิบาย: ใช้สำหรับแจ้งเตือนผู้ปกครอง
4. ยืนยันตัวตน (Verification) — รอ 1-3 วัน

**ฟรี:** 1,000 ข้อความ/เดือน (เพียงพอสำหรับโรงเรียนเล็ก-กลาง)  
**เสียเงิน:** ถ้าเกิน 1,000 ข้อความ → Light plan 1,200 บาท/เดือน

### ✅ 3.2 สร้าง Messaging API Channel

🔗 https://developers.line.biz/console/

**ขั้นตอน:**
1. Login → Create Provider (ใส่ชื่อบริษัท/โรงเรียน)
2. สร้าง Channel → เลือก **Messaging API**
3. ผูกกับ LINE OA ที่สมัครใน Step 3.1
4. ไป tab **"Messaging API"** → scroll หา **"Channel access token (long-lived)"**
5. กด **Issue** → คัดลอก token (ตัวยาวๆ ~170 ตัวอักษร)

### ✅ 3.3 ตั้งค่าใน PanyaSchoolKit

ส่ง Channel Access Token ให้ทีม PanyaSchoolKit หรือทำเอง:

```sql
-- ทีม run SQL นี้ใน Supabase
UPDATE schools SET line_settings = jsonb_build_object(
  'enabled', true,
  'channel_access_token', 'YOUR_TOKEN_HERE',
  'default_template', '🎓 {student_name} {action} เวลา {time}'
) WHERE id = 'YOUR_SCHOOL_ID';
```

### ✅ 3.4 ผู้ปกครอง follow LINE OA

ขั้นตอนของผู้ปกครอง:
1. สแกน QR Code ของ LINE OA โรงเรียน
2. กดเพิ่มเป็นเพื่อน
3. ผู้ปกครองส่งข้อความ "ลงทะเบียน" หรือกดปุ่มในเมนู
4. โรงเรียนเก็บ LINE User ID ของผู้ปกครองใน `students.custom_data.parent_line_user_id`

> **Future enhancement:** Sprint หลังจะมี LINE Login flow ให้ auto-link

---

## 🎯 Phase 4: Payment Setup (เก็บเงินค่าเทอม)

### ✅ 4.1 สมัคร PromptPay (สำหรับโรงเรียน)
- ไปธนาคารที่มีบัญชีนิติบุคคล
- ขอเปิด PromptPay ด้วยเลขผู้เสียภาษี (Tax ID) ของโรงเรียน
- ระบบจะสร้าง QR Code อัตโนมัติให้ผู้ปกครองสแกนจ่าย

### ✅ 4.2 เชื่อม Payment Gateway (Optional — ถ้ารับบัตรเครดิตจากผู้ปกครอง)
- Omise (แนะนำ) หรือ Stripe Thailand
- ค่าธรรมเนียม ~3.65% + 5 บาท ต่อ transaction

---

## 🎯 Phase 5: Email Setup (รับ-ส่ง email)

### ✅ 5.1 Custom Domain Email (Optional)
- ถ้าใช้ domain ของโรงเรียน เช่น `noreply@yourschool.com`
- เพิ่ม DNS records: MX, SPF, DKIM
- (PanyaSchoolKit จะใช้ Resend ส่งให้)

### ✅ 5.2 Default ใช้ noreply@panyaschoolkit.com
- ถ้าไม่อยากตั้ง custom domain → ใช้ default
- ผู้ปกครองจะเห็นชื่อผู้ส่งเป็น "PanyaSchoolKit"

---

## 🎯 Phase 6: Marketing & Launch

### ✅ 6.1 เตรียมเอกสารโรงเรียน
- ใบสมัครเรียน (PDF)
- ค่าธรรมเนียม + วิธีจ่าย
- ปฏิทินกิจกรรม

### ✅ 6.2 สร้างเว็บไซต์โรงเรียน (Optional)
- ใช้ PanyaSchoolKit เว็บโรงเรียนในตัว
- หรือเชื่อม Custom Domain

### ✅ 6.3 แจ้งผู้ปกครอง
- ส่ง email/LINE ให้ผู้ปกครองทุกคน
- สอนวิธี login + ดูข้อมูลลูก

---

## 📞 Support

| ปัญหา | ติดต่อ |
|---|---|
| Technical Issues | support@panyaschoolkit.com |
| Billing | billing@panyaschoolkit.com |
| LINE OA Setup | LINE Help Center |
| PromptPay | ธนาคารของคุณ |

---

**Last updated:** 2026-05-27  
**Sprint:** Sprint 12 — Attendance + LINE Messaging
