-- ============================================================================
-- Sprint 49 — ผู้มาติดต่อ (visitor log)
-- ============================================================================
-- Front-office visitor check-in/out. Staff-managed (direct-table CRUD + RLS).
-- ============================================================================
create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  visitor_name text not null, id_card text, phone text,
  purpose text, to_see text, badge_no text,
  time_in timestamptz not null default now(), time_out timestamptz,
  note text, created_by uuid, created_at timestamptz not null default now()
);
create index if not exists visitors_school_idx on public.visitors (school_id, time_in desc);

alter table public.visitors enable row level security;
drop policy if exists visitor_staff on public.visitors;
create policy visitor_staff on public.visitors for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());
-- ============================================================================
