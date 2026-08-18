-- Generic fixed-window rate limiter, backed by Postgres rather than a new
-- external service (Redis/Upstash) -- this app has no infra for that yet,
-- and this is easy to swap out later without touching call sites if
-- volume ever justifies it. Internal-only: called from our own server
-- routes/functions with a caller-chosen key (e.g. 'login:1.2.3.4',
-- 'withdrawal:<user_id>'), never exposed to the client directly.
create table public.rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);
alter table public.rate_limit_hits enable row level security;

create or replace function public.fn_check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limit_hits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rate_limit_hits.count + 1
  returning count into v_count;

  -- Opportunistic cleanup instead of a dedicated cron entry -- cheap,
  -- and this table only ever holds a few hours' worth of rows anyway.
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_max;
end;
$$;

-- service_role only: called from our own server routes (login/signup/
-- deposit) with the admin client, and internally from fn_request_withdrawal
-- (security definer functions call each other via the owner's privileges
-- regardless of grants, same as fn_wallet_credit/fn_wallet_debit).
revoke execute on function public.fn_check_rate_limit(text, int, int) from public;
grant execute on function public.fn_check_rate_limit(text, int, int) to service_role;
