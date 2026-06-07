-- ============================================================================
-- Sprint 40 — แบบสอบถาม / โพล (surveys & polls)
-- ============================================================================
-- Staff build a multi-question survey for a role audience; members answer once;
-- staff see aggregated results. Pillar B. Idempotent. Run on prod "School Kit".
-- ============================================================================

create table if not exists public.surveys (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  title       text not null,
  description text,
  audience    text not null default 'all',   -- all | staff | students | parents
  questions   jsonb not null default '[]',    -- [{id,type:'choice'|'rating'|'text',text,options:[]}]
  anonymous   boolean not null default false,
  active      boolean not null default true,
  deadline    date,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists surveys_school_idx on public.surveys (school_id, active);

create table if not exists public.survey_responses (
  id            uuid primary key default gen_random_uuid(),
  survey_id     uuid not null references public.surveys(id) on delete cascade,
  school_id     uuid not null references public.schools(id) on delete cascade,
  respondent_id uuid not null,
  answers       jsonb not null default '{}'::jsonb,
  submitted_at  timestamptz not null default now(),
  unique (survey_id, respondent_id)
);
create index if not exists survey_resp_idx on public.survey_responses (survey_id);

alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;

drop policy if exists sv_staff_manage on public.surveys;
create policy sv_staff_manage on public.surveys for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());
drop policy if exists sv_member_read on public.surveys;
create policy sv_member_read on public.surveys for select to authenticated
  using (school_id = public.current_school_id());

drop policy if exists svr_staff_read on public.survey_responses;
create policy svr_staff_read on public.survey_responses for select to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher());
drop policy if exists svr_own_manage on public.survey_responses;
create policy svr_own_manage on public.survey_responses for all to authenticated
  using (school_id = public.current_school_id() and respondent_id = auth.uid())
  with check (school_id = public.current_school_id() and respondent_id = auth.uid());

-- ---- staff RPCs -------------------------------------------------------------
create or replace function public.save_survey(
  p_id uuid, p_title text, p_description text, p_audience text,
  p_questions jsonb, p_anonymous boolean, p_active boolean, p_deadline date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid; v_aud text;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  if coalesce(btrim(p_title),'')='' then return jsonb_build_object('success',false,'error','กรุณาใส่ชื่อแบบสอบถาม'); end if;
  v_aud := lower(coalesce(p_audience,'all')); if v_aud not in ('all','staff','students','parents') then v_aud:='all'; end if;
  if p_id is null then
    insert into public.surveys (school_id,title,description,audience,questions,anonymous,active,deadline,created_by)
    values (v_school,btrim(p_title),p_description,v_aud,coalesce(p_questions,'[]'::jsonb),coalesce(p_anonymous,false),coalesce(p_active,true),p_deadline,auth.uid())
    returning id into v_id;
  else
    update public.surveys set title=btrim(p_title),description=p_description,audience=v_aud,questions=coalesce(p_questions,'[]'::jsonb),
      anonymous=coalesce(p_anonymous,false),active=coalesce(p_active,active),deadline=p_deadline
    where id=p_id and school_id=v_school returning id into v_id;
    if v_id is null then return jsonb_build_object('success',false,'error','ไม่พบรายการ'); end if;
  end if;
  return jsonb_build_object('success',true,'id',v_id);
end$$;
grant execute on function public.save_survey to authenticated;

create or replace function public.list_surveys()
returns table(id uuid,title text,description text,audience text,questions jsonb,anonymous boolean,active boolean,deadline date,created_at timestamptz,responses bigint)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query select s.id,s.title,s.description,s.audience,s.questions,s.anonymous,s.active,s.deadline,s.created_at,
    (select count(*) from public.survey_responses r where r.survey_id=s.id)
    from public.surveys s where s.school_id=v_school order by s.created_at desc;
end$$;
grant execute on function public.list_surveys to authenticated;

create or replace function public.delete_survey(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  delete from public.surveys where id=p_id and school_id=v_school;
  return jsonb_build_object('success',true);
end$$;
grant execute on function public.delete_survey to authenticated;

create or replace function public.get_survey_results(p_survey_id uuid)
returns table(answers jsonb, submitted_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query select r.answers, r.submitted_at from public.survey_responses r
    where r.survey_id = p_survey_id and r.school_id = v_school order by r.submitted_at desc;
end$$;
grant execute on function public.get_survey_results to authenticated;

-- ---- member RPCs ------------------------------------------------------------
create or replace function public.get_my_surveys()
returns table(id uuid,title text,description text,questions jsonb,anonymous boolean,deadline date,responded boolean)
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_role text;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  v_role := public.current_user_role();
  return query
    select s.id,s.title,s.description,s.questions,s.anonymous,s.deadline,
           exists(select 1 from public.survey_responses r where r.survey_id=s.id and r.respondent_id=auth.uid())
    from public.surveys s
    where s.school_id=v_school and s.active
      and (s.audience='all'
        or (s.audience='staff'    and v_role in ('teacher','staff','owner','developer'))
        or (s.audience='students' and v_role='student')
        or (s.audience='parents'  and v_role='parent'))
    order by s.created_at desc;
end$$;
grant execute on function public.get_my_surveys to authenticated;

create or replace function public.submit_survey(p_survey_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null then return jsonb_build_object('success',false,'error','ไม่พบโรงเรียน'); end if;
  if not exists(select 1 from public.surveys s where s.id=p_survey_id and s.school_id=v_school and s.active) then
    return jsonb_build_object('success',false,'error','ไม่พบแบบสอบถาม');
  end if;
  insert into public.survey_responses (survey_id,school_id,respondent_id,answers,submitted_at)
  values (p_survey_id,v_school,auth.uid(),coalesce(p_answers,'{}'::jsonb),now())
  on conflict (survey_id,respondent_id) do update set answers=excluded.answers, submitted_at=now();
  return jsonb_build_object('success',true);
end$$;
grant execute on function public.submit_survey to authenticated;

-- ============================================================================
