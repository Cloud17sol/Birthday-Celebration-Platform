-- Monthly celebration activation for one organization.
-- One row per organization per calendar month.
-- Celebrants are not stored here. They are active members whose birth month
-- matches celebration_month, read when the celebration is viewed.
-- Last Friday is chosen by the application. This table only stores that date.

-- ---------------------------------------------------------------------------
-- celebrations
-- ---------------------------------------------------------------------------

create table public.celebrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  celebration_year integer not null,
  celebration_month integer not null,
  celebration_date date not null,
  schedule_rule text not null default 'last_friday',
  status text not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint celebrations_year_check check (
    celebration_year between 1 and 9999
  ),
  constraint celebrations_month_check check (
    celebration_month between 1 and 12
  ),
  -- The stored date must fall in the declared calendar month.
  -- extract() on a date does not use a time zone.
  -- This does not require the date to be a Friday.
  constraint celebrations_date_in_month_check check (
    extract(year from celebration_date)::integer = celebration_year
    and extract(month from celebration_date)::integer = celebration_month
  ),
  -- Later phases may allow more rules. This phase accepts last Friday only.
  constraint celebrations_schedule_rule_check check (
    schedule_rule = 'last_friday'
  ),
  -- Later history work may allow more statuses. This phase accepts active only.
  constraint celebrations_status_check check (
    status = 'active'
  ),
  constraint celebrations_organization_year_month_key unique (
    organization_id,
    celebration_year,
    celebration_month
  )
);

comment on table public.celebrations is
  'Activated monthly celebration for one organization. Not a celebrant list and not a presentation theme.';

comment on column public.celebrations.celebration_date is
  'Calendar date inside celebration_year and celebration_month. The application sets the last Friday. The check does not calculate it.';

comment on column public.celebrations.schedule_rule is
  'How celebration_date was chosen. Only last_friday is allowed in this phase.';

comment on column public.celebrations.status is
  'Activation state. Only active is allowed in this phase.';

comment on column public.celebrations.created_by is
  'Historical author. Nullable. ON DELETE SET NULL. Not used for authorization.';

-- The unique constraint already indexes
-- (organization_id, celebration_year, celebration_month).
-- That is the month lookup. No second index is added.

create trigger celebrations_set_updated_at
before update on public.celebrations
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.celebrations enable row level security;

create policy celebrations_select_organization_member
on public.celebrations
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy celebrations_insert_owner_admin
on public.celebrations
for insert
to authenticated
with check (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
  and created_by = auth.uid()
);

-- No UPDATE policy. Activation is an insert. Undo is a later migration.
-- No DELETE policy. Deleting the organization cascades these rows.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.celebrations from anon, authenticated, service_role;

grant select on table public.celebrations to authenticated;

grant insert (
  organization_id,
  celebration_year,
  celebration_month,
  celebration_date,
  schedule_rule,
  status,
  created_by
) on table public.celebrations to authenticated;
