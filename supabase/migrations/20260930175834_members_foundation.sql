-- Birthday directory foundation.
-- Draft for review. Do not treat this file as applied.
--
-- public.members is not organization_members and not an Auth user.
-- Authorization uses the existing organization membership helpers.
-- created_by is audit metadata only.

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------

create table public.members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  display_name text not null,
  first_name text,
  last_name text,
  birth_month smallint not null,
  birth_day smallint not null,
  birth_year integer,
  email text,
  phone text,
  photo_url text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_display_name_check check (
    char_length(display_name) between 1 and 200
    and display_name = btrim(display_name)
  ),
  constraint members_first_name_check check (
    first_name is null
    or (
      char_length(first_name) between 1 and 100
      and first_name = btrim(first_name)
    )
  ),
  constraint members_last_name_check check (
    last_name is null
    or (
      char_length(last_name) between 1 and 100
      and last_name = btrim(last_name)
    )
  ),
  constraint members_email_check check (
    email is null
    or (
      char_length(email) between 1 and 254
      and email = btrim(email)
    )
  ),
  constraint members_phone_check check (
    phone is null
    or (
      char_length(phone) between 1 and 50
      and phone = btrim(phone)
    )
  ),
  constraint members_photo_url_check check (
    photo_url is null
    or (
      char_length(photo_url) between 1 and 2048
      and photo_url = btrim(photo_url)
    )
  ),
  constraint members_notes_check check (
    notes is null
    or char_length(notes) <= 2000
  ),
  -- Month and day are required. February 29 is allowed here so an unknown
  -- year can still record that birthday. A known year is checked below.
  constraint members_birth_month_day_check check (
    birth_month between 1 and 12
    and birth_day >= 1
    and (
      (birth_month in (1, 3, 5, 7, 8, 10, 12) and birth_day <= 31)
      or (birth_month in (4, 6, 9, 11) and birth_day <= 30)
      or (birth_month = 2 and birth_day <= 29)
    )
  ),
  -- NULL birth_year means the year is unknown. 1900 is a real minimum year,
  -- not a sentinel. The upper bound is the calendar year at insert or update.
  -- February 29 is valid when the year is null, or when that year is a leap year.
  -- This expression never constructs a date, so an invalid combination is false
  -- instead of raising a datetime error inside the check.
  constraint members_birth_year_check check (
    birth_year is null
    or (
      birth_year between 1900 and extract(year from current_date)::integer
      and (
        not (birth_month = 2 and birth_day = 29)
        or (birth_year % 4 = 0 and birth_year % 100 <> 0)
        or (birth_year % 400 = 0)
      )
    )
  )
);

comment on table public.members is
  'Birthday directory for one organization. Not an application login and not organization_members.';

comment on column public.members.birth_year is
  'Known birth year. NULL means unknown. Never store a fake year.';

comment on column public.members.created_by is
  'Historical author. Nullable. ON DELETE SET NULL. Not used for authorization.';

comment on column public.members.photo_url is
  'Optional storage path or reference. Not validated as a public URL.';

create index members_organization_id_is_active_display_name_idx
  on public.members (organization_id, is_active, display_name);

create index members_organization_id_birth_month_birth_day_idx
  on public.members (organization_id, birth_month, birth_day);

create trigger members_set_updated_at
before update on public.members
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.members enable row level security;

create policy members_select_organization_member
on public.members
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy members_insert_owner_admin
on public.members
for insert
to authenticated
with check (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
  and created_by = auth.uid()
);

-- Updates do not require created_by = auth.uid(). Another admin may edit the
-- row, and created_by may later be null after the author is deleted.
create policy members_update_owner_admin
on public.members
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

revoke all on table public.members from anon, authenticated, service_role;

grant select on table public.members to authenticated;

grant insert (
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
  created_by
) on table public.members to authenticated;

grant update (
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
  is_active
) on table public.members to authenticated;
