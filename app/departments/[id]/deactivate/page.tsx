import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { setDepartmentActiveState } from "@/app/departments/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { isOrganizationCatalogId } from "@/lib/organization-catalog";
import { createClient } from "@/lib/supabase/server";

type DeactivateDepartmentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DeactivateDepartmentPage({
  params,
}: DeactivateDepartmentPageProps) {
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
          <h1 className="text-2xl font-semibold">Deactivate department</h1>
          <p className="mt-6 text-sm text-destructive">
            Unable to load your organization. Please try again.
          </p>
          <Link
            href="/departments"
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
    redirect("/departments");
  }

  const { data: department, error: departmentError } = await supabase
    .from("departments")
    .select("id, name, is_active")
    .eq("id", id)
    .eq("organization_id", currentMembership.organization_id)
    .maybeSingle();

  if (departmentError) {
    return (
      <main className="mx-auto w-full max-w-md p-4 sm:p-8">
        <h1 className="text-2xl font-semibold">Deactivate department</h1>
        <p className="mt-6 text-sm text-destructive">
          Unable to update department. Please try again.
        </p>
        <Link
          href="/departments"
          className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
        >
          Cancel
        </Link>
      </main>
    );
  }

  if (!department) {
    notFound();
  }

  if (!department.is_active) {
    redirect("/departments");
  }

  return (
    <main className="mx-auto w-full max-w-md p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">
        Deactivate {department.name}?
      </h1>
      <p className="mt-2 font-medium">{organization.name}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        This department will be marked inactive. Existing member associations
        are not removed.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <form action={setDepartmentActiveState.bind(null, department.id, false)}>
          <Button type="submit">Deactivate</Button>
        </form>
        <Link
          href="/departments"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}
