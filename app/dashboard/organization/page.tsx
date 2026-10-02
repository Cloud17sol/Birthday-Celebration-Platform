import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { updateOrganization } from "@/app/dashboard/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

type EditOrganizationPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EditOrganizationPage({
  searchParams,
}: EditOrganizationPageProps) {
  const error = firstParam((await searchParams).error);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, created_at, organizations(name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);

  const currentMembership = memberships?.[0];
  const organization = currentMembership?.organizations;

  if (membershipError || !currentMembership || !organization) {
    if (membershipError) {
      return (
        <main className="mx-auto w-full max-w-md p-4 sm:p-6">
          <h1 className="text-2xl font-semibold">Edit organization</h1>
          <p className="mt-6 text-sm text-destructive">
            Unable to load your organization. Please try again.
          </p>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11")}
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
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto w-full max-w-md p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Edit organization</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your role: {currentMembership.role === "admin" ? "Admin" : "Owner"}
      </p>

      <form action={updateOrganization} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="organization_name">Organization name</Label>
          <Input
            id="organization_name"
            name="organization_name"
            maxLength={80}
            required
            defaultValue={organization.name}
            autoComplete="organization"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="organization_slug">Organization slug</Label>
          <Input
            id="organization_slug"
            name="organization_slug"
            maxLength={63}
            required
            defaultValue={organization.slug}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">
            Lowercase letters, numbers, and single hyphens.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="h-11">
            Save organization
          </Button>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline" }), "h-11")}
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
