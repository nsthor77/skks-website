-- ============================================================================
-- Sprint 46 — โรงอาหาร / กระเป๋าเงินนักเรียน (cafeteria wallet)
-- ============================================================================
-- Per-student prepaid balance + top-up/spend transactions. Staff operate
-- (is_staff_or_higher); students/parents view their own. Idempotent.
-- ============================================================================

create table if not exists public.student_wallets (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  balance    numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (school_id, student_id)
);

create table if not exists public.wallet_transactions (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  type       text not null,            -- topup | spend
  amount     numeric not null,
  note       text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists wtx_idx on public.wallet_transactions (school_id, student_id, created_at desc);

alter table public.student_wallets enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists w_staff on public.student_wallets;
create policy w_staff on public.student_wallets for all to authenticated
  using (school_id=public.current_school_id() and public.is_staff_or_higher())
  with check (school_id=public.current_school_id() and public.is_staff_or_higher());
drop policy if exists w_own on public.student_wallets;
create policy w_own on public.student_wallets for select to authenticated
  using (school_id=public.current_school_id() and student_id = any(public.my_student_ids()));

drop policy if exists wtx_staff on public.wallet_transactions;
create policy wtx_staff on public.wallet_transactions for all to authenticated
  using (school_id=public.current_school_id() and public.is_staff_or_higher())
  with check (school_id=public.current_school_id() and public.is_staff_or_higher());
drop policy if exists wtx_own on public.wallet_transactions;
create policy wtx_own on public.wallet_transactions for select to authenticated
  using (school_id=public.current_school_id() and student_id = any(public.my_student_ids()));

-- top-up / spend (staff)
create or replace function public.wallet_move(p_student_id uuid, p_type text, p_amount numeric, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_bal numeric; v_amt numeric;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  if p_student_id is null then return jsonb_build_object('success',false,'error','ไม่พบนักเรียน'); end if;
  v_amt := abs(coalesce(p_amount,0));
  if v_amt <= 0 then return jsonb_build_object('success',false,'error','จำนวนเงินไม่ถูกต้อง'); end if;

  select balance into v_bal from public.student_wallets where school_id=v_school and student_id=p_student_id;
  v_bal := coalesce(v_bal,0);
  if p_type='spend' then
    if v_bal < v_amt then return jsonb_build_object('success',false,'error','ยอดเงินไม่พอ (คงเหลือ '||v_bal||')'); end if;
    v_bal := v_bal - v_amt;
  else
    p_type := 'topup'; v_bal := v_bal + v_amt;
  end if;

  insert into public.wallet_transactions (school_id,student_id,type,amount,note,created_by)
  values (v_school,p_student_id,p_type,v_amt,p_note,auth.uid());
  insert into public.student_wallets (school_id,student_id,balance,updated_at)
  values (v_school,p_student_id,v_bal,now())
  on conflict (school_id,student_id) do update set balance=v_bal, updated_at=now();
  return jsonb_build_object('success',true,'balance',v_bal);
end$$;
grant execute on function public.wallet_move to authenticated;

create or replace function public.get_wallet(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_bal numeric; v_tx jsonb;
begin
  v_school := public.current_school_id();
  if v_school is null then return null; end if;
  select balance into v_bal from public.student_wallets where school_id=v_school and student_id=p_student_id;
  select coalesce(jsonb_agg(jsonb_build_object('type',t.type,'amount',t.amount,'note',t.note,'at',t.created_at) order by t.created_at desc),'[]'::jsonb)
    into v_tx from (select * from public.wallet_transactions where school_id=v_school and student_id=p_student_id order by created_at desc limit 30) t;
  return jsonb_build_object('balance',coalesce(v_bal,0),'transactions',v_tx);
end$$;
grant execute on function public.get_wallet to authenticated;

create or replace function public.list_wallets()
returns table(student_id uuid, student_name text, grade text, classroom text, balance numeric)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query
    select s.id, btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')), s.grade, s.classroom,
           coalesce(w.balance,0)
    from public.students s
    left join public.student_wallets w on w.student_id=s.id and w.school_id=v_school
    where s.school_id=v_school and coalesce(s.status,'active')='active'
    order by s.grade, s.classroom, s.first_name_th;
end$$;
grant execute on function public.list_wallets to authenticated;

create or replace function public.get_my_wallet()
returns table(student_id uuid, student_name text, balance numeric)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  return query
    select s.id, btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')), coalesce(w.balance,0)
    from public.students s
    left join public.student_wallets w on w.student_id=s.id and w.school_id=v_school
    where s.id = any(public.my_student_ids());
end$$;
grant execute on function public.get_my_wallet to authenticated;

-- ============================================================================
