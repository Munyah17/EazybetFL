-- =====================================================================
-- Admin-managed banners: home hero carousel slides + a site-wide
-- announcement strip. Both are "banners" configured the same way
-- (title/description/CTA/active toggle/schedule) -- kind just changes
-- where they render.
-- =====================================================================

create type banner_kind as enum ('hero_slide', 'announcement');
create type banner_accent as enum ('primary', 'boost', 'info');

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  kind banner_kind not null,
  title text not null,
  description text,
  cta_label text,
  cta_href text,
  image_url text,
  accent banner_accent not null default 'primary',
  active boolean not null default true,
  display_order int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_banners_kind_active on public.banners(kind, active, display_order);

create trigger trg_banners_updated_at before update on public.banners
  for each row execute function public.set_updated_at();

alter table public.banners enable row level security;

-- Public read: only currently-active, in-schedule banners. Admin UI reads
-- everything (including inactive/scheduled) via the admin/super_admin
-- branch so the management page can list and edit them.
create policy "banners_public_read_active" on public.banners
  for select using (
    public.is_admin()
    or (
      active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
  );

create policy "banners_admin_write" on public.banners
  for all using (public.is_admin()) with check (public.is_admin());
