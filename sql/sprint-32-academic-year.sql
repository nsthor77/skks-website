-- ============================================================================
-- Sprint 32 — Academic year/term + student promotion (เลื่อนชั้น)
-- ============================================================================
-- (A) academic_terms: a per-school list of year+term, with ONE marked current.
-- (B) promote_students(): bulk-move active students to next grade/classroom for a
--     new year, recording a SNAPSHOT so it can be fully undone (undo_promotion).
-- Mutates student rows — but only ACTIVE students, only the current school, and
-- every change is reversible. Idempotent DDL. Run on prod "School Kit".
-- ============================================================================

-- ============================  (A) ACADEMIC TERMS  ==========================
create table if not exists public.academic_terms (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  year        text not null,                    -- e.g. '2567'
  term        smallint not null default 1,      -- 1 | 2 | 3
  label       text,
  is_current  boolean not null default false,
  starts_on   date,
  ends_on     date,
  created_at  timestamptz not null default now(),
  unique (school_id, year, term)
);
-- only one current term per school
create unique index if not exists academic_terms_one_current
  on public.academic_terms (school_id) where is_current;

alter table public.academic_terms enable row level security;

drop policy if exists at_staff_manage on public.academic_terms;
create policy at_staff_manage on public.academic_terms for all to authenticated
  using (school_id = public.current_school_id()
         and public.current_user_role() in ('staff','owner','developer'))
  with check (school_id = public.current_school_id()
         and public.current_user_role() in ('staff','owner','developer'));

drop policy if exists at_member_read on public.academic_terms;
create policy at_member_read on public.academic_terms for select to authenticated
  using (school_id = public.current_school_id());

-- current term for this school (or null)
create or replace function public.get_current_term()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v jsonb;
begin
  v_school := public.current_school_id();
  if v_school is null then return null; end if;
  select jsonb_build_object('id', id, 'year', year, 'term', term, 'label', label,
                            'starts_on', starts_on, 'ends_on', ends_on)
    into v from public.academic_terms
    where school_id = v_school and is_current limit 1;
  return v;
end$$;
grant execute on function public.get_current_term to authenticated;

create or replace function public.list_terms()
returns setof public.academic_terms language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  return query select * from public.academic_terms
    where school_id = v_school order by year desc, term desc;
end$$;
grant execute on function public.list_terms to authenticated;

create or replace function public.set_current_term(
  p_year text, p_term smallint, p_label text, p_starts date, p_ends date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('staff','owner','developer') then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  if coalesce(btrim(p_year),'') = '' then
    return jsonb_build_object('success', false, 'error', 'กรุณาใส่ปีการศึกษา');
  end if;
  update public.academic_terms set is_current = false where school_id = v_school and is_current;
  insert into public.academic_terms (school_id, year, term, label, is_current, starts_on, ends_on)
  values (v_school, btrim(p_year), coalesce(p_term,1), p_label, true, p_starts, p_ends)
  on conflict (school_id, year, term)
    do update set is_current = true, label = excluded.label,
                  starts_on = excluded.starts_on, ends_on = excluded.ends_on;
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.set_current_term to authenticated;

create or replace function public.delete_term(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('staff','owner','developer') then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  delete from public.academic_terms where id = p_id and school_id = v_school;
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.delete_term to authenticated;

-- ============================  (B) PROMOTION  ===============================
create table if not exists public.promotion_runs (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  new_year    text,
  summary     jsonb,           -- the mapping that was applied
  snapshot    jsonb,           -- old values of every affected student (for undo)
  affected    int default 0,
  undone      boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists promotion_runs_school_idx on public.promotion_runs (school_id, created_at desc);

alter table public.promotion_runs enable row level security;
drop policy if exists pr_staff_manage on public.promotion_runs;
create policy pr_staff_manage on public.promotion_runs for all to authenticated
  using (school_id = public.current_school_id()
         and public.current_user_role() in ('staff','owner','developer'))
  with check (school_id = public.current_school_id()
         and public.current_user_role() in ('staff','owner','developer'));

-- Apply promotion. p_mapping = jsonb array of:
--   { from_grade, from_classroom, action:'promote'|'graduate'|'keep', to_grade, to_classroom }
-- Two-phase (collect ids by ORIGINAL state, then update by id) so promoting
-- ป.1→ป.2 never cascades into the ป.2→ป.3 rule. Records a full snapshot.
create or replace function public.promote_students(p_mapping jsonb, p_new_year text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid; m jsonb; v_snapshot jsonb := '[]'::jsonb; v_affected int := 0;
  v_run uuid; v_ids uuid[]; v_part jsonb; r record;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('staff','owner','developer') then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  if p_mapping is null or jsonb_typeof(p_mapping) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'ข้อมูลการเลื่อนชั้นไม่ถูกต้อง');
  end if;

  drop table if exists _promo;
  create temp table _promo (ids uuid[], action text, to_grade text, to_classroom text) on commit drop;

  -- phase 1: collect ids + snapshot from ORIGINAL state
  for m in select * from jsonb_array_elements(p_mapping) loop
    select array_agg(s.id) into v_ids
    from public.students s
    where s.school_id = v_school and coalesce(s.status,'active') = 'active'
      and coalesce(s.grade,'')     = coalesce(m->>'from_grade','')
      and coalesce(s.classroom,'') = coalesce(m->>'from_classroom','');

    if v_ids is not null then
      insert into _promo values (v_ids, coalesce(m->>'action','keep'),
                                 nullif(m->>'to_grade',''), nullif(m->>'to_classroom',''));
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'grade', s.grade, 'classroom', s.classroom,
               'academic_year', s.academic_year, 'status', s.status)), '[]'::jsonb)
        into v_part from public.students s where s.id = any(v_ids);
      v_snapshot := v_snapshot || v_part;
    end if;
  end loop;

  -- phase 2: apply by id (no cascade)
  for r in select * from _promo loop
    if r.action = 'promote' then
      update public.students s
        set grade = coalesce(r.to_grade, s.grade),
            classroom = coalesce(r.to_classroom, s.classroom),
            academic_year = coalesce(nullif(p_new_year,''), s.academic_year)
        where s.id = any(r.ids);
    elsif r.action = 'graduate' then
      update public.students s
        set status = 'graduated',
            academic_year = coalesce(nullif(p_new_year,''), s.academic_year)
        where s.id = any(r.ids);
    else  -- keep: just advance the year label
      update public.students s
        set academic_year = coalesce(nullif(p_new_year,''), s.academic_year)
        where s.id = any(r.ids);
    end if;
    v_affected := v_affected + coalesce(array_length(r.ids,1),0);
  end loop;

  if v_affected = 0 then
    return jsonb_build_object('success', false, 'error', 'ไม่มีนักเรียนที่ตรงเงื่อนไข');
  end if;

  insert into public.promotion_runs (school_id, new_year, summary, snapshot, affected, created_by)
  values (v_school, p_new_year, p_mapping, v_snapshot, v_affected, auth.uid())
  returning id into v_run;

  return jsonb_build_object('success', true, 'run_id', v_run, 'affected', v_affected);
end$$;
grant execute on function public.promote_students to authenticated;

create or replace function public.list_promotion_runs()
returns setof public.promotion_runs language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('staff','owner','developer') then return; end if;
  return query select * from public.promotion_runs
    where school_id = v_school order by created_at desc limit 50;
end$$;
grant execute on function public.list_promotion_runs to authenticated;

-- Undo a run: restore every student to its snapshot values.
create or replace function public.undo_promotion(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_snap jsonb; r jsonb; v_n int := 0;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('staff','owner','developer') then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  select snapshot into v_snap from public.promotion_runs
    where id = p_run_id and school_id = v_school and undone = false;
  if v_snap is null then
    return jsonb_build_object('success', false, 'error', 'ไม่พบรายการ หรือย้อนกลับไปแล้ว');
  end if;
  for r in select * from jsonb_array_elements(v_snap) loop
    update public.students s
      set grade = r->>'grade', classroom = r->>'classroom',
          academic_year = r->>'academic_year', status = r->>'status'
      where s.id = (r->>'id')::uuid and s.school_id = v_school;
    v_n := v_n + 1;
  end loop;
  update public.promotion_runs set undone = true where id = p_run_id and school_id = v_school;
  return jsonb_build_object('success', true, 'restored', v_n);
end$$;
grant execute on function public.undo_promotion to authenticated;

-- ============================================================================
-- verify: select public.get_current_term(); select public.list_terms();
--         select public.list_promotion_runs();
-- ============================================================================
