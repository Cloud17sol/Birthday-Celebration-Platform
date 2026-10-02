import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { updateDepartment } from "@/app/departments/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isOrganizationCatalogId,
  organizationCatalogNameMaxLength,
} from "@/lib/organization-catalog";
import { createClient } from "@/lib/supabase/server";

type EditDepartmentPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

export default async function EditDepartmentPage({
  params,
  searchParams,
}: EditDepartmentPageProps) {
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
          <h1 className="text-2xl font-semibold">Edit department</h1>
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
    .select("id, name")
    .eq("id", id)
    .eq("organization_id", currentMembership.organization_id)
    .maybeSingle();

  if (departmentError) {
    return (
      <main className="mx-auto w-full max-w-md p-4 sm:p-8">
        <h1 className="text-2xl font-semibold">Edit department</h1>
        <p className="mt-6 text-sm text-destructive">
          Unable to save department. Please try again.
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

  return (
    <main className="mx-auto w-full max-w-md p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Edit department</h1>
      <p className="mt-2 font-medium">{organization.name}</p>

      <form
        action={updateDepartment.bind(null, department.id)}
        className="mt-6 space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            maxLength={organizationCatalogNameMaxLength}
            required
            defaultValue={department.name}
            autoComplete="off"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit">Save department</Button>
          <Link
            href="/departments"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
