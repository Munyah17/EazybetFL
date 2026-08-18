-- Minimal support ticket system -- Chat & Pay is peer-to-peer only, and
-- Contact Us was purely static info with no way to actually reach
-- support from inside the app.
create type support_ticket_status as enum ('open', 'resolved');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status support_ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_support_tickets_user on public.support_tickets(user_id, created_at desc);
create index idx_support_tickets_status on public.support_tickets(status, updated_at desc);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  sender_role user_role not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_support_ticket_messages_ticket on public.support_ticket_messages(ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

create policy "support_tickets_select_own_or_admin" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());

create policy "support_ticket_messages_select_own_or_admin" on public.support_ticket_messages
  for select using (
    exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin()))
  );

create or replace function public.fn_create_support_ticket(p_subject text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket_id uuid;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_subject is null or trim(p_subject) = '' then raise exception 'INVALID_SUBJECT'; end if;
  if p_message is null or trim(p_message) = '' then raise exception 'INVALID_MESSAGE'; end if;

  insert into public.support_tickets (user_id, subject) values (v_user_id, p_subject) returning id into v_ticket_id;
  insert into public.support_ticket_messages (ticket_id, sender_id, sender_role, body)
  values (v_ticket_id, v_user_id, 'user', p_message);

  return v_ticket_id;
end;
$$;

create or replace function public.fn_reply_support_ticket(p_ticket_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_ticket public.support_tickets%rowtype;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_message is null or trim(p_message) = '' then raise exception 'INVALID_MESSAGE'; end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id;
  if not found then raise exception 'TICKET_NOT_FOUND'; end if;
  if v_ticket.user_id <> v_user_id and not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select role into v_role from public.profiles where id = v_user_id;

  insert into public.support_ticket_messages (ticket_id, sender_id, sender_role, body)
  values (p_ticket_id, v_user_id, v_role, p_message);

  -- A user reply reopens a resolved ticket; an admin reply doesn't
  -- auto-close it -- they close explicitly via fn_set_ticket_status.
  update public.support_tickets
    set updated_at = now(), status = case when v_ticket.user_id = v_user_id then 'open' else status end
    where id = p_ticket_id;
end;
$$;

create or replace function public.fn_set_ticket_status(p_ticket_id uuid, p_status support_ticket_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = p_ticket_id;
  if not found then raise exception 'TICKET_NOT_FOUND'; end if;
end;
$$;

grant execute on function public.fn_create_support_ticket(text, text) to authenticated;
grant execute on function public.fn_reply_support_ticket(uuid, text) to authenticated;
grant execute on function public.fn_set_ticket_status(uuid, support_ticket_status) to authenticated;
