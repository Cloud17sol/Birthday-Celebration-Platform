-- Departments and groups for one organization.
-- A member may reference one department, one group, both, or neither.
-- Names are unique per organization, case-insensitively, including inactive rows.

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Rejects empty and untrimmed names. Does not rewrite the stored value.
  constraint departments_name_check check (
    char_length(name) between 1 and 80
    and name = btrim(name)
  ),
  -- Target for the member composite foreign key. id remains the primary key.
  constraint departments_organization_id_id_key unique (organization_id, id)
);

comment on table public.departments is
  'Organization-owned department. Not a login role.';

comment on column public.departments.created_by is
  'Historical author. Nullable. ON DELETE SET NULL. Not used for authorization.';

-- Finance, finance, and FINANCE are one name inside an organization.
-- An inactive row keeps the name. Another organization may reuse it.
create unique index departments_organization_id_lower_name_idx
  on public.departments (organization_id, lower(btrim(name)));

create trigger departments_set_updated_at
before update on public.departments
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_check check (
    char_length(name) between 1 and 80
    and name = btrim(name)
  ),
  constraint groups_organization_id_id_key unique (organization_id, id)
);

comment on table public.groups is
  'Organization-owned group. Separate from departments and from organization_members.';

comment on column public.groups.created_by is
  'Historical author. Nullable. ON DELETE SET NULL. Not used for authorization.';

create unique index groups_organization_id_lower_name_idx
  on public.groups (organization_id, lower(btrim(name)));

create trigger groups_set_updated_at
before update on public.groups
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- members associations
-- ---------------------------------------------------------------------------

alter table public.members
  add column department_id uuid,
  add column group_id uuid;

comment on column public.members.department_id is
  'Optional department in the same organization. Null means none.';

comment on column public.members.group_id is
  'Optional group in the same organization. Null means none.';

-- Both columns are nullable, so an association is optional.
-- ON DELETE NO ACTION does not clear or cascade the member.
-- Step 13B must verify that deleting an organization still succeeds.
alter table public.members
  add constraint members_department_tenant_fkey
    foreign key (organization_id, department_id)
    references public.departments (organization_id, id)
    on delete no action,
  add constraint members_group_tenant_fkey
    foreign key (organization_id, group_id)
    references public.groups (organization_id, id)
    on delete no action;

create index members_department_id_not_null_idx
  on public.members (department_id)
  where department_id is not null;

create index members_group_id_not_null_idx
  on public.members (group_id)
  where group_id is not null;

-- ---------------------------------------------------------------------------
-- active assignment rule
-- ---------------------------------------------------------------------------

-- A new or changed association must be an active row in the member's
-- organization. An unchanged department_id or group_id is left alone, even
-- after that row has been deactivated.
create or replace function public.members_validate_department_group_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  department_changed boolean;
  group_changed boolean;
  department_is_active boolean;
  group_is_active boolean;
begin
  if tg_op = 'INSERT' then
    department_changed := new.department_id is not null;
    group_changed := new.group_id is not null;
  else
    department_changed :=
      new.department_id is distinct from old.department_id
      and new.department_id is not null;
    group_changed :=
      new.group_id is distinct from old.group_id
      and new.group_id is not null;
  end if;

  if department_changed then
    select department_rows.is_active
    into department_is_active
    from public.departments as department_rows
    where department_rows.id = new.department_id
      and department_rows.organization_id = new.organization_id;

    if not found then
      raise exception 'department assignment not found'
        using errcode = '23503';
    end if;

    if department_is_active is not true then
      raise exception 'department assignment is inactive'
        using errcode = '23514';
    end if;
  end if;

  if group_changed then
    select group_rows.is_active
    into group_is_active
    from public.groups as group_rows
    where group_rows.id = new.group_id
      and group_rows.organization_id = new.organization_id;

    if not found then
      raise exception 'group assignment not found'
        using errcode = '23503';
    end if;

    if group_is_active is not true then
      raise exception 'group assignment is inactive'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.members_validate_department_group_assignment() is
  'BEFORE INSERT OR UPDATE on members. New associations must be active and in the same organization. Unchanged associations may stay inactive.';

create trigger members_validate_department_group_assignment
before insert or update on public.members
for each row
execute function public.members_validate_department_group_assignment();

-- Trigger function only. Do not grant EXECUTE to client roles.
-- An existing trigger still fires without that grant.
revoke all on function public.members_validate_department_group_assignment()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.departments enable row level security;

create policy departments_select_organization_member
on public.departments
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy departments_insert_owner_admin
on public.departments
for insert
to authenticated
with check (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
  and created_by = auth.uid()
);

create policy departments_update_owner_admin
on public.departments
for update
to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
)
with check (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
);

-- No DELETE policy. Deactivation is is_active = false.

alter table public.groups enable row level security;

create policy groups_select_organization_member
on public.groups
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy groups_insert_owner_admin
on public.groups
for insert
to authenticated
with check (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
  and created_by = auth.uid()
);

create policy groups_update_owner_admin
on public.groups
for update
to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
)
with check (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
);

-- No DELETE policy. Deactivation is is_active = false.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.departments from anon, authenticated, service_role;
revoke all on table public.groups from anon, authenticated, service_role;

grant select on table public.departments to authenticated;
grant select on table public.groups to authenticated;

grant insert (
  organization_id,
  name,
  is_active,
  created_by
) on table public.departments to authenticated;

grant insert (
  organization_id,
  name,
  is_active,
  created_by
) on table public.groups to authenticated;

grant update (
  name,
  is_active
) on table public.departments to authenticated;

grant update (
  name,
  is_active
) on table public.groups to authenticated;

-- Adds columns to the existing members grants. Does not replace them.
grant insert (
  department_id,
  group_id
) on table public.members to authenticated;

grant update (
  department_id,
  group_id
) on table public.members to authenticated;
