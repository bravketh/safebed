-- SafeBed base schema -------------------------------------------------------

-- Extensions
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- Core lookup types ---------------------------------------------------------
create type public.location_category as enum (
  'shelter',
  'warming_cooling',
  'food_bank',
  'drop_in',
  'washroom',
  'harm_reduction',
  'outreach',
  'clinic',
  'other'
);

create type public.gender_restriction as enum (
  'women',
  'men',
  'all',
  'youth',
  'family'
);

-- Locations table -----------------------------------------------------------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.location_category not null,
  gender_restriction public.gender_restriction default 'all',
  lgbtq_friendly boolean default true,
  accessible boolean,
  pets_allowed boolean,
  phone text,
  website text,
  address text,
  hours jsonb,
  capacity integer,
  beds_available integer,
  notes text,
  source text,
  geom geography(point, 4326) not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  last_verified_at timestamp with time zone,
  latitude double precision generated always as (ST_Y(geom::geometry)) stored,
  longitude double precision generated always as (ST_X(geom::geometry)) stored
);

create index if not exists idx_locations_category on public.locations (category);
create index if not exists idx_locations_gender on public.locations (gender_restriction);
create index if not exists idx_locations_geom on public.locations using gist (geom);

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_locations_updated_at on public.locations;
create trigger trg_locations_updated_at
before update on public.locations
for each row
execute procedure public.set_updated_at();

-- Nearby RPC ---------------------------------------------------------------
create or replace function public.nearby_locations(
  lat double precision,
  lng double precision,
  radius_km double precision default 5,
  cat public.location_category default null,
  only_open boolean default false,
  need_accessible boolean default null,
  need_pets boolean default null,
  gender_focus public.gender_restriction default null
)
returns table (
  id uuid,
  name text,
  category public.location_category,
  phone text,
  website text,
  address text,
  notes text,
  meters double precision,
  capacity integer,
  beds_available integer,
  hours jsonb,
  accessible boolean,
  pets_allowed boolean,
  gender_restriction public.gender_restriction,
  lgbtq_friendly boolean,
  updated_at timestamp with time zone,
  last_verified_at timestamp with time zone,
  latitude double precision,
  longitude double precision,
  source text
)
language sql
stable
as $$
  with me as (
    select ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography as pt
  )
  select
    l.id,
    l.name,
    l.category,
    l.phone,
    l.website,
    l.address,
    l.notes,
    ST_Distance(l.geom, me.pt) as meters,
    l.capacity,
    l.beds_available,
    l.hours,
    l.accessible,
    l.pets_allowed,
    l.gender_restriction,
    l.lgbtq_friendly,
    l.updated_at,
    l.last_verified_at,
    l.latitude,
    l.longitude,
    l.source
  from public.locations l, me
  where ST_DWithin(l.geom, me.pt, radius_km * 1000)
    and (cat is null or l.category = cat)
    and (need_accessible is null or l.accessible = need_accessible)
    and (need_pets is null or l.pets_allowed = need_pets)
    and (gender_focus is null or l.gender_restriction = gender_focus or l.gender_restriction = 'all')
  order by meters
  limit 50;
$$;
