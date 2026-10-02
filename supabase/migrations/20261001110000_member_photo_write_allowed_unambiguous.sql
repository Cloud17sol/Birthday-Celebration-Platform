-- member_photo_write_allowed failed every owner/admin upload with SQLSTATE 42702.
-- The local name organization_id matched public.members.organization_id, so the
-- members lookup was ambiguous and Storage aborted the insert before writing
-- an object. The authorization rules are unchanged.
-- Local names are path_* so they cannot collide with public.members columns.

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
  path_organization_id uuid;
  path_member_id uuid;
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

  path_organization_id := public.try_cast_uuid(folders[1]);
  path_member_id := public.try_cast_uuid(folders[2]);

  if path_organization_id is null or path_member_id is null then
    return false;
  end if;

  if not public.has_organization_role(
    path_organization_id,
    array['owner', 'admin']::text[]
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.members as member
    where member.id = path_member_id
      and member.organization_id = path_organization_id
  );
end;
$$;
