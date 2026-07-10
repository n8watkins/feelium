-- Profiles: one row per authenticated user, created automatically on sign-up.
-- The row id IS the auth.users id, so ownership is checked with auth.uid() = id.

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text,
  timezone       text     not null default 'UTC',
  -- 0 = Sunday ... 6 = Saturday (ISO week start defaults to Monday = 1).
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Row Level Security: a user may only ever touch their own profile.
alter table public.profiles enable row level security;

create policy "Profiles are viewable by their owner"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Profiles are insertable by their owner"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "Profiles are updatable by their owner"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Create the profile row whenever a new auth user is created. Runs as SECURITY DEFINER
-- so it can write public.profiles from the auth context, with an empty search_path to
-- guard against search-path hijacking (every object is fully schema-qualified).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, timezone, week_starts_on)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC'),
    coalesce((new.raw_user_meta_data ->> 'week_starts_on')::smallint, 1)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
