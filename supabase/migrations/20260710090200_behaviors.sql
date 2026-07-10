-- Behaviors: user-defined actions/events to observe (PRD 9.1, 13).
-- daily_behavior_entries: the current value of a behavior for a given calendar date (PRD 9.3).

create table public.behaviors (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  description       text,
  input_type        public.behavior_input_type not null,
  desired_direction public.behavior_direction  not null,
  unit              text, -- only meaningful for numeric behaviors
  custom_prompt     text,
  sort_order        integer  not null default 0,
  is_active         boolean  not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz -- set when archived; history is preserved (PRD 13.2)
);

create index behaviors_user_id_sort_idx on public.behaviors (user_id, sort_order);

create trigger behaviors_set_updated_at
  before update on public.behaviors
  for each row execute function public.set_updated_at();

create table public.daily_behavior_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  behavior_id   uuid not null references public.behaviors (id) on delete cascade,
  entry_date    date not null,
  -- Exactly one of these is used per entry, according to the behavior's input type.
  -- Both are nullable and never default to 0 so that an explicit "No"/0 stays distinct
  -- from "not recorded" (PRD 8.2). Absence of a row means the behavior is unknown for the day.
  boolean_value boolean,
  numeric_value numeric,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One entry per behavior per user per calendar date (PRD 22).
  constraint daily_behavior_entries_unique_per_day
    unique (user_id, behavior_id, entry_date)
);

create index daily_behavior_entries_user_date_idx
  on public.daily_behavior_entries (user_id, entry_date);

create trigger daily_behavior_entries_set_updated_at
  before update on public.daily_behavior_entries
  for each row execute function public.set_updated_at();

-- Row Level Security -----------------------------------------------------------

alter table public.behaviors enable row level security;

create policy "Behaviors are viewable by their owner"
  on public.behaviors for select
  using ((select auth.uid()) = user_id);

create policy "Behaviors are insertable by their owner"
  on public.behaviors for insert
  with check ((select auth.uid()) = user_id);

create policy "Behaviors are updatable by their owner"
  on public.behaviors for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Behaviors are deletable by their owner"
  on public.behaviors for delete
  using ((select auth.uid()) = user_id);

alter table public.daily_behavior_entries enable row level security;

create policy "Behavior entries are viewable by their owner"
  on public.daily_behavior_entries for select
  using ((select auth.uid()) = user_id);

create policy "Behavior entries are insertable by their owner"
  on public.daily_behavior_entries for insert
  with check ((select auth.uid()) = user_id);

create policy "Behavior entries are updatable by their owner"
  on public.daily_behavior_entries for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Behavior entries are deletable by their owner"
  on public.daily_behavior_entries for delete
  using ((select auth.uid()) = user_id);
