-- ============================================================================
-- Sprint 48 — พัสดุ/ครุภัณฑ์ (asset & inventory register)
-- ============================================================================
-- Staff-managed asset register (direct-table CRUD with RLS). Idempotent.
-- ============================================================================
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text, name text not null, category text, location text,
  quantity int default 1, unit text, value numeric,
  acquired_date date, status text default 'ใช้งานได้', note text,
  created_by uuid, created_at timestamptz not null default now()
);
create index if not exists assets_school_idx on public.assets (school_id, category);

alter table public.assets enable row level security;
drop policy if exists asset_staff on public.assets;
create policy asset_staff on public.assets for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());
-- ============================================================================
