-- Initial multi-tenant foundation.
-- Draft for review. Do not treat this file as applied.
--
-- Identity stays in auth.users. This migration adds:
--   public.profiles
--   public.organizations
--   public.organization_members
--
-- Organization creation is only through public.create_organization().
-- Direct client inserts into organizations and organization_members are not granted.
-- Email and passwords stay in Supabase Auth. Profiles have no global role.

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger. Overwrites updated_at. Does not read or write other tables.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_check check (
    full_name is null
    or (
      char_length(full_name) between 1 and 200
      and full_name = btrim(full_name)
    )
  )
);

comment on table public.profiles is
  'Application profile for an auth.users row. Created by trigger, not by client insert.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_check check (
    char_length(name) between 1 and 80
    and name = btrim(name)
  ),
  constraint organizations_slug_check check (
    char_length(slug) between 1 and 63
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint organizations_slug_key unique (slug)
);

comment on table public.organizations is
  'One tenant. Slug is lowercase and URL-safe, for example lxb or hungahub.';

comment on column public.organizations.created_by is
  'Historical creator metadata. Nullable. ON DELETE SET NULL so deleting the Auth user does not delete the organization or block that deletion. create_organization() sets auth.uid() at insert. Not used for authorization.';

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint organization_members_role_check check (
    role in ('owner', 'admin', 'member')
  ),
  constraint organization_members_organization_id_user_id_key unique (organization_id, user_id)
);

comment on table public.organization_members is
  'One membership per user per organization. Role is per membership, not global.';

-- Unique (organization_id, user_id) already indexes organization-scoped lookups.
-- user_id index supports "organizations for this user".
create index organization_members_user_id_idx
  on public.organization_members (user_id);

create index organization_members_organization_id_role_idx
  on public.organization_members (organization_id, role);

-- ---------------------------------------------------------------------------
-- Profile automation
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so signup can insert a profile even though clients have no INSERT grant.
-- search_path is empty and the insert is schema-qualified.
-- row_security is off so the insert is not blocked by the owner's RLS.
-- This function cannot assign an organization role or membership.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  metadata_name text;
begin
  metadata_name := nullif(
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 200),
    ''
  );

  insert into public.profiles (id, full_name)
  values (new.id, metadata_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT on auth.users. Inserts public.profiles only. Does not create a membership.';

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Idempotent backfill for Auth users created before this trigger existed.
insert into public.profiles (id, full_name)
select
  users.id,
  nullif(
    left(btrim(coalesce(users.raw_user_meta_data ->> 'full_name', '')), 200),
    ''
  )
from auth.users as users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

-- Both helpers read organization_members as the function owner, outside RLS.
-- Policies must call these instead of querying organization_members directly,
-- or an organization_members policy would recurse.
-- The user id always comes from auth.uid(). There is no user-id argument.

create or replace function public.is_organization_member(org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if org_id is null or auth.uid() is null then
    return false;
  end if;

  return exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = org_id
      and membership.user_id = auth.uid()
  );
end;
$$;

comment on function public.is_organization_member(uuid) is
  'True when auth.uid() has a membership in org_id. Does not accept a user id.';

create or replace function public.has_organization_role(
  org_id uuid,
  allowed_roles text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if org_id is null or auth.uid() is null or allowed_roles is null then
    return false;
  end if;

  return exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = org_id
      and membership.user_id = auth.uid()
      and membership.role = any (allowed_roles)
  );
end;
$$;

comment on function public.has_organization_role(uuid, text[]) is
  'True when auth.uid() has one of allowed_roles in org_id. Does not accept a user id.';

-- ---------------------------------------------------------------------------
-- Organization bootstrap
-- ---------------------------------------------------------------------------

-- Sole supported way to create an organization.
-- Inserts the organization and the creator's owner membership in one transaction.
-- Caller cannot supply a user id or a role.
create or replace function public.create_organization(
  organization_name text,
  organization_slug text
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  clean_name text;
  clean_slug text;
  created_organization public.organizations;
begin
  if current_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  clean_name := btrim(organization_name);
  clean_slug := btrim(organization_slug);

  if clean_name is null
    or char_length(clean_name) < 1
    or char_length(clean_name) > 80
  then
    raise exception 'invalid organization name'
      using errcode = '23514';
  end if;

  if clean_slug is null
    or char_length(clean_slug) < 1
    or char_length(clean_slug) > 63
    or clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then
    raise exception 'invalid organization slug'
      using errcode = '23514';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (clean_name, clean_slug, current_user_id)
  returning * into created_organization;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization.id, current_user_id, 'owner');

  return created_organization;
end;
$$;

comment on function public.create_organization(text, text) is
  'Creates an organization for auth.uid(). Sets created_by to auth.uid() as historical metadata and inserts that user as owner. Authorization uses the membership row, not created_by. Role and user id are not arguments.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (public.is_organization_member(id));

create policy organizations_update_owner_admin
on public.organizations
for update
to authenticated
using (public.has_organization_role(id, array['owner', 'admin']::text[]))
with check (public.has_organization_role(id, array['owner', 'admin']::text[]));

create policy organization_members_select_same_organization
on public.organization_members
for select
to authenticated
using (public.is_organization_member(organization_id));

-- No INSERT, UPDATE, or DELETE policies on organizations or organization_members.
-- No INSERT or DELETE policies on profiles.
-- Membership changes after bootstrap need a later, explicit RPC.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

-- Clear default grants, then grant only what clients need.
revoke all on table public.profiles from anon, authenticated, service_role;
revoke all on table public.organizations from anon, authenticated, service_role;
revoke all on table public.organization_members from anon, authenticated, service_role;

grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

grant select on table public.organizations to authenticated;
grant update (name, slug) on table public.organizations to authenticated;

grant select on table public.organization_members to authenticated;

-- Trigger function only. Do not grant EXECUTE to client roles.
-- An existing trigger still fires for UPDATE without that grant.
revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to supabase_auth_admin;

revoke all on function public.is_organization_member(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_organization_member(uuid) to authenticated;

revoke all on function public.has_organization_role(uuid, text[]) from public, anon, authenticated, service_role;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;

revoke all on function public.create_organization(text, text) from public, anon, authenticated, service_role;
grant execute on function public.create_organization(text, text) to authenticated;
