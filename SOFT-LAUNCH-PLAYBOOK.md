# 🌱 PanyaSchoolKit — Soft Launch Playbook

> **กลยุทธ์:** เริ่มใช้งานจริงกับ SKKS + รับโรงเรียนเพื่อน 2-3 แห่งแบบ manual
> **ไม่ต้องรอ Omise live (3-4 สัปดาห์)** — เก็บค่าระบบแบบโอน/วางบิลเองไปก่อน
> Last updated: 2026-05-28

---

## 🎯 ทำไมต้อง Soft Launch ก่อน

| | Soft Launch (ตอนนี้) | Full Launch (ทีหลัง) |
|---|---|---|
| รับโรงเรียน | manual / white-glove 2-3 แห่ง | self-serve สมัครเอง |
| เก็บค่าระบบ | โอน/วางบิลเอง | Omise บัตรเครดิตอัตโนมัติ |
| ต้องรอ Omise KYC | ❌ ไม่ต้อง | ✅ ต้องเสร็จก่อน |
| เริ่มได้เมื่อไหร่ | **เลย** | ~3-4 สัปดาห์ |

**ข้อดี:** ได้ลูกค้าจริง + feedback เร็ว, ทดสอบระบบกับโรงเรียนจริงก่อนเปิดกว้าง, ขณะรอ Omise KYC ดำเนินไป

---

## 💸 เงินไหลยังไงตอน Soft Launch

| เงินจาก → ถึง | วิธี | สถานะ |
|---|---|---|
| ผู้ปกครอง → โรงเรียน (ค่าเทอม) | **PromptPay QR (ในระบบ)** | ✅ ใช้ได้เลย |
| โรงเรียน → Panya Ventures (ค่าระบบ) | **โอนเข้าบัญชีบริษัท + วางบิลเอง** | ✅ manual |

---

## 📋 วิธี Onboard โรงเรียนเพื่อน (White-Glove)

### ขั้นที่ 1: สร้าง account + โรงเรียนให้เขา
- นัดคุยกับโรงเรียน → ช่วยเขาสมัคร (หรือสมัครให้)
- โรงเรียนจะอยู่สถานะ `pending_payment` (ระบบจะบังคับไปหน้าใส่บัตร)

### ขั้นที่ 2: เปิดใช้งานแบบ Manual (ข้ามบัตร) ⭐ ใหม่!
- Login เป็น **developer** → ไป `/admin/tenants.html` → คลิกโรงเรียนนั้น
- กดปุ่ม **"✅ Activate (Comp/Manual)"** (ปุ่มจะขึ้นเฉพาะโรงเรียน pending_payment)
- สถานะเปลี่ยนเป็น `active` → โรงเรียนเข้าใช้ระบบได้ทันที ไม่ต้องใส่บัตร

### ขั้นที่ 3: วางบิลเก็บค่าระบบเอง
- ส่งใบแจ้งหนี้ให้โรงเรียน (ค่าระบบรายเดือน เช่น 1,299 / 2,990 / 4,990)
- โรงเรียนโอนเข้า **บัญชี Panya Ventures Co., Ltd.**
- บันทึกการชำระไว้ (Excel หรือ note) — ทีหลังย้ายเข้าระบบ Omise

### ขั้นที่ 4: ช่วยเขา setup
- ส่งลิงก์ **Setup Guide** ให้: `{slug}.panyaschoolkit.com/pages/onboarding.html`
- เขาทำตาม wizard: วิชา → คาบเรียน → เกรด → นักเรียน → ครู
- มีปัญหาโทรหาคุณได้ (จุดแข็ง: founder ดูแลเอง)

---

## 🔑 SKKS (โรงเรียนตัวเอง)
- ใช้งานจริงได้เลย — เป็น tenant แรก
- ตรวจว่า SKKS status = `active` (ถ้า pending_payment ใช้ปุ่ม Activate Comp)
- ไม่ต้องเก็บเงินตัวเอง

---

## ✅ Checklist ก่อน Soft Launch (สั้นมาก!)

```
[ ] Push code ล่าสุด (wizard) + รัน SQL 3 ไฟล์   ← เกือบเสร็จ
[ ] ตรวจ SKKS status = active
[ ] ตั้ง PromptPay ID ใน payment-settings (เพื่อ QR ค่าเทอม)
[ ] (optional) EMAIL_FROM = noreply@panyaschoolkit.com
[ ] เตรียมใบแจ้งหนี้ค่าระบบ (template ง่ายๆ) + บัญชีบริษัทรับโอน
[ ] หาโรงเรียนเพื่อน 2-3 แห่ง นัดคุย
```

> 💡 Vercel Pause: ปล่อย ON ที่ $30 ได้ระหว่าง soft launch (usage ต่ำมาก ไม่แตะ) — ค่อยปิด Pause + เพิ่ม budget ตอน full launch

---

## ⏭️ เมื่อไหร่ค่อยทำ Full Launch (Omise self-serve)

เริ่มกระบวนการ Omise (ดู `OMISE-LIVE-MODE-PLAN.md`) เมื่อ:
- มีโรงเรียนสนใจ > 5 แห่ง / มี demand ชัดเจน
- พร้อมเปิดบัญชีธนาคารนิติบุคคล (กรรมการ 2 คนไปเซ็น)

แล้วค่อย:
1. Omise KYC approve → ได้ live keys
2. อัพเดต Vercel env (pkey_live / skey_live)
3. ปิด waitlist → เปิด public signup
4. Vercel: ปิด Pause + เพิ่ม budget $100-200

---

**Owner:** บริษัท ปัญญา เวนเจอร์ส จำกัด (Tax ID 0405569004587)
