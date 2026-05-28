# 🚀 PanyaSchoolKit — Launch Readiness Checklist

> เช็คลิสต์ก่อนเปิดรับลูกค้าจริง (เปลี่ยนจาก waitlist → เปิดขาย)
> แบ่งเป็น: 🔴 ต้องทำก่อนเปิด · 🟡 ควรทำ · 🟢 ทำทีหลังได้
> Last updated: 2026-05-28 (หลัง Sprint 16)

---

## 🔴 BLOCKER — ต้องทำก่อนเปิดรับเงินจริง

### 1. รัน SQL migrations ที่ค้าง (Supabase)
รันตามลำดับใน SQL Editor (staging ก่อน แล้วค่อย prod):
- [ ] `sql/sprint-14-schedule.sql` (ตารางเรียน)
- [ ] `sql/sprint-14.6-multi-teacher.sql` (co-teaching)
- [ ] `sql/sprint-15-tuition-bills.sql` (documentation — safe additive, เช็ค promptpay_id)
- ตรวจ: `SELECT public.get_periods();` → ได้ `[]` = OK

### 2. Omise Live Mode (ตอนนี้ยังเป็น Test keys!)
- [ ] เปิดบัญชี Omise live + ยืนยันเอกสารบริษัท (Panya Ventures Co., Ltd.)
- [ ] เปลี่ยน Vercel env: `OMISE_PUBLIC_KEY` + `OMISE_SECRET_KEY` → live keys (`pkey_...` / `skey_...`)
- [ ] เปลี่ยน Omise webhook endpoint → production URL
- [ ] ทดสอบจ่ายจริงด้วยบัตรจริง 1 ครั้ง (ยอดเล็ก) แล้ว refund
- 📄 ดูรายละเอียดใน `OMISE-LIVE-MODE-PLAN.md`
- ⚠️ **หมายเหตุ:** นี่คือ SaaS subscription (โรงเรียนจ่ายเรา) — ส่วน PromptPay ของลูกค้า (ผู้ปกครองจ่ายโรงเรียน) ไม่ผ่าน Omise ไม่ต้องรอ

### 3. Vercel Spend Limit (review)
- [ ] ตอนนี้ตั้ง On-Demand $30 + Pause ON (กัน pre-launch)
- [ ] **ก่อนเปิดจริง:** ปิด "Pause Production Deployments" (เว็บห้ามล่มตอนมีลูกค้า) + เพิ่ม budget เป็น $100-200
- หน้า: vercel.com/nsthor77s-projects/~/settings/billing

### 4. ปิด Waitlist mode → เปิดสมัครจริง
- [ ] Marketing site (panyaschoolkit-marketing): เปลี่ยน CTA จาก "จองคิว" → "เริ่มใช้งาน / สมัคร"
- [ ] ปลดบล็อก public signup (Sprint 9.B.6 บล็อกไว้ → redirect to waitlist)
- [ ] ทดสอบ signup flow ครบ: สมัคร → ใส่บัตร → trial active → เข้า dashboard

---

## 🟡 ควรทำก่อนเปิด (ลดความเสี่ยง)

### 5. Email domain verify
- [ ] Resend: ยืนยัน `panyaschoolkit.com` ครบทุก record (DKIM/SPF/DMARC)
- [ ] เปลี่ยน Vercel env `EMAIL_FROM` = `PanyaSchoolKit <noreply@panyaschoolkit.com>` (ตอนนี้ยัง `onboarding@resend.dev`)

### 6. Privacy Policy + Cookie Consent (Sprint 9.6.3 ค้าง)
- [ ] อัพเดต privacy.html ให้ครอบคลุม feature ใหม่ (LINE, payment slip, grades)
- [ ] PDPA compliance: ระบุการเก็บข้อมูลนักเรียน/ผู้ปกครอง

### 7. Security review
- [ ] JWT: ตอนนี้ decode แบบ manual (ไม่ verify signature) ใน serverless functions → ควรเพิ่ม JWKS verification
- [ ] ตรวจ RLS ทุกตารางใหม่ (schedule_slots, popor_documents, bills, payment_slips) ว่า student/parent เห็นเฉพาะของตัวเอง
- [ ] ✅ test-charge.js ลบแล้ว (Sprint 8.E)

### 8. Supabase headroom
- [ ] เช็ค database size + bandwidth usage (Supabase dashboard)
- [ ] ตอนนี้ Pro $25/mo เพียงพอ ~20-30 โรงเรียน — จับตาเมื่อโต

---

## 🟢 ทำทีหลังได้ (post-launch)

### 9. DNS wildcard subdomains (Tech Debt #66)
- [ ] ย้าย panyaschoolkit.com DNS → Vercel nameservers (เพื่อ `{slug}.panyaschoolkit.com` ทุก tenant)
- ตอนนี้ใช้ custom_domain ต่อ tenant ได้อยู่แล้ว ไม่ blocker

### 10. Onboarding Wizard (Sprint 16.X)
- [ ] แปลง `CUSTOMER-ONBOARDING-CHECKLIST.md` เป็น in-app wizard
- ลดภาระ support (คอขวดจริงตอนโต)

### 11. Email confirm webhook (Sprint 9.B.7)
- [ ] Supabase Database Webhook สำหรับ waitlist confirm

---

## ✅ ระบบที่พร้อมแล้ว (core features done)

| Module | สถานะ |
|---|---|
| Multi-tenant + subdomain | ✅ |
| SaaS billing (Omise subscription) | ✅ (test mode) |
| Students + custom fields + CSV | ✅ |
| Teachers + Subjects + custom fields | ✅ |
| Attendance + LINE notify | ✅ |
| Grades + Report Card PDF | ✅ |
| ปพ.1/5/6 (Thai gov reports) | ✅ |
| Class Schedule + Co-teaching | ✅ |
| Tuition Bills + PromptPay dynamic QR | ✅ |
| Analytics Dashboard | ✅ |
| Bilingual EN/TH | ✅ |
| Mobile responsive | ✅ (audited Sprint 16) |

---

## 📞 Pre-launch test accounts
- Owner: (SKKS owner login)
- Test parent + test student: ใช้ทดสอบ flow บิล/เกรด/ตาราง
- Developer: admin panel access

**Sprint:** Sprint 16 — Launch Prep
