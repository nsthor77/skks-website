-- ============================================================================
-- Sprint 44 — งบประมาณรายหมวด (budget planning + actual-vs-budget)
-- ============================================================================
-- Adds a budgets table (planned amount per category/year) and reuses the
-- existing finance_transactions ledger for ACTUAL spend per category. Finance
-- feature → owner-gated. Idempotent. Run on prod "School Kit".
-- ============================================================================

create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  category      text not null,
  academic_year text,
  amount        numeric not null default 0,
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  unique (school_id, category, academic_year)
);
create index if not exists budgets_school_idx on public.budgets (school_id, academic_year);

alter table public.budgets enable row level security;
drop policy if exists bud_owner_manage on public.budgets;
create policy bud_owner_manage on public.budgets for all to authenticated
  using (school_id = public.current_school_id() and public.current_user_role() in ('owner','developer'))
  with check (school_id = public.current_school_id() and public.current_user_role() in ('owner','developer'));

create or replace function public.save_budget(p_category text, p_year text, p_amount numeric, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  if coalesce(btrim(p_category),'')='' then return jsonb_build_object('success',false,'error','กรุณาใส่หมวด'); end if;
  insert into public.budgets (school_id, category, academic_year, amount, note, created_by)
  values (v_school, btrim(p_category), p_year, coalesce(p_amount,0), p_note, auth.uid())
  on conflict (school_id, category, academic_year) do update set amount=excluded.amount, note=excluded.note;
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.save_budget to authenticated;

create or replace function public.list_budgets(p_year text)
returns table(id uuid, category text, academic_year text, amount numeric, note text)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return; end if;
  return query select b.id,b.category,b.academic_year,b.amount,b.note from public.budgets b
    where b.school_id=v_school and (p_year is null or coalesce(b.academic_year,'')=p_year) order by b.category;
end$$;
grant execute on function public.list_budgets to authenticated;

create or replace function public.delete_budget(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  delete from public.budgets where id=p_id and school_id=v_school;
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.delete_budget to authenticated;

-- actual expense per category from finance_transactions (best-effort: schema may
-- vary across tenants → wrapped so it degrades to empty instead of erroring).
create or replace function public.get_expense_by_category(p_year text)
returns table(category text, spent numeric)
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_cal int;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('owner','developer') then return; end if;
  begin v_cal := nullif(regexp_replace(coalesce(p_year,''),'\D','','g'),'')::int - 543; exception when others then v_cal := null; end;
  begin
    return query
      select ft.category, sum(ft.amount)::numeric
      from public.finance_transactions ft
      where ft.school_id = v_school and ft.type = 'expense'
        and (v_cal is null or extract(year from ft.transaction_date) = v_cal)
      group by ft.category;
  exception when others then
    return;   -- table/column not present for this tenant → no actuals
  end;
end$$;
grant execute on function public.get_expense_by_category to authenticated;

-- ============================================================================
-- verify: select public.list_budgets(null); select public.get_expense_by_category('2567');
-- ============================================================================
