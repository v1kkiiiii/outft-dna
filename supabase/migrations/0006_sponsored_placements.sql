-- 0006_sponsored_placements.sql
-- Remotely managed sponsored content. The app fetches active placements per
-- surface ('twins' grid, 'home' spotlight card) so founders can add/pause
-- brand deals from the Supabase SQL editor without shipping an app update.
-- Writable only via service_role (RLS has no insert/update/delete policies);
-- readable by anon + authenticated so the slot works before sign-in.

create table public.sponsored_placements (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  caption text not null,
  dna_copy text not null,
  tags text[] not null default '{}',
  tone text not null,
  shop_url text not null,
  surface text not null check (surface in ('twins', 'home')),
  weight int not null default 1,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index sponsored_placements_surface_active_idx
  on public.sponsored_placements (surface, active, weight desc);

alter table public.sponsored_placements enable row level security;
alter table public.sponsored_placements force row level security;

-- Read-only for app clients; all writes go through service_role (bypasses RLS).
create policy sponsored_placements_select_all
  on public.sponsored_placements for select
  to anon, authenticated
  using (true);

-- Seed: the three current twins-grid picks plus the home spotlight slot,
-- mirroring app/src/data.ts BRAND_PICKS so remote and fallback content match.
insert into public.sponsored_placements (brand, caption, dna_copy, tags, tone, shop_url, surface, weight) values
  ('Toteme', 'The scarf coat, styled quiet.', 'Matched to your palette discipline and long-line silhouette.', array['quiet luxury', 'tonal'], '#DCD3C6', 'https://toteme-studio.com', 'twins', 3),
  ('COS', 'Structured wool, softened edges.', 'Echoes your structured-neutral trace this month.', array['minimal', 'structured'], '#CBC2B2', 'https://cos.com', 'twins', 2),
  ('Arket', 'Everyday layers in stone.', 'Picked for your scandi lean and soft-layer echoes.', array['scandi', 'daily'], '#BFC9C4', 'https://arket.com', 'twins', 1),
  ('Toteme', 'Shop the pieces closest to your trace.', 'Quiet luxury lane', array['quiet luxury'], '#DCD3C6', 'https://toteme-studio.com', 'home', 1);
