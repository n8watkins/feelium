-- Outcome metrics: user-defined feelings/states (PRD 9.2, 14).
-- Check-ins: timestamped snapshots of how the user feels (PRD 9.4).
-- Check-in values: one recorded value per outcome metric within a check-in.

create table public.outcome_metrics (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  description       text,
  input_type        public.outcome_input_type not null,
  desired_direction public.outcome_direction, -- optional; interpretation hint only (PRD 14.1)
  unit              text,
  sort_order        integer  not null default 0,
  is_active         boolean  not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz
);

create index outcome_metrics_user_id_sort_idx on public.outcome_metrics (user_id, sort_order);

create trigger outcome_metrics_set_updated_at
  before update on public.outcome_metrics
  for each row execute function public.set_updated_at();

create table public.check_ins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  -- The user's local calendar date for the check-in, so grouping stays correct across
  -- midnight and timezone changes (PRD 23).
  local_date  date not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index check_ins_user_local_date_idx on public.check_ins (user_id, local_date);
create index check_ins_user_occurred_idx on public.check_ins (user_id, occurred_at);

create trigger check_ins_set_updated_at
  before update on public.check_ins
  for each row execute function public.set_updated_at();

create table public.check_in_values (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  check_in_id       uuid not null references public.check_ins (id) on delete cascade,
  outcome_metric_id uuid not null references public.outcome_metrics (id) on delete cascade,
  -- One column is populated according to the metric's input type. All nullable and never
  -- defaulted, so an explicit 0/No stays distinct from "not recorded" (PRD 8.2, 16.6).
  rating_value      smallint check (rating_value between 1 and 5),
  boolean_value     boolean,
  numeric_value     numeric,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- One value per outcome metric per check-in (PRD 22).
  constraint check_in_values_unique_per_metric
    unique (check_in_id, outcome_metric_id)
);

create index check_in_values_check_in_idx on public.check_in_values (check_in_id);
create index check_in_values_metric_idx on public.check_in_values (outcome_metric_id);

create trigger check_in_values_set_updated_at
  before update on public.check_in_values
  for each row execute function public.set_updated_at();

-- Row Level Security -----------------------------------------------------------

alter table public.outcome_metrics enable row level security;

create policy "Outcome metrics are viewable by their owner"
  on public.outcome_metrics for select
  using ((select auth.uid()) = user_id);

create policy "Outcome metrics are insertable by their owner"
  on public.outcome_metrics for insert
  with check ((select auth.uid()) = user_id);

create policy "Outcome metrics are updatable by their owner"
  on public.outcome_metrics for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Outcome metrics are deletable by their owner"
  on public.outcome_metrics for delete
  using ((select auth.uid()) = user_id);

alter table public.check_ins enable row level security;

create policy "Check-ins are viewable by their owner"
  on public.check_ins for select
  using ((select auth.uid()) = user_id);

create policy "Check-ins are insertable by their owner"
  on public.check_ins for insert
  with check ((select auth.uid()) = user_id);

create policy "Check-ins are updatable by their owner"
  on public.check_ins for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Check-ins are deletable by their owner"
  on public.check_ins for delete
  using ((select auth.uid()) = user_id);

-- check_in_values are scoped through their parent check-in's ownership (PRD 21).
-- The value must belong to a check-in owned by the user; the denormalized user_id must
-- also match, keeping the row internally consistent.
alter table public.check_in_values enable row level security;

create policy "Check-in values are viewable through their parent check-in"
  on public.check_in_values for select
  using (
    exists (
      select 1 from public.check_ins c
      where c.id = check_in_id and c.user_id = (select auth.uid())
    )
  );

create policy "Check-in values are insertable through their parent check-in"
  on public.check_in_values for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.check_ins c
      where c.id = check_in_id and c.user_id = (select auth.uid())
    )
  );

create policy "Check-in values are updatable through their parent check-in"
  on public.check_in_values for update
  using (
    exists (
      select 1 from public.check_ins c
      where c.id = check_in_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.check_ins c
      where c.id = check_in_id and c.user_id = (select auth.uid())
    )
  );

create policy "Check-in values are deletable through their parent check-in"
  on public.check_in_values for delete
  using (
    exists (
      select 1 from public.check_ins c
      where c.id = check_in_id and c.user_id = (select auth.uid())
    )
  );
