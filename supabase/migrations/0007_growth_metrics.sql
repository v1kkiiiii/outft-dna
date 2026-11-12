-- 0007_growth_metrics.sql
-- Onboarding instrumentation, AI cost log, re-engagement preferences, brand
-- discount-code attribution, and referral codes. Everything here stays inside
-- our own database; nothing is sent to third-party analytics.

-- =========================================================================
-- Product events (append-only). Metrics are derived from these rows by
-- scripts/metrics.mjs and GET /api/admin/metrics.
-- =========================================================================
create table public.app_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint app_events_name_check check (name in (
    'signup', 'terms_accepted', 'session_start',
    'onboarding_photo_uploaded', 'onboarding_photo_failed',
    'photo_uploaded', 'analysis_completed', 'analysis_failed',
    'first_dna_read', 'dna_viewed', 'twin_match_viewed',
    'sharpen_prompt_shown', 'sharpen_prompt_tapped',
    'share_tapped', 'story_exported', 'onboarding_completed',
    'paywall_shown', 'paywall_plan_tapped'
  ))
);
create index app_events_user_time on public.app_events (user_id, created_at);
create index app_events_name_time on public.app_events (name, created_at);

alter table public.app_events enable row level security;
create policy app_events_insert_own on public.app_events
  for insert to authenticated with check (user_id = auth.uid());
create policy app_events_select_own on public.app_events
  for select to authenticated using (user_id = auth.uid());

-- =========================================================================
-- AI cost per analysis. Written only by the server (service role); clients
-- have no access. Never stores image data or prompts.
-- =========================================================================
create table public.ai_cost_log (
  id                    bigint generated always as identity primary key,
  user_id               uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  purpose               text not null default 'analysis',
  model                 text not null,
  input_tokens          integer not null default 0,
  output_tokens         integer not null default 0,
  cache_read_tokens     integer not null default 0,
  cache_write_tokens    integer not null default 0,
  estimated_usd         numeric(12, 6) not null default 0,
  ok                    boolean not null default true
);
create index ai_cost_log_user_time on public.ai_cost_log (user_id, created_at);
alter table public.ai_cost_log enable row level security;
-- No policies: only the service role (which bypasses RLS) can read or write.

-- =========================================================================
-- Plan and analysis allowance (pricing flag is off by default; payments are
-- not live, so 'premium' can only be set by an admin for testing).
-- =========================================================================
create table public.entitlements (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  plan        text not null default 'free',
  updated_at  timestamptz not null default now(),
  constraint entitlements_plan_check check (plan in ('free', 'premium'))
);
alter table public.entitlements enable row level security;
create policy entitlements_select_own on public.entitlements
  for select to authenticated using (user_id = auth.uid());

-- =========================================================================
-- Re-engagement: opt-in only. Every email carries an unsubscribe link built
-- from unsubscribe_token.
-- =========================================================================
create table public.notification_prefs (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  email               text,
  push_token          text,
  daily_reminder      boolean not null default false,
  wrapped_ready       boolean not null default false,
  twin_match          boolean not null default false,
  unsubscribe_token   uuid not null default gen_random_uuid(),
  unsubscribed_at     timestamptz,
  updated_at          timestamptz not null default now(),
  constraint notification_prefs_token_unique unique (unsubscribe_token)
);
alter table public.notification_prefs enable row level security;
create policy notification_prefs_select_own on public.notification_prefs
  for select to authenticated using (user_id = auth.uid());
create policy notification_prefs_insert_own on public.notification_prefs
  for insert to authenticated with check (user_id = auth.uid());
create policy notification_prefs_update_own on public.notification_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.notification_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  kind        text not null,
  channel     text not null,
  provider    text not null,
  status      text not null,
  created_at  timestamptz not null default now(),
  constraint notification_log_kind_check check (kind in ('daily_reminder', 'wrapped_ready', 'twin_match')),
  constraint notification_log_channel_check check (channel in ('email', 'push'))
);
alter table public.notification_log enable row level security;

-- =========================================================================
-- Brand discount-code attribution (stub: API + data model, no UI yet).
-- =========================================================================
create table public.brand_campaigns (
  id             uuid primary key default gen_random_uuid(),
  brand_name     text not null,
  code           text not null,
  style_cluster  text not null,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  constraint brand_campaigns_code_unique unique (code)
);
alter table public.brand_campaigns enable row level security;
create policy brand_campaigns_select_active on public.brand_campaigns
  for select to anon, authenticated using (active);

create table public.campaign_events (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references public.brand_campaigns(id) on delete cascade,
  kind         text not null,
  user_id      uuid references auth.users(id) on delete set null,
  outfit_id    uuid,
  created_at   timestamptz not null default now(),
  constraint campaign_events_kind_check check (kind in ('impression', 'click', 'redemption'))
);
create index campaign_events_campaign on public.campaign_events (campaign_id, kind);
alter table public.campaign_events enable row level security;
-- Written by the server only.

create view public.campaign_stats with (security_invoker = true) as
select c.id, c.brand_name, c.code, c.style_cluster, c.active,
       count(*) filter (where e.kind = 'impression') as impressions,
       count(*) filter (where e.kind = 'click')      as clicks,
       count(*) filter (where e.kind = 'redemption') as redemptions
from public.brand_campaigns c
left join public.campaign_events e on e.campaign_id = c.id
group by c.id;

-- =========================================================================
-- Referral / ambassador codes. Record only: no payouts.
-- =========================================================================
create table public.referral_codes (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  code        text not null,
  created_at  timestamptz not null default now(),
  constraint referral_codes_code_unique unique (code),
  constraint referral_codes_format check (code ~ '^[A-Z0-9]{6,12}$')
);
alter table public.referral_codes enable row level security;
create policy referral_codes_select_own on public.referral_codes
  for select to authenticated using (user_id = auth.uid());

create table public.referrals (
  id                 bigint generated always as identity primary key,
  referrer_id        uuid not null references auth.users(id) on delete cascade,
  referred_user_id   uuid not null references auth.users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  became_paid_at     timestamptz,
  credited_at        timestamptz,
  constraint referrals_referred_unique unique (referred_user_id),
  constraint referrals_not_self check (referrer_id <> referred_user_id)
);
alter table public.referrals enable row level security;
create policy referrals_select_mine on public.referrals
  for select to authenticated using (referrer_id = auth.uid() or referred_user_id = auth.uid());

-- Returns (creating on first call) the caller's referral code.
create or replace function public.my_referral_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  existing text;
  candidate text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select code into existing from public.referral_codes where user_id = auth.uid();
  if existing is not null then return existing; end if;
  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.referral_codes (user_id, code) values (auth.uid(), candidate);
      return candidate;
    exception when unique_violation then
      -- collision, try again
    end;
  end loop;
end $$;

-- Links the caller (a new signup) to the owner of a referral code. Returns
-- false for an unknown code, a self-referral, or an already-referred user.
create or replace function public.redeem_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select user_id into owner from public.referral_codes where code = upper(trim(p_code));
  if owner is null or owner = auth.uid() then return false; end if;
  insert into public.referrals (referrer_id, referred_user_id) values (owner, auth.uid())
  on conflict (referred_user_id) do nothing;
  return found;
end $$;

revoke all on function public.my_referral_code() from public;
revoke all on function public.redeem_referral(text) from public;
grant execute on function public.my_referral_code() to authenticated;
grant execute on function public.redeem_referral(text) to authenticated;
