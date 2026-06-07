-- ============================================================================
-- Sprint 35 — เยี่ยมบ้านนักเรียน (home visit records)
-- ============================================================================
-- Part of ระบบดูแลช่วยเหลือนักเรียน. Photos reuse the school-assets bucket
-- (Sprint 29) under {school_id}/home-visits/. Idempotent. Run on prod.
-- ============================================================================

create table if not exists public.home_visits (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  visit_date      date not null default current_date,
  visitor_name    text,
  family_status   text,           -- สภาพครอบครัว
  environment     text,           -- สภาพแวดล้อม/ที่อยู่อาศัย
  findings        text,           -- สิ่งที่พบ
  recommendations text,           -- ข้อเสนอแนะ/การช่วยเหลือ
  followup        text,           -- การติดตาม
  photo_urls      jsonb default '[]'::jsonb,
  academic_year   text,
  created_by      uuid,
  created_at      timestamptz not null default now()
);
create index if not exists hv_school_student_idx on public.home_visits (school_id, student_id, visit_date desc);

alter table public.home_visits enable row level security;

drop policy if exists hv_staff_manage on public.home_visits;
create policy hv_staff_manage on public.home_visits for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());

drop policy if exists hv_student_read on public.home_visits;
create policy hv_student_read on public.home_visits for select to authenticated
  using (school_id = public.current_school_id() and student_id = any (public.my_student_ids()));

create or replace function public.save_home_visit(
  p_id uuid, p_student_id uuid, p_visit_date date, p_visitor_name text,
  p_family_status text, p_environment text, p_findings text, p_recommendations text,
  p_followup text, p_photo_urls jsonb, p_year text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  if p_student_id is null then return jsonb_build_object('success', false, 'error', 'ไม่พบนักเรียน'); end if;

  if p_id is null then
    insert into public.home_visits
      (school_id, student_id, visit_date, visitor_name, family_status, environment, findings, recommendations, followup, photo_urls, academic_year, created_by)
    values (v_school, p_student_id, coalesce(p_visit_date,current_date), p_visitor_name, p_family_status, p_environment, p_findings,
            p_recommendations, p_followup, coalesce(p_photo_urls,'[]'::jsonb), p_year, auth.uid())
    returning id into v_id;
  else
    update public.home_visits set
      visit_date=coalesce(p_visit_date,visit_date), visitor_name=p_visitor_name, family_status=p_family_status,
      environment=p_environment, findings=p_findings, recommendations=p_recommendations, followup=p_followup,
      photo_urls=coalesce(p_photo_urls,'[]'::jsonb), academic_year=p_year
    where id=p_id and school_id=v_school returning id into v_id;
    if v_id is null then return jsonb_build_object('success', false, 'error', 'ไม่พบรายการ'); end if;
  end if;
  return jsonb_build_object('success', true, 'id', v_id);
end$$;
grant execute on function public.save_home_visit to authenticated;

create or replace function public.get_home_visits(p_student_id uuid)
returns setof public.home_visits language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  return query select * from public.home_visits
    where school_id = v_school and student_id = p_student_id order by visit_date desc, created_at desc;
end$$;
grant execute on function public.get_home_visits to authenticated;

create or replace function public.delete_home_visit(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  delete from public.home_visits where id = p_id and school_id = v_school;
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.delete_home_visit to authenticated;

-- ============================================================================
