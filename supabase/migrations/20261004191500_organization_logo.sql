-- Optional organization logo for the public registration form.
-- The object name is a random uuid and does not include the organization id.
-- The bucket is public because the registration page is anonymous.

alter table public.organizations
  add column logo_path text;

alter table public.organizations
  add constraint organizations_logo_path_check check (
    logo_path is null
    or logo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  );

comment on column public.organizations.logo_path is
  'Optional public registration logo. Stores the object name in the organization-logos bucket, not a URL.';

grant update (logo_path) on table public.organizations to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types,
  type,
  versioning_status
)
values (
  'organization-logos',
  'organization-logos',
  true,
  false,
  2097152,
  array['image/webp']::text[],
  'STANDARD'::storage.buckettype,
  'DISABLED'
);

create or replace function public.organization_logo_insert_allowed(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_organization_id uuid;
  current_role text;
begin
  if object_name is null
    or auth.uid() is null
    or position('..' in object_name) > 0
    or position('/' in object_name) > 0
    or position(chr(92) in object_name) > 0
    or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  then
    return false;
  end if;

  select membership.organization_id, membership.role
  into current_organization_id, current_role
  from public.organization_members as membership
  where membership.user_id = auth.uid()
  order by membership.created_at, membership.id
  limit 1;

  if current_organization_id is null
    or current_role not in ('owner', 'admin')
  then
    return false;
  end if;

  return not exists (
    select 1
    from public.organizations as organization
    where organization.logo_path = object_name
      and organization.id <> current_organization_id
  );
end;
$$;

create or replace function public.organization_logo_delete_allowed(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_organization_id uuid;
  current_role text;
begin
  if object_name is null
    or auth.uid() is null
    or position('..' in object_name) > 0
    or position('/' in object_name) > 0
    or position(chr(92) in object_name) > 0
    or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  then
    return false;
  end if;

  select membership.organization_id, membership.role
  into current_organization_id, current_role
  from public.organization_members as membership
  where membership.user_id = auth.uid()
  order by membership.created_at, membership.id
  limit 1;

  if current_organization_id is null
    or current_role not in ('owner', 'admin')
  then
    return false;
  end if;

  if exists (
    select 1
    from public.organizations as organization
    where organization.id = current_organization_id
      and organization.logo_path = object_name
  ) then
    return true;
  end if;

  return exists (
    select 1
    from storage.objects as stored_object
    where stored_object.bucket_id = 'organization-logos'
      and stored_object.name = object_name
      and stored_object.owner = auth.uid()
  )
  and not exists (
    select 1
    from public.organizations as organization
    where organization.logo_path = object_name
  );
end;
$$;

create or replace function public.get_public_organization_logo(registration_token text)
returns text
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  clean_token text;
  logo_path text;
begin
  if registration_token is null or char_length(registration_token) > 43 then
    return null;
  end if;

  clean_token := btrim(registration_token);

  if clean_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;

  select organization.logo_path
  into logo_path
  from public.registration_links as link
  join public.organizations as organization
    on organization.id = link.organization_id
  where link.token = clean_token
    and link.is_enabled = true;

  if not found then
    return null;
  end if;

  return logo_path;
exception
  when others then
    return null;
end;
$$;

comment on function public.get_public_organization_logo(text) is
  'Returns the public registration logo object name for an enabled token. Unknown and disabled tokens return null. Does not return ids or the slug.';

revoke all on function public.organization_logo_insert_allowed(text) from public, anon, authenticated, service_role;
grant execute on function public.organization_logo_insert_allowed(text) to authenticated;

revoke all on function public.organization_logo_delete_allowed(text) from public, anon, authenticated, service_role;
grant execute on function public.organization_logo_delete_allowed(text) to authenticated;

revoke all on function public.get_public_organization_logo(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_organization_logo(text) to anon, authenticated;

create policy organization_logos_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organization-logos'
  and public.organization_logo_insert_allowed(name)
);

create policy organization_logos_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organization-logos'
  and public.organization_logo_delete_allowed(name)
);
