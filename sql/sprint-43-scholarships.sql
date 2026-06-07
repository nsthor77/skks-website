-- ============================================================================
-- Sprint 43 — ทุนการศึกษา (scholarship management)
-- ============================================================================
-- Scholarship funds + awards to students. Finance feature → owner-gated
-- (current_user_role in owner/developer). Students/parents see their own awards.
-- Idempotent. Run on prod "School Kit".
-- ============================================================================

create table if not exists public.scholarships (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  name         text not null,
  sponsor      text,                 -- แหล่งทุน/ผู้สนับสนุน
  description  text,
  amount       numeric,              -- เงินต่อทุน (บาท)
  total_budget numeric,              -- งบรวมของทุนนี้
  academic_year text,
  active       boolean not null default true,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists scholarships_school_idx on public.scholarships (school_id, active);

create table if not exists public.scholarship_awards (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  school_id      uuid not null references public.schools(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  amount         numeric,
  award_date     date not null default current_date,
  status         text not null default 'awarded',  -- awarded | disbursed
  note           text,
  created_by     uuid,
  created_at     timestamptz not null default now()
);
create index if not exists schol_awards_idx on public.scholarship_awards (school_id, scholarship_id);

alter table public.scholarships enable row level security;
alter table public.scholarship_awards enable row level security;

-- owner manages
drop policy if exists sch_owner_manage on public.scholarships;
create policy sch_owner_manage on public.scholarships for all to authenticated
  using (school_id = public.current_school_id() and public.current_user_role() in ('owner','developer'))
  with check (school_id = public.current_school_id() and public.current_user_role() in ('owner','developer'));

drop policy if exists scha_owner_manage on public.scholarship_awards;
create policy scha_owner_manage on public.scholarship_awards for all to authenticated
  using (school_id = public.current_school_id() and public.current_user_role() in ('owner','developer'))
  with check (school_id = public.current_school_id() and public.current_user_role() in ('owner','developer'));

-- student/parent read their own awards
drop policy if exists scha_own_read on public.scholarship_awards;
create policy scha_own_read on public.scholarship_awards for select to authenticated
  using (school_id = public.current_school_id() and student_id = any (public.my_student_ids()));

-- ---- RPCs -------------------------------------------------------------------
create or replace function public.save_scholarship(
  p_id uuid, p_name text, p_sponsor text, p_description text,
  p_amount numeric, p_total_budget numeric, p_year text, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์ (เฉพาะเจ้าของ)'); end if;
  if coalesce(btrim(p_name),'')='' then return jsonb_build_object('success',false,'error','กรุณาใส่ชื่อทุน'); end if;
  if p_id is null then
    insert into public.scholarships (school_id,name,sponsor,description,amount,total_budget,academic_year,active,created_by)
    values (v_school,btrim(p_name),p_sponsor,p_description,p_amount,p_total_budget,p_year,coalesce(p_active,true),auth.uid())
    returning id into v_id;
  else
    update public.scholarships set name=btrim(p_name),sponsor=p_sponsor,description=p_description,amount=p_amount,
      total_budget=p_total_budget,academic_year=p_year,active=coalesce(p_active,active)
    where id=p_id and school_id=v_school returning id into v_id;
    if v_id is null then return jsonb_build_object('success',false,'error','ไม่พบรายการ'); end if;
  end if;
  return jsonb_build_object('success',true,'id',v_id);
end$$;
grant execute on function public.save_scholarship to authenticated;

create or replace function public.list_scholarships()
returns table(id uuid,name text,sponsor text,description text,amount numeric,total_budget numeric,academic_year text,active boolean,
              awarded_count bigint,awarded_total numeric)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return; end if;
  return query select s.id,s.name,s.sponsor,s.description,s.amount,s.total_budget,s.academic_year,s.active,
    (select count(*) from public.scholarship_awards a where a.scholarship_id=s.id),
    (select coalesce(sum(a.amount),0) from public.scholarship_awards a where a.scholarship_id=s.id)
    from public.scholarships s where s.school_id=v_school order by s.created_at desc;
end$$;
grant execute on function public.list_scholarships to authenticated;

create or replace function public.delete_scholarship(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  delete from public.scholarships where id=p_id and school_id=v_school;
  return jsonb_build_object('success',true);
end$$;
grant execute on function public.delete_scholarship to authenticated;

create or replace function public.award_scholarship(
  p_id uuid, p_scholarship_id uuid, p_student_id uuid, p_amount numeric, p_award_date date, p_status text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  if p_id is null then
    insert into public.scholarship_awards (scholarship_id,school_id,student_id,amount,award_date,status,note,created_by)
    values (p_scholarship_id,v_school,p_student_id,p_amount,coalesce(p_award_date,current_date),coalesce(p_status,'awarded'),p_note,auth.uid())
    returning id into v_id;
  else
    update public.scholarship_awards set amount=p_amount,award_date=coalesce(p_award_date,award_date),status=coalesce(p_status,status),note=p_note
    where id=p_id and school_id=v_school returning id into v_id;
    if v_id is null then return jsonb_build_object('success',false,'error','ไม่พบรายการ'); end if;
  end if;
  return jsonb_build_object('success',true,'id',v_id);
end$$;
grant execute on function public.award_scholarship to authenticated;

create or replace function public.list_awards(p_scholarship_id uuid)
returns table(id uuid,student_id uuid,student_name text,grade text,classroom text,amount numeric,award_date date,status text,note text)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return; end if;
  return query
    select a.id,a.student_id,btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')),s.grade,s.classroom,
           a.amount,a.award_date,a.status,a.note
    from public.scholarship_awards a join public.students s on s.id=a.student_id
    where a.scholarship_id=p_scholarship_id and a.school_id=v_school order by a.award_date desc;
end$$;
grant execute on function public.list_awards to authenticated;

create or replace function public.delete_award(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  delete from public.scholarship_awards where id=p_id and school_id=v_school;
  return jsonb_build_object('success',true);
end$$;
grant execute on function public.delete_award to authenticated;

-- student/parent: my children's awards
create or replace function public.get_my_scholarships()
returns table(student_name text, scholarship_name text, sponsor text, amount numeric, award_date date, status text)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  return query
    select btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')), sc.name, sc.sponsor, a.amount, a.award_date, a.status
    from public.scholarship_awards a
    join public.students s on s.id=a.student_id
    join public.scholarships sc on sc.id=a.scholarship_id
    where a.school_id=v_school and a.student_id = any (public.my_student_ids())
    order by a.award_date desc;
end$$;
grant execute on function public.get_my_scholarships to authenticated;

-- ============================================================================
