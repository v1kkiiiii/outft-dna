-- 0008_waitlist.sql
-- Website waitlist and creator list. Replaces the website's JSON file, which
-- Vercel does not keep between requests, so signups were being lost.
--
-- The table is not readable or writable from outside: the website calls
-- join_waitlist(), which validates the input, inserts the row, and returns
-- the person's place in line. Nobody can list the emails with the public key.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  handle      text,
  kind        text not null default 'waitlist',
  source      text,
  created_at  timestamptz not null default now(),
  constraint waitlist_kind_check check (kind in ('waitlist', 'creator')),
  constraint waitlist_email_check check (char_length(email) between 3 and 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  constraint waitlist_handle_check check (handle is null or char_length(handle) <= 80),
  constraint waitlist_source_check check (source is null or char_length(source) <= 40),
  constraint waitlist_email_kind_unique unique (email, kind)
);

alter table public.waitlist enable row level security;
alter table public.waitlist force row level security;
revoke all on public.waitlist from anon, authenticated;

-- Returns the place in line (1-based), or -1 if this email is already on
-- this list.
create or replace function public.join_waitlist(
  p_email text,
  p_handle text default null,
  p_kind text default 'waitlist',
  p_source text default 'join'
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_kind text := case when p_kind = 'creator' then 'creator' else 'waitlist' end;
  v_pos integer;
begin
  insert into public.waitlist (email, handle, kind, source)
  values (v_email, nullif(left(trim(coalesce(p_handle, '')), 80), ''), v_kind, left(coalesce(p_source, 'join'), 40))
  on conflict (email, kind) do nothing;
  if not found then
    return -1;
  end if;
  select count(*) into v_pos from public.waitlist where kind = v_kind;
  return v_pos;
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text) to anon, authenticated;
