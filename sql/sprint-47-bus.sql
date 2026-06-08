-- ============================================================================
-- Sprint 47 — รถรับส่งนักเรียน (school bus routes & assignments)
-- ============================================================================
-- Staff manage routes + assign students; students/parents see their route.
-- Idempotent. Run on prod "School Kit".
-- ============================================================================

create table if not exists public.bus_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  driver_name text, driver_phone text, vehicle text,
  departure_time text, return_time text, note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists bus_routes_school_idx on public.bus_routes (school_id, active);

create table if not exists public.bus_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  route_id uuid not null references public.bus_routes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  pickup_point text, note text,
  unique (route_id, student_id)
);
create index if not exists bus_asg_idx on public.bus_assignments (school_id, route_id);

alter table public.bus_routes enable row level security;
alter table public.bus_assignments enable row level security;

drop policy if exists br_staff on public.bus_routes;
create policy br_staff on public.bus_routes for all to authenticated
  using (school_id=public.current_school_id() and public.is_staff_or_higher())
  with check (school_id=public.current_school_id() and public.is_staff_or_higher());
drop policy if exists br_read on public.bus_routes;
create policy br_read on public.bus_routes for select to authenticated
  using (school_id=public.current_school_id());

drop policy if exists ba_staff on public.bus_assignments;
create policy ba_staff on public.bus_assignments for all to authenticated
  using (school_id=public.current_school_id() and public.is_staff_or_higher())
  with check (school_id=public.current_school_id() and public.is_staff_or_higher());
drop policy if exists ba_own on public.bus_assignments;
create policy ba_own on public.bus_assignments for select to authenticated
  using (school_id=public.current_school_id() and student_id = any(public.my_student_ids()));

create or replace function public.save_route(p_id uuid,p_name text,p_driver text,p_phone text,p_vehicle text,p_dep text,p_ret text,p_note text,p_active boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_school uuid; v_id uuid;
begin
  v_school:=public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  if coalesce(btrim(p_name),'')='' then return jsonb_build_object('success',false,'error','กรุณาใส่ชื่อสาย'); end if;
  if p_id is null then
    insert into public.bus_routes(school_id,name,driver_name,driver_phone,vehicle,departure_time,return_time,note,active)
    values(v_school,btrim(p_name),p_driver,p_phone,p_vehicle,p_dep,p_ret,p_note,coalesce(p_active,true)) returning id into v_id;
  else
    update public.bus_routes set name=btrim(p_name),driver_name=p_driver,driver_phone=p_phone,vehicle=p_vehicle,
      departure_time=p_dep,return_time=p_ret,note=p_note,active=coalesce(p_active,active)
    where id=p_id and school_id=v_school returning id into v_id;
    if v_id is null then return jsonb_build_object('success',false,'error','ไม่พบรายการ'); end if;
  end if;
  return jsonb_build_object('success',true,'id',v_id);
end$$;
grant execute on function public.save_route to authenticated;

create or replace function public.list_routes()
returns table(id uuid,name text,driver_name text,driver_phone text,vehicle text,departure_time text,return_time text,note text,active boolean,students bigint)
language plpgsql security definer set search_path=public as $$
declare v_school uuid;
begin
  v_school:=public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query select r.id,r.name,r.driver_name,r.driver_phone,r.vehicle,r.departure_time,r.return_time,r.note,r.active,
    (select count(*) from public.bus_assignments a where a.route_id=r.id) from public.bus_routes r where r.school_id=v_school order by r.name;
end$$;
grant execute on function public.list_routes to authenticated;

create or replace function public.delete_route(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_school uuid;
begin
  v_school:=public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  delete from public.bus_routes where id=p_id and school_id=v_school;
  return jsonb_build_object('success',true);
end$$;
grant execute on function public.delete_route to authenticated;

create or replace function public.assign_bus(p_route_id uuid,p_student_id uuid,p_pickup text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_school uuid;
begin
  v_school:=public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  insert into public.bus_assignments(school_id,route_id,student_id,pickup_point)
  values(v_school,p_route_id,p_student_id,p_pickup)
  on conflict (route_id,student_id) do update set pickup_point=excluded.pickup_point;
  return jsonb_build_object('success',true);
end$$;
grant execute on function public.assign_bus to authenticated;

create or replace function public.unassign_bus(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_school uuid;
begin
  v_school:=public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  delete from public.bus_assignments where id=p_id and school_id=v_school;
  return jsonb_build_object('success',true);
end$$;
grant execute on function public.unassign_bus to authenticated;

create or replace function public.list_route_students(p_route_id uuid)
returns table(id uuid,student_id uuid,student_name text,grade text,classroom text,pickup_point text)
language plpgsql security definer set search_path=public as $$
declare v_school uuid;
begin
  v_school:=public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query select a.id,a.student_id,btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')),s.grade,s.classroom,a.pickup_point
    from public.bus_assignments a join public.students s on s.id=a.student_id
    where a.route_id=p_route_id and a.school_id=v_school order by s.grade,s.classroom;
end$$;
grant execute on function public.list_route_students to authenticated;

create or replace function public.get_my_bus()
returns table(student_name text,route_name text,driver_name text,driver_phone text,vehicle text,departure_time text,return_time text,pickup_point text)
language plpgsql security definer set search_path=public as $$
declare v_school uuid;
begin
  v_school:=public.current_school_id();
  if v_school is null then return; end if;
  return query select btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')),r.name,r.driver_name,r.driver_phone,r.vehicle,r.departure_time,r.return_time,a.pickup_point
    from public.bus_assignments a join public.bus_routes r on r.id=a.route_id join public.students s on s.id=a.student_id
    where a.school_id=v_school and a.student_id = any(public.my_student_ids());
end$$;
grant execute on function public.get_my_bus to authenticated;
-- ============================================================================
