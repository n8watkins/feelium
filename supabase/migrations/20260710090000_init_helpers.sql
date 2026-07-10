-- Foundation helpers: enum types and the shared updated_at trigger function.
--
-- Design notes (see PRD sections 8.2, 9.1, 9.2, 16.6):
--   * Behaviors support two input types: yes/no (boolean) and number-with-unit (numeric).
--   * Outcomes support three input types: 1-5 rating, yes/no (boolean), number-with-unit.
--   * Behavior direction is a goal (increase / reduce / neutral).
--   * Outcome direction is only an interpretation hint (higher/lower is better / neutral).
--   * "Unknown" is never stored as a value; it is the absence of a row or a NULL column.
--     Numeric value columns are therefore nullable and never default to 0, so an explicit
--     zero stays distinct from "not recorded".

create type public.behavior_input_type as enum ('boolean', 'numeric');

create type public.outcome_input_type as enum ('rating', 'boolean', 'numeric');

create type public.behavior_direction as enum ('increase', 'reduce', 'neutral');

create type public.outcome_direction as enum ('higher_is_better', 'lower_is_better', 'neutral');

-- Keeps updated_at accurate on every row update. Attached as a BEFORE UPDATE trigger
-- on each table that carries an updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
