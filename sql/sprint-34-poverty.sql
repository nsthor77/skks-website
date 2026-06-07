-- ============================================================================
-- Sprint 34 — คัดกรองนักเรียนยากจน / ปัจจัยพื้นฐานนักเรียนยากจน (กสศ./CCT)
-- ============================================================================
-- Household income per-capita + 8 basic-need factors → auto classification
-- (ไม่เข้าเกณฑ์ / ยากจน / ยากจนพิเศษ). Classification computed in browser, stored.
-- Idempotent. Run on prod "School Kit".
-- ============================================================================

create table if not exists public.poverty_screenings (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  student_id       uuid not null references public.students(id) on delete cascade,
  household_income numeric,          -- รายได้รวมครัวเรือน/เดือน (บาท)
  members          int,              -- จำนวนสมาชิกครัวเรือน
  per_capita       numeric,          -- รายได้เฉลี่ยต่อคน/เดือน
  factors          jsonb,            -- {dependents,no_car,poor_housing,no_land,rented,no_utilities,welfare_card,no_steady_income}
  factor_count     int default 0,
  classification   text,             -- ไม่เข้าเกณฑ์ | ยากจน | ยากจนพิเศษ
  note             text,
  screened_on      date not null default current_date,
  academic_year    text,
  created_by       uuid,
  created_at       timestamptz not null default now()
);
create index if not exists poverty_school_student_idx on public.poverty_screenings (school_id, student_id, screened_on desc);

alter table public.poverty_screenings enable row level security;

drop policy if exists pov_staff_manage on public.poverty_screenings;
create policy pov_staff_manage on public.poverty_screenings for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());

drop policy if exists pov_student_read on public.poverty_screenings;
create policy pov_student_read on public.poverty_screenings for select to authenticated
  using (school_id = public.current_school_id() and student_id = any (public.my_student_ids()));

create or replace function public.save_poverty(
  p_id uuid, p_student_id uuid, p_income numeric, p_members int, p_per_capita numeric,
  p_factors jsonb, p_factor_count int, p_classification text, p_note text,
  p_screened_on date, p_year text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  if p_student_id is null then return jsonb_build_object('success', false, 'error', 'ไม่พบนักเรียน'); end if;

  if p_id is null then
    insert into public.poverty_screenings
      (school_id, student_id, household_income, members, per_capita, factors, factor_count, classification, note, screened_on, academic_year, created_by)
    values (v_school, p_student_id, p_income, p_members, p_per_capita, p_factors, coalesce(p_factor_count,0), p_classification, p_note,
            coalesce(p_screened_on, current_date), p_year, auth.uid())
    returning id into v_id;
  else
    update public.poverty_screenings set
      household_income=p_income, members=p_members, per_capita=p_per_capita, factors=p_factors,
      factor_count=coalesce(p_factor_count,0), classification=p_classification, note=p_note,
      screened_on=coalesce(p_screened_on,screened_on), academic_year=p_year
    where id=p_id and school_id=v_school returning id into v_id;
    if v_id is null then return jsonb_build_object('success', false, 'error', 'ไม่พบรายการ'); end if;
  end if;
  return jsonb_build_object('success', true, 'id', v_id);
end$$;
grant execute on function public.save_poverty to authenticated;

create or replace function public.get_poverty(p_student_id uuid)
returns setof public.poverty_screenings language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  return query select * from public.poverty_screenings
    where school_id = v_school and student_id = p_student_id order by screened_on desc, created_at desc;
end$$;
grant execute on function public.get_poverty to authenticated;

create or replace function public.delete_poverty(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  delete from public.poverty_screenings where id = p_id and school_id = v_school;
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.delete_poverty to authenticated;

-- list everyone's latest classification (for the care hub / reports)
create or replace function public.list_poverty_latest()
returns table(student_id uuid, classification text, per_capita numeric, screened_on date)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query
    select distinct on (p.student_id) p.student_id, p.classification, p.per_capita, p.screened_on
    from public.poverty_screenings p
    where p.school_id = v_school
    order by p.student_id, p.screened_on desc;
end$$;
grant execute on function public.list_poverty_latest to authenticated;

-- ============================================================================
