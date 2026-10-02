import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { updateGroup } from "@/app/groups/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isOrganizationCatalogId,
  organizationCatalogNameMaxLength,
} from "@/lib/organization-catalog";
import { createClient } from "@/lib/supabase/server";

type EditGroupPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

export default async function EditGroupPage({
  params,
  searchParams,
}: EditGroupPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
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
          <h1 className="text-2xl font-semibold">Edit group</h1>
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
    .select("id, name")
    .eq("id", id)
    .eq("organization_id", currentMembership.organization_id)
    .maybeSingle();

  if (groupError) {
    return (
      <main className="mx-auto w-full max-w-md p-4 sm:p-8">
        <h1 className="text-2xl font-semibold">Edit group</h1>
        <p className="mt-6 text-sm text-destructive">
          Unable to save group. Please try again.
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

  return (
    <main className="mx-auto w-full max-w-md p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Edit group</h1>
      <p className="mt-2 font-medium">{organization.name}</p>

      <form action={updateGroup.bind(null, group.id)} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            maxLength={organizationCatalogNameMaxLength}
            required
            defaultValue={group.name}
            autoComplete="off"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit">Save group</Button>
          <Link
            href="/groups"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
