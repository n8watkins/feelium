-- Reminder settings: one optional daily reminder per user (PRD 17).
-- Push subscriptions: Web Push endpoints registered per device (PRD 18, 22).

create table public.reminder_settings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  is_enabled    boolean not null default false,
  reminder_time time, -- local time-of-day for the single daily reminder
  timezone      text not null default 'UTC',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- The MVP supports exactly one daily reminder, so one settings row per user.
  constraint reminder_settings_one_per_user unique (user_id)
);

create trigger reminder_settings_set_updated_at
  before update on public.reminder_settings
  for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  endpoint          text not null,
  subscription_data jsonb not null, -- full PushSubscription payload (keys, etc.)
  device_name       text,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz,
  -- A device registers a single endpoint per user.
  constraint push_subscriptions_unique_endpoint unique (user_id, endpoint)
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- Row Level Security -----------------------------------------------------------

alter table public.reminder_settings enable row level security;

create policy "Reminder settings are viewable by their owner"
  on public.reminder_settings for select
  using ((select auth.uid()) = user_id);

create policy "Reminder settings are insertable by their owner"
  on public.reminder_settings for insert
  with check ((select auth.uid()) = user_id);

create policy "Reminder settings are updatable by their owner"
  on public.reminder_settings for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Reminder settings are deletable by their owner"
  on public.reminder_settings for delete
  using ((select auth.uid()) = user_id);

alter table public.push_subscriptions enable row level security;

create policy "Push subscriptions are viewable by their owner"
  on public.push_subscriptions for select
  using ((select auth.uid()) = user_id);

create policy "Push subscriptions are insertable by their owner"
  on public.push_subscriptions for insert
  with check ((select auth.uid()) = user_id);

create policy "Push subscriptions are updatable by their owner"
  on public.push_subscriptions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Push subscriptions are deletable by their owner"
  on public.push_subscriptions for delete
  using ((select auth.uid()) = user_id);
