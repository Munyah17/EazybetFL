-- Wire up the previously-dead `audit_logs` table (schema existed since
-- core_schema.sql, RLS already restricts SELECT to super_admin, but
-- nothing ever wrote to it). Deliberately a standalone RPC rather than
-- baking inserts into fn_settle_bet/fn_approve_withdrawal/etc. -- keeps
-- already-verified money-critical functions untouched; the client calls
-- this right after a privileged action succeeds instead.
create or replace function public.fn_write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_old_values jsonb default null,
  p_new_values jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.user_role;
begin
  if v_actor_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select role into v_actor_role from public.profiles where id = v_actor_id;
  if v_actor_role is null or v_actor_role = 'user' then
    raise exception 'NOT_AUTHORIZED';
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_values, new_values)
  values (v_actor_id, v_actor_role, p_action, p_entity_type, p_entity_id, p_old_values, p_new_values);
end;
$$;
grant execute on function public.fn_write_audit_log(text, text, uuid, jsonb, jsonb) to authenticated;
