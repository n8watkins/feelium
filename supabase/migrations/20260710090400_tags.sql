-- Tags: lightweight, reusable, user-created context labels (PRD 9.5).
-- check_in_tags: many-to-many join between check-ins and tags.

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  -- Tags are reusable, so avoid duplicates per user.
  constraint tags_unique_name_per_user unique (user_id, name)
);

create index tags_user_id_idx on public.tags (user_id);

create table public.check_in_tags (
  check_in_id uuid not null references public.check_ins (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  primary key (check_in_id, tag_id)
);

create index check_in_tags_tag_id_idx on public.check_in_tags (tag_id);

-- Row Level Security -----------------------------------------------------------

alter table public.tags enable row level security;

create policy "Tags are viewable by their owner"
  on public.tags for select
  using ((select auth.uid()) = user_id);

create policy "Tags are insertable by their owner"
  on public.tags for insert
  with check ((select auth.uid()) = user_id);

create policy "Tags are updatable by their owner"
  on public.tags for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Tags are deletable by their owner"
  on public.tags for delete
  using ((select auth.uid()) = user_id);

-- check_in_tags carry no user_id, so ownership is scoped through both parents (PRD 21):
-- the check-in and the tag must each belong to the current user.
alter table public.check_in_tags enable row level security;

create policy "Check-in tags are viewable through their parent check-in"
  on public.check_in_tags for select
  using (
    exists (
      select 1 from public.check_ins c
      where c.id = check_in_id and c.user_id = (select auth.uid())
    )
  );

create policy "Check-in tags are insertable through their owned parents"
  on public.check_in_tags for insert
  with check (
    exists (
      select 1 from public.check_ins c
      where c.id = check_in_id and c.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.tags t
      where t.id = tag_id and t.user_id = (select auth.uid())
    )
  );

create policy "Check-in tags are deletable through their parent check-in"
  on public.check_in_tags for delete
  using (
    exists (
      select 1 from public.check_ins c
      where c.id = check_in_id and c.user_id = (select auth.uid())
    )
  );
