-- ============================================================================
-- Sprint 36 — ระบบดูแลช่วยเหลือนักเรียน (Student Care System hub)
-- ============================================================================
-- One care classification per student (กลุ่มปกติ/เสี่ยง/มีปัญหา) + referral
-- (ส่งต่อ). Plus list_sdq_latest() so the hub can roll up SDQ + poverty signals.
-- Idempotent. Run on prod "School Kit".
-- ============================================================================

create table if not exists public.care_assessments (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  care_group    text,                       -- ปกติ | เสี่ยง | มีปัญหา
  risk_note     text,
  referred      boolean not null default false,
  referral_to   text,                        -- ครูแนะแนว/ผู้ปกครอง/รพ./สหวิชาชีพ
  referral_note text,
  status        text not null default 'active',  -- active | resolved
  academic_year text,
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  unique (school_id, student_id)
);
create index if not exists care_school_idx on public.care_assessments (school_id, care_group);

alter table public.care_assessments enable row level security;

drop policy if exists care_staff_manage on public.care_assessments;
create policy care_staff_manage on public.care_assessments for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());

drop policy if exists care_student_read on public.care_assessments;
create policy care_student_read on public.care_assessments for select to authenticated
  using (school_id = public.current_school_id() and student_id = any (public.my_student_ids()));

-- upsert one classification per student
create or replace function public.save_care(
  p_student_id uuid, p_care_group text, p_risk_note text,
  p_referred boolean, p_referral_to text, p_referral_note text, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  if p_student_id is null then return jsonb_build_object('success', false, 'error', 'ไม่พบนักเรียน'); end if;
  insert into public.care_assessments
    (school_id, student_id, care_group, risk_note, referred, referral_to, referral_note, status, updated_by, updated_at)
  values (v_school, p_student_id, p_care_group, p_risk_note, coalesce(p_referred,false), p_referral_to, p_referral_note,
          coalesce(p_status,'active'), auth.uid(), now())
  on conflict (school_id, student_id) do update set
    care_group = excluded.care_group, risk_note = excluded.risk_note, referred = excluded.referred,
    referral_to = excluded.referral_to, referral_note = excluded.referral_note, status = excluded.status,
    updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.save_care to authenticated;

create or replace function public.list_care()
returns setof public.care_assessments language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query select * from public.care_assessments where school_id = v_school;
end$$;
grant execute on function public.list_care to authenticated;

-- latest SDQ overall per student (for the hub roll-up)
create or replace function public.list_sdq_latest()
returns table(student_id uuid, overall text, total int, assessed_on date)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query
    select distinct on (s.student_id)
      s.student_id,
      (s.interpretation->>'overall'),
      (s.scores->>'total')::int,
      s.assessed_on
    from public.sdq_assessments s
    where s.school_id = v_school
    order by s.student_id, s.assessed_on desc, s.created_at desc;
end$$;
grant execute on function public.list_sdq_latest to authenticated;

-- ============================================================================
-- verify: select public.list_care(); select public.list_sdq_latest();
-- ============================================================================
