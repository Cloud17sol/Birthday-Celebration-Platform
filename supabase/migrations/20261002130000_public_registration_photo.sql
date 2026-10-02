-- Optional photo on a public registration.
-- The picture is stored only when the visitor chooses one.
-- The object stays private under {organization}/registrations/{submission}.webp
-- until an owner or admin approves the registration and copies it onto the member.

alter table public.member_submissions
  add column photo_path text;

alter table public.member_submissions
  add constraint member_submissions_photo_path_check check (
    photo_path is null
    or (
      char_length(photo_path) between 1 and 2048
      and photo_path = btrim(photo_path)
      and photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/registrations/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
    )
  );

comment on column public.member_submissions.photo_path is
  'Private storage path for an optional registration photo. Null when the visitor did not upload one.';

alter type public.member_registration_submit_result
  add attribute submission_id uuid;

alter type public.member_registration_submit_result
  add attribute organization_id uuid;

-- The previous two-field row cast no longer matches the composite.
create or replace function public.submit_member_registration(
  registration_token text,
  first_name text,
  last_name text,
  birth_month integer,
  birth_day integer,
  birth_year integer,
  email text,
  phone text
)
returns public.member_registration_submit_result
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
declare
  result public.member_registration_submit_result;
  clean_token text;
  clean_first text;
  clean_last text;
  clean_email text;
  clean_phone text;
  clean_year integer;
  clean_month integer;
  clean_day integer;
  maximum_day integer;
  current_year integer;
  link_id uuid;
  resolved_organization_id uuid;
  recent_count bigint;
  derived_display_name text;
begin
  result := row(false, 'invalid_input', null, null)::public.member_registration_submit_result;

  clean_first := btrim(coalesce(first_name, ''));
  clean_last := btrim(coalesce(last_name, ''));
  clean_email := nullif(btrim(coalesce(email, '')), '');
  clean_phone := nullif(btrim(coalesce(phone, '')), '');
  current_year := extract(year from current_date)::integer;

  if char_length(clean_first) < 1 or char_length(clean_first) > 100
    or char_length(clean_last) < 1 or char_length(clean_last) > 100
    or char_length(clean_first) + char_length(clean_last) + 1 > 200
  then
    return result;
  end if;

  if clean_email is null and clean_phone is null then
    return result;
  end if;

  if clean_email is not null and (
    char_length(clean_email) > 254
    or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    return result;
  end if;

  if clean_phone is not null and char_length(clean_phone) > 50 then
    return result;
  end if;

  if birth_month is null or birth_month < 1 or birth_month > 12
    or birth_day is null or birth_day < 1
  then
    return result;
  end if;

  clean_year := birth_year;

  if clean_year is not null and (
    clean_year < 1900 or clean_year > current_year
  ) then
    return result;
  end if;

  if birth_month = 2 then
    if clean_year is null
      or (clean_year % 4 = 0 and clean_year % 100 <> 0)
      or (clean_year % 400 = 0)
    then
      maximum_day := 29;
    else
      maximum_day := 28;
    end if;
  elsif birth_month in (4, 6, 9, 11) then
    maximum_day := 30;
  else
    maximum_day := 31;
  end if;

  if birth_day > maximum_day then
    return result;
  end if;

  clean_month := birth_month;
  clean_day := birth_day;

  if registration_token is null or char_length(registration_token) > 43 then
    result.code := 'invalid_link';
    return result;
  end if;

  clean_token := btrim(registration_token);

  if clean_token !~ '^[A-Za-z0-9_-]{43}$' then
    result.code := 'invalid_link';
    return result;
  end if;

  select link.id, link.organization_id
  into link_id, resolved_organization_id
  from public.registration_links as link
  where link.token = clean_token
    and link.is_enabled = true
  for update;

  if not found then
    result.code := 'invalid_link';
    return result;
  end if;

  select count(*)
  into recent_count
  from public.member_submissions as recent_submission
  where recent_submission.organization_id = resolved_organization_id
    and recent_submission.created_at >= now() - interval '1 hour';

  if recent_count >= 30 then
    result.code := 'rate_limited';
    return result;
  end if;

  if clean_email is not null and (
    exists (
      select 1
      from public.member_submissions as existing_submission
      where existing_submission.organization_id = resolved_organization_id
        and existing_submission.status in ('pending', 'approved')
        and existing_submission.email is not null
        and lower(existing_submission.email) = lower(clean_email)
    )
    or exists (
      select 1
      from public.members as existing_member
      where existing_member.organization_id = resolved_organization_id
        and existing_member.is_active = true
        and existing_member.email is not null
        and lower(existing_member.email) = lower(clean_email)
    )
  ) then
    result.code := 'duplicate';
    return result;
  end if;

  if clean_phone is not null and (
    exists (
      select 1
      from public.member_submissions as existing_submission
      where existing_submission.organization_id = resolved_organization_id
        and existing_submission.status in ('pending', 'approved')
        and existing_submission.phone is not null
        and existing_submission.phone = clean_phone
    )
    or exists (
      select 1
      from public.members as existing_member
      where existing_member.organization_id = resolved_organization_id
        and existing_member.is_active = true
        and existing_member.phone is not null
        and existing_member.phone = clean_phone
    )
  ) then
    result.code := 'duplicate';
    return result;
  end if;

  if exists (
    select 1
    from public.member_submissions as existing_submission
    where existing_submission.organization_id = resolved_organization_id
      and existing_submission.status = 'pending'
      and lower(existing_submission.first_name) = lower(clean_first)
      and lower(existing_submission.last_name) = lower(clean_last)
      and existing_submission.birth_month = clean_month
      and existing_submission.birth_day = clean_day
  )
  or exists (
    select 1
    from public.members as existing_member
    where existing_member.organization_id = resolved_organization_id
      and existing_member.is_active = true
      and existing_member.first_name is not null
      and existing_member.last_name is not null
      and lower(existing_member.first_name) = lower(clean_first)
      and lower(existing_member.last_name) = lower(clean_last)
      and existing_member.birth_month = clean_month
      and existing_member.birth_day = clean_day
  ) then
    result.code := 'duplicate';
    return result;
  end if;

  derived_display_name := clean_first || ' ' || clean_last;

  begin
    insert into public.member_submissions (
      organization_id,
      registration_link_id,
      status,
      first_name,
      last_name,
      display_name,
      birth_month,
      birth_day,
      birth_year,
      email,
      phone
    )
    values (
      resolved_organization_id,
      link_id,
      'pending',
      clean_first,
      clean_last,
      derived_display_name,
      clean_month,
      clean_day,
      clean_year,
      clean_email,
      clean_phone
    )
    returning id into result.submission_id;
  exception
    when check_violation or not_null_violation then
      result.code := 'invalid_input';
      return result;
  end;

  result.organization_id := resolved_organization_id;
  result.success := true;
  result.code := 'submitted';
  return result;
exception
  when others then
    raise exception 'unable to submit registration'
      using errcode = 'P0001';
end;
$$;

create or replace function public.registration_photo_insert_allowed(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  path_organization_id uuid;
  path_submission_id uuid;
begin
  if object_name is null
    or position('..' in object_name) > 0
    or position(chr(92) in object_name) > 0
    or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/registrations/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  then
    return false;
  end if;

  path_organization_id := public.try_cast_uuid(split_part(object_name, '/', 1));
  path_submission_id := public.try_cast_uuid(
    replace(split_part(object_name, '/', 3), '.webp', '')
  );

  if path_organization_id is null or path_submission_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.member_submissions as submission
    where submission.id = path_submission_id
      and submission.organization_id = path_organization_id
      and submission.status = 'pending'
      and submission.photo_path is null
      and submission.created_at >= now() - interval '2 hours'
  );
end;
$$;

create or replace function public.attach_registration_photo(
  target_submission_id uuid,
  object_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
begin
  if target_submission_id is null or object_path is null then
    return false;
  end if;

  if target_submission_id is distinct from public.try_cast_uuid(
    replace(split_part(object_path, '/', 3), '.webp', '')
  ) then
    return false;
  end if;

  if not public.registration_photo_insert_allowed(object_path) then
    return false;
  end if;

  if not exists (
    select 1
    from storage.objects as stored_object
    where stored_object.bucket_id = 'member-photos'
      and stored_object.name = object_path
  ) then
    return false;
  end if;

  update public.member_submissions as submission
  set photo_path = object_path
  where submission.id = target_submission_id
    and submission.status = 'pending'
    and submission.photo_path is null
    and submission.created_at >= now() - interval '2 hours';

  return found;
end;
$$;

create or replace function public.registration_photo_delete_allowed(object_name text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  path_organization_id uuid;
begin
  if object_name is null
    or auth.uid() is null
    or position('..' in object_name) > 0
    or position(chr(92) in object_name) > 0
    or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/registrations/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  then
    return false;
  end if;

  path_organization_id := public.try_cast_uuid(split_part(object_name, '/', 1));

  if path_organization_id is null then
    return false;
  end if;

  return public.has_organization_role(
    path_organization_id,
    array['owner', 'admin']::text[]
  );
end;
$$;

revoke all on function public.registration_photo_insert_allowed(text) from public, anon, authenticated, service_role;
grant execute on function public.registration_photo_insert_allowed(text) to anon, authenticated;

revoke all on function public.attach_registration_photo(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.attach_registration_photo(uuid, text) to anon, authenticated;

revoke all on function public.registration_photo_delete_allowed(text) from public, anon, authenticated, service_role;
grant execute on function public.registration_photo_delete_allowed(text) to authenticated;

create policy member_photos_insert_registration
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'member-photos'
  and public.registration_photo_insert_allowed(name)
);

create policy member_photos_delete_registration_owner_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-photos'
  and public.registration_photo_delete_allowed(name)
);
