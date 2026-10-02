-- Private member photo storage.
-- Bucket member-photos is not public. Object keys are
-- <organization_id>/<member_id>/<generated-filename>.
-- public.members.photo_url stores that object path, not a URL.
-- This migration does not change public.members.

-- ---------------------------------------------------------------------------
-- Safe UUID parsing
-- ---------------------------------------------------------------------------

-- Storage policies must not cast a path segment directly. A malformed object
-- name would raise invalid_text_representation and abort the statement.
-- This helper returns null instead. It reads no tables.
-- SECURITY INVOKER. It does not bypass RLS and has no elevated privileges.

create or replace function public.try_cast_uuid(value text)
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  normalized text;
begin
  if value is null then
    return null;
  end if;

  normalized := btrim(value);

  if normalized = '' then
    return null;
  end if;

  return normalized::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

comment on function public.try_cast_uuid(text) is
  'Parses text as uuid. Returns null for null, blank, or malformed input instead of raising.';

revoke all on function public.try_cast_uuid(text) from public, anon, authenticated, service_role;
grant execute on function public.try_cast_uuid(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Member-scoped write check
-- ---------------------------------------------------------------------------

-- True only when object_name is <organization_uuid>/<member_uuid>/<filename>,
-- auth.uid() is an owner or admin of that organization, and that member row
-- belongs to the same organization.
-- SECURITY INVOKER so the members lookup is subject to public.members RLS.
-- Does not use is_active. Inactive members may still have photos.
-- Does not query organization_members. Role checks go through
-- public.has_organization_role, which is the existing definer helper.

create or replace function public.member_photo_write_allowed(object_name text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  folders text[];
  file_name text;
  organization_id uuid;
  member_id uuid;
begin
  if object_name is null or auth.uid() is null then
    return false;
  end if;

  -- chr(92) is a backslash. A quoted backslash is easy to get wrong in LIKE.
  if position('..' in object_name) > 0 or position(chr(92) in object_name) > 0 then
    return false;
  end if;

  folders := storage.foldername(object_name);
  file_name := storage.filename(object_name);

  if folders is null or cardinality(folders) <> 2 then
    return false;
  end if;

  if file_name is null or btrim(file_name) = '' or file_name in ('.', '..') then
    return false;
  end if;

  organization_id := public.try_cast_uuid(folders[1]);
  member_id := public.try_cast_uuid(folders[2]);

  if organization_id is null or member_id is null then
    return false;
  end if;

  if not public.has_organization_role(
    organization_id,
    array['owner', 'admin']::text[]
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.members as member
    where member.id = member_id
      and member.organization_id = organization_id
  );
end;
$$;

comment on function public.member_photo_write_allowed(text) is
  'True when auth.uid() may write this member-photo object path. Malformed paths return false.';

revoke all on function public.member_photo_write_allowed(text) from public, anon, authenticated, service_role;
grant execute on function public.member_photo_write_allowed(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Private bucket
-- ---------------------------------------------------------------------------

-- file_size_limit is bytes. 5242880 = 5 MiB.
-- allowed_mime_types is enforced by the Storage API on upload.
-- public = false. No public object URL.
-- avif_autodetection stays off so AVIF is not accepted through conversion.
-- type STANDARD and versioning DISABLED match the installed defaults and are
-- set explicitly so the bucket does not depend on a later default change.

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
  'member-photos',
  'member-photos',
  false,
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'STANDARD'::storage.buckettype,
  'DISABLED'
);

-- ---------------------------------------------------------------------------
-- storage.objects policies
-- ---------------------------------------------------------------------------

-- storage.objects RLS is already enabled on the hosted project.
-- These policies are permissive and apply only to authenticated.
-- No policy is created for anon or public. With RLS enabled and the bucket
-- private, anonymous requests are denied.
-- Existing storage.objects grants are left unchanged. Supabase Storage uses
-- those grants and relies on RLS for authorization.

-- Any authenticated member of the path organization may read.
-- The first folder must be a uuid for an organization the user belongs to.
-- Read does not require the second folder to match a member row.
-- Writes below are member-scoped, so client uploads cannot create other keys.

create policy member_photos_select_organization_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'member-photos'
  and position('..' in name) = 0
  and position(chr(92) in name) = 0
  and cardinality(storage.foldername(name)) = 2
  and storage.filename(name) <> ''
  and public.is_organization_member(
    public.try_cast_uuid((storage.foldername(name))[1])
  )
);

-- Owner or admin may insert only a key tied to a real member in that org.

create policy member_photos_insert_owner_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-photos'
  and public.member_photo_write_allowed(name)
);

-- USING and WITH CHECK both require a member-scoped key, so an object cannot
-- be moved to another organization or to a path that is not a member photo.

create policy member_photos_update_owner_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-photos'
  and public.member_photo_write_allowed(name)
)
with check (
  bucket_id = 'member-photos'
  and public.member_photo_write_allowed(name)
);

create policy member_photos_delete_owner_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-photos'
  and public.member_photo_write_allowed(name)
);
