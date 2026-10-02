import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { setGroupActiveState } from "@/app/groups/actions";
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

function GroupStatus({ isActive }: { isActive: boolean }) {
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

function GroupActions({
  groupId,
  isActive,
}: {
  groupId: string;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/groups/${groupId}/edit`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Edit
      </Link>
      {isActive ? (
        <Link
          href={`/groups/${groupId}/deactivate`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Deactivate
        </Link>
      ) : (
        <form action={setGroupActiveState.bind(null, groupId, true)}>
          <Button type="submit" variant="outline" size="sm">
            Reactivate
          </Button>
        </form>
      )}
    </div>
  );
}

type GroupsPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    page?: string | string[];
  }>;
};

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
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
          <h1 className="text-2xl font-semibold">Groups</h1>
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

  function groupQuery(head = false) {
    return supabase
      .from("groups")
      .select("id, name, is_active", { count: "exact", head })
      .eq("organization_id", organizationId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true })
      .order("id", { ascending: true });
  }

  const groupCountResult = await groupQuery(true);
  const groupTotal = groupCountResult.count;
  const groupPageCount = groupTotal == null ? requestedPage : listPageCount(groupTotal);

  if (!groupCountResult.error && groupTotal != null && requestedPage > groupPageCount) {
    redirect(listPagePath("/groups", groupPageCount));
  }

  const requestedRange = listRange(requestedPage);
  const groupsResult =
    groupCountResult.error || groupTotal === 0
      ? { data: [], error: groupCountResult.error }
      : await groupQuery().range(requestedRange.from, requestedRange.to);
  const groups = groupsResult.data;
  const groupsError = groupsResult.error;

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Groups</h1>
          <p className="mt-2 font-medium">{organization.name}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {canManage ? (
            <Link href="/groups/new" className={cn(buttonVariants())}>
              Add group
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

      {groupsError || !groups ? (
        <p className="mt-6 text-sm text-destructive">
          Unable to load groups. Please try again.
        </p>
      ) : groups.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>No groups yet.</CardTitle>
          </CardHeader>
          {canManage ? (
            <CardContent>
              <Link href="/groups/new" className={cn(buttonVariants())}>
                Add group
              </Link>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{group.name}</p>
                    <GroupStatus isActive={group.is_active} />
                  </div>
                  {canManage ? (
                    <GroupActions groupId={group.id} isActive={group.is_active} />
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {groupsError || !groups ? null : (
        <ListPagination
          page={requestedPage}
          pageCount={groupPageCount}
          hrefForPage={(page) => listPagePath("/groups", page)}
        />
      )}
    </main>
  );
}
