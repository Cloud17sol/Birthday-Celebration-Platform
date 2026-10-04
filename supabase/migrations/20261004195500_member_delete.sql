-- Owner and admin may permanently delete a member in their organization.
-- member_submissions.member_id is set null by the existing foreign key.

create policy members_delete_owner_admin
on public.members
for delete
to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'admin']::text[])
);

grant delete on table public.members to authenticated;
