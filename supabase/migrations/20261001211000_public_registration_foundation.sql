-- Public birthday registration.
-- One registration link per organization. Pending people live in
-- member_submissions until an owner or admin approves them into public.members.
-- Anonymous visitors have no table privileges. They call fixed functions only.
-- This migration does not change public.members or Storage.

-- ---------------------------------------------------------------------------
-- token generator
-- ---------------------------------------------------------------------------

-- 32 bytes from pgcrypto, which is installed in the extensions schema.
-- Unpadded base64url is 43 characters and matches registration_links_token_check.
-- random(), timestamps, organization ids, and slugs are not used.
-- Clients cannot execute this. ensure_registration_link() calls it as owner.

create or replace function public.registration_link_token()
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  generated text;
begin
  generated := rtrim(
    translate(
      encode(extensions.gen_random_bytes(32), 'base64'),
      '+/',
      '-_'
    ),
    '='
  );

  if generated !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'registration token generator failed'
      using errcode = 'P0001';
  end if;

  return generated;
end;
$$;

comment on function public.registration_link_token() is
  'URL-safe token from 32 cryptographically random bytes. Not granted to client roles.';

-- ---------------------------------------------------------------------------
-- registration_links
-- ---------------------------------------------------------------------------

create table public.registration_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  token text not null,
  is_enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registration_links_organization_id_key unique (organization_id),
  constraint registration_links_token_key unique (token),
  -- 43 unpadded base64url characters. Trimmed. Not a slug and not a uuid.
  constraint registration_links_token_check check (
    char_length(token) = 43
    and token = btrim(token)
    and token ~ '^[A-Za-z0-9_-]{43}$'
  )
);

comment on table public.registration_links is
  'One public registration link per organization. The token is the public locator.';

comment on column public.registration_links.token is
  'Unguessable URL token. Replacing this value is how a later change rotates the link.';

comment on column public.registration_links.is_enabled is
  'False hides the organization name and rejects new submissions. The row stays so the token can be replaced later.';

comment on column public.registration_links.created_by is
  'Historical author. Nullable. ON DELETE SET NULL. Not used for authorization.';

-- Unique organization_id is the "one link" lookup. Unique token is the public lookup.
-- No second index is added.

create trigger registration_links_set_updated_at
before update on public.registration_links
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- member_submissions
-- ---------------------------------------------------------------------------

create table public.member_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  registration_link_id uuid not null references public.registration_links (id) on delete cascade,
  status text not null default 'pending',
  first_name text not null,
  last_name text not null,
  display_name text not null,
  birth_month smallint not null,
  birth_day smallint not null,
  birth_year integer,
  email text,
  phone text,
  member_id uuid references public.members (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_submissions_status_check check (
    status in ('pending', 'approved', 'rejected')
  ),
  constraint member_submissions_first_name_check check (
    char_length(first_name) between 1 and 100
    and first_name = btrim(first_name)
  ),
  constraint member_submissions_last_name_check check (
    char_length(last_name) between 1 and 100
    and last_name = btrim(last_name)
  ),
  constraint member_submissions_display_name_check check (
    char_length(display_name) between 1 and 200
    and display_name = btrim(display_name)
  ),
  constraint member_submissions_email_check check (
    email is null
    or (
      char_length(email) between 1 and 254
      and email = btrim(email)
    )
  ),
  constraint member_submissions_phone_check check (
    phone is null
    or (
      char_length(phone) between 1 and 50
      and phone = btrim(phone)
    )
  ),
  -- At least one contact. Empty strings fail the length checks above.
  constraint member_submissions_contact_check check (
    email is not null
    or phone is not null
  ),
  -- Same month/day rules as public.members. February 29 is allowed when the
  -- year is unknown. A known year is checked below.
  constraint member_submissions_birth_month_day_check check (
    birth_month between 1 and 12
    and birth_day >= 1
    and (
      (birth_month in (1, 3, 5, 7, 8, 10, 12) and birth_day <= 31)
      or (birth_month in (4, 6, 9, 11) and birth_day <= 30)
      or (birth_month = 2 and birth_day <= 29)
    )
  ),
  -- Same year rules as public.members. This expression never constructs a date.
  constraint member_submissions_birth_year_check check (
    birth_year is null
    or (
      birth_year between 1900 and extract(year from current_date)::integer
      and (
        not (birth_month = 2 and birth_day = 29)
        or (birth_year % 4 = 0 and birth_year % 100 <> 0)
        or (birth_year % 400 = 0)
      )
    )
  ),
  -- pending: untouched.
  -- rejected: reviewed, and no member row.
  -- approved: reviewed. member_id may be null because member_id is
  -- ON DELETE SET NULL. A later member delete must not fail this check.
  -- The review function sets member_id when it approves. This check does not
  -- require it to stay non-null.
  constraint member_submissions_review_state_check check (
    (
      status = 'pending'
      and member_id is null
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      status = 'rejected'
      and member_id is null
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      status = 'approved'
      and reviewed_by is not null
      and reviewed_at is not null
    )
  )
);

comment on table public.member_submissions is
  'Pending public registrations. Not birthday-directory members until approved.';

comment on column public.member_submissions.display_name is
  'Derived by submit_member_registration as first name, a space, and last name.';

comment on column public.member_submissions.member_id is
  'Set when approved. ON DELETE SET NULL so removing a member keeps the historical submission.';

comment on column public.member_submissions.reviewed_by is
  'Owner or admin who approved or rejected. Nullable only while pending. Not used as a login.';

create index member_submissions_organization_id_status_created_at_idx
  on public.member_submissions (organization_id, status, created_at);

-- Duplicate lookups. Not unique: rejected rows and inactive members may repeat
-- a person, and this MVP does not close the simultaneous-insert race.
create index member_submissions_organization_id_lower_email_idx
  on public.member_submissions (organization_id, lower(email))
  where email is not null;

create index member_submissions_organization_id_phone_idx
  on public.member_submissions (organization_id, phone)
  where phone is not null;

create index member_submissions_organization_id_pending_name_birthday_idx
  on public.member_submissions (
    organization_id,
    lower(first_name),
    lower(last_name),
    birth_month,
    birth_day
  )
  where status = 'pending';

create trigger member_submissions_set_updated_at
before update on public.member_submissions
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.registration_links enable row level security;
alter table public.member_submissions enable row level security;

-- Plain members fail this role check. Anon has no policy, so anon sees nothing.
create policy registration_links_select_owner_admin
on public.registration_links
for select
to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
);

create policy member_submissions_select_owner_admin
on public.member_submissions
for select
to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
);

-- No INSERT, UPDATE, or DELETE policies.
-- Link creation, submission, and review go through the functions below.
-- Token replacement and disable stay possible for a later owner-level function
-- because the columns exist. They are not client updates.

-- ---------------------------------------------------------------------------
-- function results
-- ---------------------------------------------------------------------------

create type public.member_registration_submit_result as (
  success boolean,
  code text
);

create type public.registration_link_state as (
  token text,
  is_enabled boolean
);

create type public.member_submission_review_result as (
  success boolean,
  code text,
  member_id uuid
);

comment on type public.member_registration_submit_result is
  'submit_member_registration result. code is submitted, invalid_link, invalid_input, duplicate, or rate_limited.';

comment on type public.registration_link_state is
  'ensure_registration_link result. token and is_enabled only.';

comment on type public.member_submission_review_result is
  'review_member_submission result. member_id is set only when code is approved.';

-- ---------------------------------------------------------------------------
-- get_public_registration
-- ---------------------------------------------------------------------------

-- Unknown and disabled tokens both return null. No ids, slug, or token echo.
create or replace function public.get_public_registration(registration_token text)
returns text
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  clean_token text;
  organization_name text;
begin
  if registration_token is null or char_length(registration_token) > 43 then
    return null;
  end if;

  clean_token := btrim(registration_token);

  if clean_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;

  select organization.name
  into organization_name
  from public.registration_links as link
  join public.organizations as organization
    on organization.id = link.organization_id
  where link.token = clean_token
    and link.is_enabled = true;

  if not found then
    return null;
  end if;

  return organization_name;
exception
  when others then
    return null;
end;
$$;

comment on function public.get_public_registration(text) is
  'Returns the organization name for an enabled registration token. Unknown and disabled tokens return null. Does not return ids or the slug.';

-- ---------------------------------------------------------------------------
-- submit_member_registration
-- ---------------------------------------------------------------------------

-- Codes, mapped by the application and not returned as sentences:
--   submitted      one pending row was inserted
--   invalid_link   unknown or disabled token, same result for both
--   invalid_input  names, birthday, or contact failed validation
--   duplicate      email, phone, or name plus birthday matched
--   rate_limited   this organization already stored 30 submissions in the last hour
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
  -- A composite starts null. Assign the whole row before any field write.
  result := row(false, 'invalid_input')::public.member_registration_submit_result;

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

  -- Local names avoid a plpgsql ambiguity with member_submissions columns.
  clean_month := birth_month;
  clean_day := birth_day;

  -- Field errors return before the token lookup so a bad form does not
  -- confirm that a token is real.
  if registration_token is null or char_length(registration_token) > 43 then
    result.code := 'invalid_link';
    return result;
  end if;

  clean_token := btrim(registration_token);

  if clean_token !~ '^[A-Za-z0-9_-]{43}$' then
    result.code := 'invalid_link';
    return result;
  end if;

  -- Lock the enabled link so the hourly count and insert cannot race past 30.
  -- A disabled or unknown token matches nothing and returns invalid_link.
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

  -- Email and phone also match approved submissions, so a later deactivated
  -- member still blocks that contact. Name plus birthday does not match
  -- approved submissions: the active member row covers a current person, and
  -- an inactive member must not block a new submission.
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
    );
  exception
    when check_violation or not_null_violation then
      result.code := 'invalid_input';
      return result;
  end;

  result.success := true;
  result.code := 'submitted';
  return result;
exception
  when others then
    raise exception 'unable to submit registration'
      using errcode = 'P0001';
end;
$$;

comment on function public.submit_member_registration(text, text, text, integer, integer, integer, text, text) is
  'Inserts one pending submission for an enabled token. Organization, status, and display name are set inside the function. Does not write public.members.';

-- ---------------------------------------------------------------------------
-- ensure_registration_link
-- ---------------------------------------------------------------------------

-- First membership by created_at, then id. Same order as the application.
-- No organization id argument. Plain members raise 42501 and receive no token.
create or replace function public.ensure_registration_link()
returns public.registration_link_state
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  resolved_organization_id uuid;
  membership_role text;
  attempt integer;
  created_state public.registration_link_state;
begin
  created_state := row(null, null)::public.registration_link_state;

  if current_user_id is null then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select membership.organization_id, membership.role
  into resolved_organization_id, membership_role
  from public.organization_members as membership
  where membership.user_id = current_user_id
  order by membership.created_at asc, membership.id asc
  limit 1;

  if resolved_organization_id is null
    or (
      membership_role is distinct from 'owner'
      and membership_role is distinct from 'admin'
    )
  then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select link.token, link.is_enabled
  into created_state.token, created_state.is_enabled
  from public.registration_links as link
  where link.organization_id = resolved_organization_id;

  if found then
    return created_state;
  end if;

  for attempt in 1..3 loop
    begin
      insert into public.registration_links (
        organization_id,
        token,
        is_enabled,
        created_by
      )
      values (
        resolved_organization_id,
        public.registration_link_token(),
        true,
        current_user_id
      )
      on conflict (organization_id) do nothing
      returning token, is_enabled
      into created_state.token, created_state.is_enabled;

      if created_state.token is not null then
        return created_state;
      end if;

      select link.token, link.is_enabled
      into created_state.token, created_state.is_enabled
      from public.registration_links as link
      where link.organization_id = resolved_organization_id;

      if found then
        return created_state;
      end if;
    exception
      when unique_violation then
        -- Token collision retries. An organization conflict is handled by
        -- ON CONFLICT, but a loser that still raises reads the winning row.
        select link.token, link.is_enabled
        into created_state.token, created_state.is_enabled
        from public.registration_links as link
        where link.organization_id = resolved_organization_id;

        if found then
          return created_state;
        end if;
    end;
  end loop;

  raise exception 'unable to create registration link'
    using errcode = 'P0001';
exception
  when insufficient_privilege then
    raise;
  when others then
    raise exception 'unable to create registration link'
      using errcode = 'P0001';
end;
$$;

comment on function public.ensure_registration_link() is
  'Returns the caller organization registration link, creating it once for an owner or admin. Does not take an organization id.';

-- ---------------------------------------------------------------------------
-- review_member_submission
-- ---------------------------------------------------------------------------

-- Codes:
--   approved, rejected     success true; member_id is set only for approved
--   already_reviewed       status was not pending; no second member is created
--   not_authorized         no user, or not owner/admin of the submission organization
--   not_found              no submission row
--   invalid_decision       decision is not approve or reject
create or replace function public.review_member_submission(
  submission_id uuid,
  decision text
)
returns public.member_submission_review_result
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  clean_decision text;
  result public.member_submission_review_result;
  submission public.member_submissions;
  new_member_id uuid;
begin
  result := row(false, 'not_authorized', null)::public.member_submission_review_result;

  if current_user_id is null then
    return result;
  end if;

  clean_decision := lower(btrim(coalesce(decision, '')));

  if clean_decision not in ('approve', 'reject') then
    result.code := 'invalid_decision';
    return result;
  end if;

  if submission_id is null then
    result.code := 'not_found';
    return result;
  end if;

  -- Lock the row so two approvals cannot both see pending.
  select submission_row.*
  into submission
  from public.member_submissions as submission_row
  where submission_row.id = submission_id
  for update;

  if not found then
    result.code := 'not_found';
    return result;
  end if;

  if not public.has_organization_role(
    submission.organization_id,
    array['owner', 'admin']::text[]
  ) then
    result.code := 'not_authorized';
    return result;
  end if;

  if submission.status <> 'pending' then
    result.code := 'already_reviewed';
    result.member_id := null;
    return result;
  end if;

  if clean_decision = 'approve' then
    insert into public.members (
      organization_id,
      display_name,
      first_name,
      last_name,
      birth_month,
      birth_day,
      birth_year,
      email,
      phone,
      photo_url,
      notes,
      is_active,
      created_by,
      department_id,
      group_id
    )
    values (
      submission.organization_id,
      submission.display_name,
      submission.first_name,
      submission.last_name,
      submission.birth_month,
      submission.birth_day,
      submission.birth_year,
      submission.email,
      submission.phone,
      null,
      null,
      true,
      current_user_id,
      null,
      null
    )
    returning id into new_member_id;

    update public.member_submissions as submission_row
    set
      status = 'approved',
      member_id = new_member_id,
      reviewed_by = current_user_id,
      reviewed_at = now()
    where submission_row.id = submission.id;

    result.success := true;
    result.code := 'approved';
    result.member_id := new_member_id;
    return result;
  end if;

  update public.member_submissions as submission_row
  set
    status = 'rejected',
    member_id = null,
    reviewed_by = current_user_id,
    reviewed_at = now()
  where submission_row.id = submission.id;

  result.success := true;
  result.code := 'rejected';
  result.member_id := null;
  return result;
exception
  when others then
    raise exception 'unable to review registration'
      using errcode = 'P0001';
end;
$$;

comment on function public.review_member_submission(uuid, text) is
  'Approves or rejects one pending submission. Organization and member fields come from the locked row. Approve inserts one active member and updates the submission in this same call.';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.registration_links from anon, authenticated, service_role;
revoke all on table public.member_submissions from anon, authenticated, service_role;

grant select on table public.registration_links to authenticated;
grant select on table public.member_submissions to authenticated;

-- No INSERT, UPDATE, or DELETE grants. Anon has no table privileges.

revoke usage on type public.member_registration_submit_result from public, anon, authenticated, service_role;
grant usage on type public.member_registration_submit_result to anon, authenticated;

revoke usage on type public.registration_link_state from public, anon, authenticated, service_role;
grant usage on type public.registration_link_state to authenticated;

revoke usage on type public.member_submission_review_result from public, anon, authenticated, service_role;
grant usage on type public.member_submission_review_result to authenticated;

revoke all on function public.registration_link_token() from public, anon, authenticated, service_role;

revoke all on function public.get_public_registration(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_registration(text) to anon, authenticated;

revoke all on function public.submit_member_registration(text, text, text, integer, integer, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_member_registration(text, text, text, integer, integer, integer, text, text) to anon, authenticated;

revoke all on function public.ensure_registration_link() from public, anon, authenticated, service_role;
grant execute on function public.ensure_registration_link() to authenticated;

revoke all on function public.review_member_submission(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.review_member_submission(uuid, text) to authenticated;
