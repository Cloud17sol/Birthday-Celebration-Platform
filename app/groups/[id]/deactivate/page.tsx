import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { setGroupActiveState } from "@/app/groups/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { isOrganizationCatalogId } from "@/lib/organization-catalog";
import { createClient } from "@/lib/supabase/server";

type DeactivateGroupPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DeactivateGroupPage({
  params,
}: DeactivateGroupPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isOrganizationCatalogId(id)) {
    notFound();
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, created_at, organizations(name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];
  const organization = currentMembership?.organizations;

  if (membershipError || !currentMembership || !organization) {
    if (membershipError) {
      return (
        <main className="mx-auto w-full max-w-md p-4 sm:p-8">
          <h1 className="text-2xl font-semibold">Deactivate group</h1>
          <p className="mt-6 text-sm text-destructive">
            Unable to load your organization. Please try again.
          </p>
          <Link
            href="/groups"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
          >
            Cancel
          </Link>
        </main>
      );
    }

    redirect("/dashboard");
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirect("/groups");
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, is_active")
    .eq("id", id)
    .eq("organization_id", currentMembership.organization_id)
    .maybeSingle();

  if (groupError) {
    return (
      <main className="mx-auto w-full max-w-md p-4 sm:p-8">
        <h1 className="text-2xl font-semibold">Deactivate group</h1>
        <p className="mt-6 text-sm text-destructive">
          Unable to update group. Please try again.
        </p>
        <Link
          href="/groups"
          className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
        >
          Cancel
        </Link>
      </main>
    );
  }

  if (!group) {
    notFound();
  }

  if (!group.is_active) {
    redirect("/groups");
  }

  return (
    <main className="mx-auto w-full max-w-md p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Deactivate {group.name}?</h1>
      <p className="mt-2 font-medium">{organization.name}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        This group will be marked inactive. Existing member associations are
        not removed.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <form action={setGroupActiveState.bind(null, group.id, false)}>
          <Button type="submit">Deactivate</Button>
        </form>
        <Link
          href="/groups"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}
