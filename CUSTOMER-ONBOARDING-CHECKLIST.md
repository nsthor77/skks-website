# 📋 PanyaSchoolKit — Customer Onboarding Checklist

> **เอกสารนี้คือสิ่งที่ลูกค้าต้องทำเอง** เพื่อให้ระบบทำงานเต็มประสิทธิภาพ
> ผมจะรวบรวมระหว่างพัฒนา แล้วจัดทำคู่มือสุดท้ายตอน Sprint 16
>
> ✅ **มี In-App Wizard แล้ว (Sprint 16.X):** ลูกค้าเข้า `/pages/onboarding.html` (เมนู "🚀 Setup Guide")
> จะเห็น progress bar + ขั้นตอนทั้งหมดพร้อมสถานะ ✓/ยังไม่ทำ + ปุ่มลิงก์ไปตั้งค่าแต่ละจุด
> ระบบ detect อัตโนมัติว่าทำขั้นไหนเสร็จแล้ว (เช็คจากข้อมูลจริงในฐานข้อมูล) — เอกสารนี้เป็นรายละเอียดเสริม

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

### ✅ 2.4 Import นักเรียน (Smart Import — รองรับ Excel!)
- ไป `/pages/students.html` → กด **"📥 Import Excel/CSV"**
- **อัปโหลดไฟล์ Excel เดิมของโรงเรียนได้เลย** (.xlsx / .csv) — ไม่ต้อง Save As CSV ก่อน
- ระบบ**จับคู่คอลัมน์อัตโนมัติ** (รองรับหัวคอลัมน์ภาษาไทย เช่น ชื่อ นามสกุล ห้อง เพศ)
- ตรวจการจับคู่ → ดูตัวอย่าง → นำเข้า
- ระบบแปลงค่าให้: เพศ (ชาย/หญิง→male/female), วันที่ (พ.ศ.→ค.ศ. อัตโนมัติ)
- แถวที่ผิดจะถูกข้าม + แสดงรายงานว่าแถวไหนผิดเพราะอะไร

### ✅ 2.5 Import ครู (Smart Import เหมือนกัน)
- ไป `/pages/teachers.html` → กด **"📥 Import Excel/CSV"**
- อัปโหลด Excel เดิม → จับคู่คอลัมน์ → นำเข้า (เหมือนนักเรียน)

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

### ✅ 4.1 สมัคร PromptPay (สำหรับโรงเรียน) — แนะนำที่สุด ไม่มีค่าธรรมเนียม!
- ไปธนาคารที่มีบัญชีนิติบุคคล
- ขอเปิด **PromptPay ด้วยเลขผู้เสียภาษี (Tax ID)** ของโรงเรียน หรือเบอร์โทร
- **ไม่มีค่าธรรมเนียม** ต่างจากบัตรเครดิต (Omise หัก 3.65%)

### ✅ 4.2 ตั้งค่า PromptPay ในระบบ (Sprint 15 — Dynamic QR)
- ไป `/pages/payment-settings.html` (owner)
- กรอก **PromptPay ID** (เบอร์ 10 หลัก หรือ Tax ID 13 หลัก) + ชื่อบัญชี + ธนาคาร
- ⭐ **ระบบจะสร้าง QR ที่ฝังยอดเงินอัตโนมัติ**ให้แต่ละบิล → ผู้ปกครองสแกนแล้วยอดขึ้นเลย ไม่ต้องพิมพ์เอง (ลดความผิดพลาด)
- ไม่ต้องอัปรูป QR แบบเก่าแล้ว (ยังรองรับเป็น fallback)

### ✅ 4.3 ออกบิล + รับชำระ (flow ทั้งหมด)
1. **ออกบิล:** `/pages/create-bills.html` → สร้างทีละคน หรือ bulk ทั้งห้อง
2. **ผู้ปกครองจ่าย:** `/pages/parent-bills.html` → สแกน QR (ยอดขึ้นอัตโนมัติ) → โอน → อัปสลิป
3. **ครูตรวจ:** `/pages/payment-approvals.html` → อนุมัติสลิป → บิลเปลี่ยนเป็น "ชำระแล้ว" + บันทึกลงบัญชีอัตโนมัติ
4. **ดูบัญชี:** `/pages/finance.html` → รายรับรายจ่ายทั้งหมด

### ✅ 4.4 เชื่อม Payment Gateway (Optional — ถ้าอยากรับบัตรเครดิตด้วย)
- Omise (แนะนำ) ที่ `/pages/payment-gateways.html`
- ค่าธรรมเนียม ~3.65% + 5 บาท ต่อ transaction (แพงกว่า PromptPay — ใช้เฉพาะถ้าจำเป็น)

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

## 🎯 Phase 7: ปพ. Documents (Sprint 13.7) — เอกสารทางการกระทรวงศึกษา

### ✅ 7.1 ตรวจชื่อโรงเรียน + ที่อยู่
- ไปที่ Settings → School Profile
- กรอกให้ครบ: `name_th`, `name_en`, `address_th`, `district`, `province`
- ข้อมูลเหล่านี้จะปรากฏใน header ของ ปพ.1 / ปพ.5 / ปพ.6

### ✅ 7.2 กรอกข้อมูลพ่อ-แม่ของนักเรียน
- ใน student profile → custom fields ใส่:
  - `father_name` — ชื่อบิดา
  - `mother_name` — ชื่อมารดา
  - `national_id` — เลขประจำตัวประชาชน
- ฟิลด์เหล่านี้จะแสดงใน ปพ.1 อัตโนมัติ

### ✅ 7.3 ดาวน์โหลด ปพ. แต่ละแบบ
- **ปพ.1** (Transcript): `/pages/my-grades.html` → กดปุ่ม "📄 ปพ.1"  
  หรือใน student detail (staff) → ปุ่มดาวน์โหลด ปพ.1
- **ปพ.5** (Class Roster): `/pages/grades-admin.html` → เลือกห้อง + ปี + เทอม → กด "📊 ปพ.5"
- **ปพ.6** (Progress Book): `/pages/my-grades.html` → เลือกปี + เทอม → กดปุ่ม "📋 ปพ.6"

### ⚠️ 7.4 หมายเหตุการใช้งาน
- เลขที่เอกสาร (serial) ออกอัตโนมัติเมื่อ download (ใช้ `?issue=true` ใน URL)
- snapshot ของข้อมูลเก็บไว้ใน `popor_documents` table — เผื่อข้อมูลเปลี่ยนภายหลัง
- รูปนักเรียน, ตราโรงเรียน, ลายเซ็น = ยังต้องประทับด้วยมือ (Sprint 16: optional image upload)
- ถ้ารูปแบบ ปพ. ของโรงเรียนต่างจากมาตรฐาน → แจ้งเราเพื่อ custom layout

---

## 🎯 Phase 8: Class Schedule (Sprint 14) — ตารางเรียน

### ✅ 8.1 ตั้งคาบเรียนของโรงเรียน (ครั้งเดียว)
- ไป `/pages/schedule-admin.html` → กดปุ่ม **"⏰ Manage Periods"**
- หรือกด **"⚡ Use Default Template"** (8 คาบมาตรฐาน 50 นาที)
- ทำเครื่องหมาย "พัก" สำหรับช่วงพักเช้า/พักกลางวัน
- คาบที่เป็น "พัก" จะใส่วิชาไม่ได้ (lock อัตโนมัติ)

### ✅ 8.2 สร้างตารางเรียนรายห้อง
- เลือก **ปีการศึกษา** + **เทอม** + **ห้องเรียน**
- คลิกช่องว่างในตาราง → popup ให้เลือก:
  - วิชา (จาก subjects ที่ตั้งไว้)
  - ครูผู้สอน (จาก teachers list)
  - ห้องเรียน (ถ้ามี เช่น "Lab 1", "อาคาร 3 ห้อง 301")
  - หมายเหตุ (optional)
- ⚠️ **Conflict detection อัตโนมัติ:**
  - ครูคนเดียวกัน 2 ห้องพร้อมกัน → เตือนทันที
  - ห้องเรียนเดียวกัน 2 คาบพร้อมกัน → เตือนทันที

### ✅ 8.3 ทำซ้ำทุกห้อง
- ทำตารางของแต่ละห้องให้ครบ
- ระหว่างทำห้องอื่น ระบบตรวจ conflict ข้ามห้องให้

### ✅ 8.4 นักเรียน/ผู้ปกครองเห็นตารางที่:
- `/pages/my-schedule.html` (ตารางของห้องลูก)
- มีหน้า **"NEXT CLASS"** บอกคาบถัดไปแบบ real-time
- ดาวน์โหลด PDF ได้

### ✅ 8.5 ครูเห็นตารางสอนตัวเองที่:
- `/pages/teacher-schedule.html` (staff/owner เลือกครูได้)
- มี stats: คาบรวม, จำนวนห้อง, จำนวนวิชา
- ใช้ดูภาระงานก่อนเปิดเทอม

### ✅ 8.6 สอนคู่ (Co-teaching) — สำหรับ EP/นานาชาติ
- 1 คาบใส่ครูได้**หลายคน** (เช่น ครูต่างชาติ 1 + ครูไทย 2)
- ในช่องแก้ไข → เลือกครู + บทบาท (ครูหลัก/ครูไทย/ครูต่างชาติ/ครูผู้ช่วย) → กด "เพิ่ม"
- ครูต่างชาติจะมีสัญลักษณ์ 🌐 หน้าชื่อ
- **Conflict detection ฉลาด:** ครู 2 คนในห้องเดียวกันคาบเดียว = OK (สอนคู่) / ครูคนเดียวอยู่ 2 ห้องเวลาเดียว = เตือน
- หน้าตารางจะโชว์ **จำนวนนักเรียน**ของห้องนั้นด้วย (ดึงจากฐานข้อมูลนักเรียน)

---

## 📞 Support

| ปัญหา | ติดต่อ |
|---|---|
| Technical Issues | support@panyaschoolkit.com |
| Billing | billing@panyaschoolkit.com |
| LINE OA Setup | LINE Help Center |
| PromptPay | ธนาคารของคุณ |
| ปพ. Custom Format | support@panyaschoolkit.com |

---

**Last updated:** 2026-05-28  
**Sprint:** Sprint 14 — Class Schedule (Timetable)
