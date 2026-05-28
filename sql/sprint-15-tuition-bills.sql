-- ============================================================================
-- Sprint 15: Tuition Bills — SCHEMA DOCUMENTATION + safe additive migration
-- ============================================================================
-- ⚠️ IMPORTANT: These 7 tables ALREADY EXIST in production (built in an earlier
-- sprint, applied directly to prod, never captured in a migration file).
-- This file DOCUMENTS them and is written to be 100% SAFE to re-run:
--   - CREATE TABLE IF NOT EXISTS  → skips existing tables (no data loss)
--   - ALTER TABLE ADD COLUMN IF NOT EXISTS → adds only missing columns
--   - No DROP, no destructive change
--
-- Purpose:
--   1. Capture schema in the repo (was a risk — undocumented prod tables)
--   2. Guarantee columns the Sprint 15 dynamic PromptPay QR depends on exist
--      (especially payment_settings.promptpay_id)
--
-- RLS NOTE: Prod already has working RLS on these tables (the pages work via
-- direct .from() calls). The RLS section at the bottom is COMMENTED OUT — do
-- NOT run it blindly; review against prod policies first (staging only).
-- Created: 2026-05-28
-- ============================================================================

-- 1. tuition_fees — fee schedule per program/grade (admin-defined)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tuition_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS program text;
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS name_th text;
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS amount numeric(12,2);
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS frequency text;     -- term/year/monthly
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.tuition_fees ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
COMMENT ON TABLE public.tuition_fees IS 'Sprint 15 (doc): per-program tuition fee schedule';

-- 2. bills — individual bills issued to students/parents
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS bill_number text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS amount numeric(12,2);
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS description_th text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS status text DEFAULT 'unpaid';   -- unpaid/pending/paid
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS term text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS bills_student_idx ON public.bills (student_id, status);
CREATE INDEX IF NOT EXISTS bills_school_idx ON public.bills (school_id, status, due_date);
COMMENT ON TABLE public.bills IS 'Sprint 15 (doc): tuition bills issued to students';

-- 3. payment_settings — school bank account + PromptPay config (1 active per school)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS account_name text;
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS branch text;
-- ⭐ Sprint 15 dynamic QR depends on this column:
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS promptpay_id text;        -- phone (0xxxxxxxxx) or national/tax ID (13 digits)
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS qr_code_url text;          -- legacy static QR image (fallback)
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS payment_note text;
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS payment_note_th text;
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
COMMENT ON TABLE public.payment_settings IS 'Sprint 15 (doc): school payment/PromptPay settings';
COMMENT ON COLUMN public.payment_settings.promptpay_id IS 'PromptPay proxy: mobile or 13-digit national/tax ID — used to generate dynamic amount-encoded QR';

-- 4. payment_slips — parent-uploaded transfer slips awaiting staff approval
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS slip_url text;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS amount numeric(12,2);
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS transfer_date date;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS transfer_time time;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';   -- pending/approved/rejected
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS slips_bill_idx ON public.payment_slips (bill_id, status);
CREATE INDEX IF NOT EXISTS slips_school_status_idx ON public.payment_slips (school_id, status);
COMMENT ON TABLE public.payment_slips IS 'Sprint 15 (doc): parent payment slips for staff verification';

-- 5. payments — confirmed payment ledger (created on slip approval or manual entry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount numeric(12,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method text;          -- promptpay/transfer/cash/card
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_date date;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS payments_school_idx ON public.payments (school_id, paid_date);
COMMENT ON TABLE public.payments IS 'Sprint 15 (doc): confirmed payment ledger';

-- 6. payment_gateways — Omise/gateway keys per school (card payment option)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.payment_gateways ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.payment_gateways ADD COLUMN IF NOT EXISTS provider text;        -- omise
ALTER TABLE public.payment_gateways ADD COLUMN IF NOT EXISTS public_key text;
ALTER TABLE public.payment_gateways ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;
ALTER TABLE public.payment_gateways ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
COMMENT ON TABLE public.payment_gateways IS 'Sprint 15 (doc): per-school card gateway config (optional — PromptPay preferred, no fees)';

-- 7. finance_transactions — full income/expense ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS type text;         -- income/expense
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS amount numeric(12,2);
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS transaction_date date;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS fin_school_date_idx ON public.finance_transactions (school_id, transaction_date);
COMMENT ON TABLE public.finance_transactions IS 'Sprint 15 (doc): income/expense ledger';


-- ============================================================================
-- RLS — ⚠️ REVIEW BEFORE RUNNING. Prod already has working policies.
-- Only apply on a fresh tenant or after confirming prod has none.
-- Enabling RLS is idempotent; the policies below mirror the app's access model.
-- ============================================================================
-- ALTER TABLE public.bills              ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.tuition_fees       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payment_slips      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payment_settings   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payment_gateways   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
--
-- Expected access model (document only):
--   bills:            staff full; student/parent SELECT own (student_id in my_student_ids)
--   payment_slips:    staff full; parent INSERT + SELECT own
--   payment_settings: staff read; owner write; parent SELECT (active row) for QR/bank info
--   payments / finance_transactions / tuition_fees / payment_gateways: staff/owner only


-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'payment_settings' AND column_name = 'promptpay_id';  -- must exist
-- SELECT promptpay_id, account_name FROM public.payment_settings WHERE active = true;
