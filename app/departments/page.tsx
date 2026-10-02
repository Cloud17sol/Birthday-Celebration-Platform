import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { setDepartmentActiveState } from "@/app/departments/actions";
import { ListPagination } from "@/components/list-pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listPageCount, listPagePath, listRange, parseListPage } from "@/lib/list-page";
import { createClient } from "@/lib/supabase/server";

function DepartmentStatus({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "text-foreground"
          : "inline-flex rounded-md bg-muted px-2 py-0.5 text-muted-foreground"
      }
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function DepartmentActions({
  departmentId,
  isActive,
}: {
  departmentId: string;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/departments/${departmentId}/edit`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Edit
      </Link>
      {isActive ? (
        <Link
          href={`/departments/${departmentId}/deactivate`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Deactivate
        </Link>
      ) : (
        <form action={setDepartmentActiveState.bind(null, departmentId, true)}>
          <Button type="submit" variant="outline" size="sm">
            Reactivate
          </Button>
        </form>
      )}
    </div>
  );
}

type DepartmentsPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    page?: string | string[];
  }>;
};

export default async function DepartmentsPage({
  searchParams,
}: DepartmentsPageProps) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
        <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="mt-6 text-sm text-destructive">
            Unable to load your organization. Please try again.
          </p>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
          >
            Dashboard
          </Link>
        </main>
      );
    }

    redirect("/dashboard");
  }

  const canManage =
    currentMembership.role === "owner" || currentMembership.role === "admin";

  const requestedPage = parseListPage(params.page);
  const organizationId = currentMembership.organization_id;

  function departmentQuery(head = false) {
    return supabase
      .from("departments")
      .select("id, name, is_active", { count: "exact", head })
      .eq("organization_id", organizationId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true })
      .order("id", { ascending: true });
  }

  const departmentCountResult = await departmentQuery(true);
  const departmentTotal = departmentCountResult.count;
  const departmentPageCount =
    departmentTotal == null ? requestedPage : listPageCount(departmentTotal);

  if (
    !departmentCountResult.error &&
    departmentTotal != null &&
    requestedPage > departmentPageCount
  ) {
    redirect(listPagePath("/departments", departmentPageCount));
  }

  const requestedRange = listRange(requestedPage);
  const departmentsResult =
    departmentCountResult.error || departmentTotal === 0
      ? { data: [], error: departmentCountResult.error }
      : await departmentQuery().range(requestedRange.from, requestedRange.to);
  const departments = departmentsResult.data;
  const departmentsError = departmentsResult.error;

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="mt-2 font-medium">{organization.name}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {canManage ? (
            <Link href="/departments/new" className={cn(buttonVariants())}>
              Add department
            </Link>
          ) : null}
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Dashboard
          </Link>
        </div>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-destructive">{error}</p>
      ) : null}

      {departmentsError || !departments ? (
        <p className="mt-6 text-sm text-destructive">
          Unable to load departments. Please try again.
        </p>
      ) : departments.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>No departments yet.</CardTitle>
          </CardHeader>
          {canManage ? (
            <CardContent>
              <Link href="/departments/new" className={cn(buttonVariants())}>
                Add department
              </Link>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {departments.map((department) => (
            <li key={department.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{department.name}</p>
                    <DepartmentStatus isActive={department.is_active} />
                  </div>
                  {canManage ? (
                    <DepartmentActions
                      departmentId={department.id}
                      isActive={department.is_active}
                    />
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {departmentsError || !departments ? null : (
        <ListPagination
          page={requestedPage}
          pageCount={departmentPageCount}
          hrefForPage={(page) => listPagePath("/departments", page)}
        />
      )}
    </main>
  );
}
