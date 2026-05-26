# Omise Live Mode — Launch Plan

**Goal:** สลับระบบจาก Omise **Test mode** → **Live mode** เพื่อรับเงินจริงจากลูกค้า

**สถานะปัจจุบัน:** Test mode (ใช้บัตรทดสอบ 4242 4242 4242 4242)

> ⚠️ **อย่าเปิด Live mode จนกว่าจะทำ Checklist ครบ** — เพราะถ้าผิด อาจทำให้ลูกค้าจ่ายเงินไม่ได้

---

## 📋 Phase 1: เตรียมเอกสาร (Pre-requisites)

### 1.1 บัญชีธนาคาร Panya Ventures Co., Ltd.

ต้องมี **บัญชีออมทรัพย์/กระแสรายวันในชื่อนิติบุคคล** (ไม่ใช่ชื่อส่วนตัว)

**ธนาคารที่ Omise รองรับ (Settlement):**
- ✅ ธนาคารกสิกรไทย (KBANK)
- ✅ ธนาคารไทยพาณิชย์ (SCB)
- ✅ ธนาคารกรุงเทพ (BBL)
- ✅ ธนาคารกรุงไทย (KTB)
- ✅ ธนาคารกรุงศรีฯ (BAY)
- ✅ ธนาคารทหารไทยธนชาต (TTB)

**แนะนำ:** **KBANK** หรือ **SCB** (Settlement เร็วสุด T+1)

### 1.2 เอกสารที่ต้องเตรียม (ส่งให้ Omise)

| เอกสาร | สถานะ |
|---|---|
| หนังสือรับรองบริษัท (อายุไม่เกิน 3 เดือน) | ✅ มีแล้ว |
| ภพ.20 (ถ้าจดทะเบียน VAT) | ❌ ยังไม่จด VAT |
| สำเนาบัตรประชาชนกรรมการทุกคน | ⏳ ต้องเตรียม |
| สำเนาทะเบียนบ้านกรรมการ | ⏳ ต้องเตรียม |
| สำเนาหน้าสมุดบัญชีธนาคาร (ในนามบริษัท) | ⏳ ต้องสมัครก่อน |
| หนังสือมอบอำนาจ (ถ้ามี) | ⏳ ไม่จำเป็น (กรรมการเซ็นเอง) |

**กรรมการ 2 คน (จากหนังสือรับรอง):**
1. นายนิธิทรรศ สุวรรณรงค์
2. นางกนกวรรณ สุวรรณรงค์

---

## 📋 Phase 2: สมัครบัญชีธนาคารบริษัท (~1-2 สัปดาห์)

### 2.1 จองคิวที่สาขา

ไปสาขา **พร้อมกรรมการทั้ง 2 คน** (ส่วนใหญ่ธนาคารต้องการครบทุกคน)

### 2.2 เอกสารที่นำไป

- หนังสือรับรองตัวจริง
- บัตรประชาชนกรรมการ (ตัวจริง + สำเนา)
- ทะเบียนบ้านกรรมการ (สำเนา)
- ตราประทับบริษัท (ถ้ามี)
- เงินเปิดบัญชีขั้นต่ำ (~500-5,000 บาท แล้วแต่ธนาคาร)

### 2.3 ระบุการใช้งาน

- ประเภทบัญชี: ออมทรัพย์ + กระแสรายวัน (สำหรับหัก settlement)
- เปิด **Internet Banking** + **Mobile Banking**
- ขอ **Statement** เป็น PDF email อัตโนมัติ
- (Optional) **PromptPay นิติบุคคล** — สำหรับรับ QR Code

### 2.4 หลังเปิดเสร็จ

- บันทึก **เลขที่บัญชี + ชื่อบัญชี** ไว้
- ถ่ายรูปหน้าสมุดบัญชี (หรือ Statement) ไว้ใช้ส่ง Omise

---

## 📋 Phase 3: ส่ง KYC ให้ Omise (~3-7 วัน)

### 3.1 Login Omise Dashboard

🔗 https://dashboard.omise.co

### 3.2 ไปที่ Settings → Account Activation

กดปุ่ม **"Activate Account"** หรือ **"Go Live"**

### 3.3 กรอกข้อมูล + อัปโหลดเอกสาร

- ประเภทธุรกิจ: **Software / SaaS / Education Technology**
- เว็บไซต์: `https://panyaschoolkit.com`
- คำอธิบายธุรกิจ:
  > "PanyaSchoolKit — SaaS ระบบจัดการโรงเรียนครบวงจรสำหรับโรงเรียนเอกชนในไทย รับชำระค่าบริการรายเดือน/รายปีจากโรงเรียน (B2B subscription)"
- ปริมาณธุรกรรมคาดการณ์/เดือน: ~5,000-50,000 บาท (ช่วงแรก)
- อัปโหลด **เอกสารทั้งหมดจาก Phase 1.2**
- ระบุ **บัญชีธนาคาร** สำหรับ settlement

### 3.4 รอ Omise ตรวจสอบ (3-7 วัน)

Omise จะส่ง email confirm สถานะ:
- ✅ Approved → ได้ Live Keys
- ❌ Rejected → จะบอกเหตุผล (ส่วนใหญ่เพราะเอกสารไม่ครบ)

---

## 📋 Phase 4: Code Changes (~30 นาที)

### 4.1 รับ Live Keys จาก Omise

หลัง approved จะได้ 2 keys:
- `pkey_live_xxxxx` (Public — ใช้ใน frontend)
- `skey_live_xxxxx` (Secret — ใช้ใน backend)

### 4.2 อัพเดต Vercel Environment Variables

🔗 https://vercel.com/nsthor77s-projects/skks-website/settings/environment-variables

แก้ 2 ตัว:
- `OMISE_PUBLIC_KEY` = `pkey_live_xxxxx`
- `OMISE_SECRET_KEY` = `skey_live_xxxxx`

### 4.3 อัพเดต Webhook URL ใน Omise Dashboard

ใน Omise: Settings → Webhooks → Endpoint URL:
```
https://suansonkk.com/api/omise/webhook
```

(URL เดิม — แต่ตอนนี้จะรับ live events แทน test events)

### 4.4 ลบ Test Mode Hint UI

ใน `pages/add-payment.html` → ลบ block `.test-card-hint` (กล่องสีทอง "Test Mode")

หรือเก็บไว้แต่ซ่อนถ้า env `OMISE_LIVE_MODE === 'true'`

### 4.5 Redeploy

หลังแก้ env vars + commit code → Vercel deploy อัตโนมัติ

---

## 📋 Phase 5: Test ก่อน Launch (~1 ชม)

### 5.1 Test กับบัตรจริง — Owner ของบริษัทเอง

**ใช้บัตรของคุณเอง** สมัคร tenant ทดสอบ + ใส่บัตรจริง:

1. ไป panyaschoolkit.com → สมัครโรงเรียนใหม่ slug `test-live-1`
2. ใส่บัตรเครดิตจริง (ของกรรมการ)
3. ใส่ plan `Starter` (1,299 บาท/เดือน — เลือกแพคถูกสุดเพื่อ test)
4. รอ webhook → invoice ออก
5. เช็คใน Omise Dashboard → เห็น charge สำเร็จ

### 5.2 Verify Settlement

หลัง 1-2 วันทำการ → เช็คบัญชีธนาคาร → ควรเห็นเงินเข้า (หัก fee Omise ~3.65%)

### 5.3 Test Refund

ถ้าทุกอย่างถูกต้อง:
- Refund charge นั้นใน Omise Dashboard
- เช็คว่าบัตรได้เงินคืน
- ลบ tenant test-live-1 ออก (ใน Supabase)

---

## 📋 Phase 6: Production Launch (~15 นาที)

### 6.1 ประกาศ Soft Launch

แค่ตัวคุณ + คน 1-2 คนที่ไว้ใจ

### 6.2 Monitor 1 สัปดาห์

ดูทุกวัน:
- Omise Dashboard → charges
- Vercel Logs → errors
- Resend → email bounces
- Supabase → audit_logs

### 6.3 Public Launch

หลังผ่าน 1 สัปดาห์ไม่มีปัญหา → ประกาศ public ได้
- LinkedIn post
- Facebook group โรงเรียน
- Cold email หาโรงเรียนที่สนใจ

---

## 🛡️ Rollback Plan (ถ้าเกิดปัญหา)

ถ้า charge ไม่ผ่าน / Settlement ผิด / มี bug หนัก:

### Step 1: Revert ทันที

ใน Vercel env vars → เปลี่ยน OMISE keys กลับเป็น `pkey_test_*` / `skey_test_*`
→ Redeploy
→ ระบบกลับเป็น test mode

### Step 2: ติดต่อ Omise

อีเมล support@omise.co พร้อม charge IDs ที่มีปัญหา

### Step 3: แจ้งลูกค้า

ส่ง email หา tenants ที่ได้รับผลกระทบ — ขอโทษ + บอกว่าจะแก้ใน X วัน

---

## 💰 ค่าธรรมเนียม Omise (Live mode)

| ประเภท | ค่าธรรมเนียม |
|---|---|
| **บัตรเครดิต/เดบิต** | 3.65% + 5 บาท ต่อ transaction |
| **PromptPay** | 0.95% (ไม่มีค่า fixed) |
| **TrueMoney Wallet** | 2.5% |
| **Internet Banking** | 1.95% + 5 บาท |
| **Installment** | 4.5% + 5 บาท |
| **Refund** | ฟรี (แต่ fee transaction เดิมไม่คืน) |

**ตัวอย่าง:** ลูกค้าจ่าย Pro Monthly 2,990 บาท
- Fee: 2,990 × 3.65% + 5 = **114.13 บาท**
- คุณได้: 2,875.87 บาท
- Settlement: T+1 (วันทำการถัดไป)

---

## 📝 Final Checklist (Print + check ก่อน Go Live)

```
[ ] Phase 1: เอกสารครบ (หนังสือรับรอง + บัตรประชาชน 2 กรรมการ)
[ ] Phase 2: เปิดบัญชีธนาคารบริษัทเสร็จ
[ ] Phase 3: ส่ง KYC + Omise approve แล้ว
[ ] Phase 4: อัพเดต env vars (pkey_live_*, skey_live_*)
[ ] Phase 4: Update webhook URL ใน Omise dashboard
[ ] Phase 4: ลบ Test Mode hint UI
[ ] Phase 4: Redeploy Vercel
[ ] Phase 5: Test กับบัตรจริง — charge ผ่าน
[ ] Phase 5: Verify settlement เข้าบัญชีธนาคาร
[ ] Phase 5: Test refund
[ ] Phase 6: Monitor 1 สัปดาห์ — ไม่มี error
[ ] Phase 6: Public launch 🎉
```

---

## ⏱️ Timeline ประเมิน

| Phase | เวลา |
|---|---|
| 1. เตรียมเอกสาร | 1-2 วัน |
| 2. เปิดบัญชีธนาคาร | 1-2 สัปดาห์ |
| 3. KYC Omise | 3-7 วัน |
| 4. Code changes | 30 นาที |
| 5. Test | 1 ชม |
| 6. Monitor + Launch | 1 สัปดาห์ |

**รวม:** ประมาณ **3-4 สัปดาห์** จากเริ่มสมัครบัญชีธนาคาร ถึงเปิดให้สาธารณะใช้จริง

---

## 📞 Support Contacts

- **Omise Support:** support@omise.co · 02-026-3025
- **Resend Support:** support@resend.com
- **Vercel Support:** vercel.com/help
- **Supabase Support:** support.supabase.com

---

**Document version:** 1.0
**Created:** 2026-05-25
**Owner:** บริษัท ปัญญา เวนเจอร์ส จำกัด
