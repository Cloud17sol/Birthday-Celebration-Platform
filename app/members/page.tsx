import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Pencil, UserMinus, UserPlus } from "lucide-react";
import { cn } from "cn";
import { ListPagination } from "@/components/list-pagination";
import { MemberAvatar } from "@/components/member-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setMemberActiveState } from "@/app/members/actions";
import {
  birthMonthForFilter,
  memberDeactivatePath,
  memberDirectoryEmptyMessage,
  memberDirectoryPath,
  memberDirectorySearchFilter,
  parseMemberDirectoryQuery,
  type ParsedMemberDirectoryQuery,
} from "@/lib/member-directory-query";
import { memberInitials } from "@/lib/member-photo";
import { signMemberPhotoUrls } from "@/lib/member-photo-urls";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { birthdayCardColors } from "@/lib/birthday-card-colors";
import { utcReferenceCivilDate } from "@/lib/dashboard-birthday";
import { listPageCount, listRange } from "@/lib/list-page";
import { createClient } from "@/lib/supabase/server";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function memberCardColor(birthMonth: number, birthDay: number, year: number) {
  return birthdayCardColors([`${year}-${birthMonth}-${birthDay}`])[0];
}

function formatBirthday(
  birthMonth: number,
  birthDay: number,
  birthYear: number | null
) {
  const monthName = monthNames[birthMonth - 1];

  if (!monthName) {
    return "—";
  }

  if (birthYear == null) {
    return `${birthDay} ${monthName}`;
  }

  return `${birthDay} ${monthName} ${birthYear}`;
}

function ContactDetails({
  email,
  phone,
}: {
  email: string | null;
  phone: string | null;
}) {
  if (!email && !phone) {
    return <span className="text-muted-foreground">No contact details</span>;
  }

  return (
    <div className="space-y-1">
      {email ? <p className="break-all">{email}</p> : null}
      {phone ? <p>{phone}</p> : null}
    </div>
  );
}

function MemberStatus({ isActive }: { isActive: boolean }) {
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

function MemberActions({
  memberId,
  isActive,
  directory,
}: {
  memberId: string;
  isActive: boolean;
  directory: ParsedMemberDirectoryQuery;
}) {
  const directoryState = {
    q: directory.searchTerm ?? "",
    status: directory.status,
    month: directory.month,
    page: String(directory.page),
  };

  const actionClass = cn(
    buttonVariants({ variant: "outline", size: "icon" }),
    "size-11"
  );

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link
        href={`/members/${memberId}/edit`}
        aria-label="Edit member"
        title="Edit"
        className={actionClass}
      >
        <Pencil />
      </Link>
      {isActive ? (
        <Link
          href={memberDeactivatePath(memberId, {
            q: directory.searchTerm,
            status: directory.status,
            month: directory.month,
            page: directory.page,
          })}
          aria-label="Deactivate member"
          title="Deactivate"
          className={actionClass}
        >
          <UserMinus />
        </Link>
      ) : (
        <form
          action={setMemberActiveState.bind(null, memberId, true, directoryState)}
        >
          <Button
            type="submit"
            variant="outline"
            size="icon"
            aria-label="Reactivate member"
            title="Reactivate"
            className="size-11"
          >
            <UserPlus />
          </Button>
        </form>
      )}
    </div>
  );
}

function DirectoryFilterLink({
  href,
  selected,
  children,
  label,
}: {
  href: string;
  selected: boolean;
  children: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={selected ? "page" : undefined}
      className={
        selected
          ? "flex h-9 items-center justify-center rounded-lg bg-[#315efb] px-1 text-center text-xs font-semibold whitespace-nowrap text-white"
          : "flex h-9 items-center justify-center rounded-lg px-1 text-center text-xs font-medium whitespace-nowrap text-[#52657a]"
      }
    >
      {children}
    </Link>
  );
}

type MembersPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    q?: string | string[];
    status?: string | string[];
    month?: string | string[];
    page?: string | string[];
  }>;
};

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const directory = parseMemberDirectoryQuery(params);
  const clearSearchPath = memberDirectoryPath({
    status: directory.status,
    month: directory.month,
  });
  const serverMonth = new Date().getMonth() + 1;
  const birthMonth = birthMonthForFilter(directory.month, serverMonth);
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
        <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
          <h1 className="text-2xl font-semibold">Members</h1>
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

  const canManageMembers =
    currentMembership.role === "owner" || currentMembership.role === "admin";

  const organizationId = currentMembership.organization_id;

  function filteredMembers(head = false) {
    let membersQuery = supabase
      .from("members")
      .select(
        "id, display_name, first_name, last_name, birth_month, birth_day, birth_year, email, phone, is_active, photo_url",
        { count: "exact", head }
      )
      .eq("organization_id", organizationId);

    if (directory.status === "active") {
      membersQuery = membersQuery.eq("is_active", true);
    } else if (directory.status === "inactive") {
      membersQuery = membersQuery.eq("is_active", false);
    }

    if (birthMonth !== null) {
      membersQuery = membersQuery.eq("birth_month", birthMonth);
    }

    const searchFilter = directory.searchTerm
      ? memberDirectorySearchFilter(directory.searchTerm)
      : null;

    if (searchFilter) {
      membersQuery = membersQuery.or(searchFilter);
    }

    return membersQuery
      .order("is_active", { ascending: false })
      .order("display_name", { ascending: true })
      .order("id", { ascending: true });
  }

  const memberCountResult = await filteredMembers(true);
  const memberTotal = memberCountResult.count;
  const memberPageCount =
    memberTotal == null ? directory.page : listPageCount(memberTotal);

  if (
    !memberCountResult.error &&
    memberTotal != null &&
    directory.page > memberPageCount
  ) {
    redirect(
      memberDirectoryPath({
        q: directory.searchTerm,
        status: directory.status,
        month: directory.month,
        page: memberPageCount,
      })
    );
  }

  const requestedRange = listRange(directory.page);
  const membersResult =
    memberCountResult.error || memberTotal === 0
      ? { data: [], error: memberCountResult.error }
      : await filteredMembers().range(requestedRange.from, requestedRange.to);
  const members = membersResult.data;
  const membersError = membersResult.error;
  const birthdayColorYear = utcReferenceCivilDate().year;

  const emptyMessage = memberDirectoryEmptyMessage(directory);

  const photoUrls =
    membersError || !members
      ? new Map<string, string>()
      : await signMemberPhotoUrls(
          supabase,
          currentMembership.organization_id,
          members
        );

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="mt-2 font-medium">{organization.name}</p>
          <p className="text-sm text-muted-foreground">Birthday directory</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canManageMembers ? (
            <Link
              href="/members/new"
              aria-label="Add member"
              title="Add member"
              className={cn(buttonVariants({ size: "icon" }), "size-11")}
            >
              <UserPlus />
            </Link>
          ) : null}
          <Link
            href="/dashboard"
            aria-label="Dashboard"
            title="Dashboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "size-11"
            )}
          >
            <LayoutDashboard />
          </Link>
        </div>
      </div>

      {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}

      <form action="/members" method="get" className="mt-6">
        <div className="space-y-1.5">
          <label htmlFor="member-search" className="text-sm font-medium">
            Search members
          </label>
          <div className="relative">
            <Input
              key={directory.rawQuery}
              id="member-search"
              name="q"
              defaultValue={directory.rawQuery}
              placeholder="Name, email or phone"
              className={directory.rawQuery ? "pr-36!" : "pr-24!"}
            />
            <div className="absolute inset-y-1 right-1 flex items-center gap-1">
              {directory.rawQuery ? (
                <Link
                  href={clearSearchPath}
                  className="flex h-9 items-center rounded-lg px-2 text-sm font-medium text-[#52657a]"
                >
                  Clear
                </Link>
              ) : null}
              <Button type="submit" className="h-9 rounded-lg px-3">
                Search
              </Button>
            </div>
          </div>
        </div>
        {directory.status !== "active" ? (
          <input type="hidden" name="status" value={directory.status} />
        ) : null}
        {directory.month !== "all" ? (
          <input type="hidden" name="month" value={directory.month} />
        ) : null}
      </form>

      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        <div
          className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-[#e2e8f0]"
          role="group"
          aria-label="Status"
        >
          <DirectoryFilterLink
            href={memberDirectoryPath({
              q: directory.searchTerm,
              status: "active",
              month: directory.month,
            })}
            selected={directory.status === "active"}
          >
            Active
          </DirectoryFilterLink>
          <DirectoryFilterLink
            href={memberDirectoryPath({
              q: directory.searchTerm,
              status: "inactive",
              month: directory.month,
            })}
            selected={directory.status === "inactive"}
          >
            Inactive
          </DirectoryFilterLink>
          <DirectoryFilterLink
            href={memberDirectoryPath({
              q: directory.searchTerm,
              status: "all",
              month: directory.month,
            })}
            selected={directory.status === "all"}
          >
            All
          </DirectoryFilterLink>
        </div>
        <div
          className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-[#e2e8f0]"
          role="group"
          aria-label="Birthday"
        >
          <DirectoryFilterLink
            href={memberDirectoryPath({
              q: directory.searchTerm,
              status: directory.status,
              month: "all",
            })}
            selected={directory.month === "all"}
            label="All birthdays"
          >
            All
          </DirectoryFilterLink>
          <DirectoryFilterLink
            href={memberDirectoryPath({
              q: directory.searchTerm,
              status: directory.status,
              month: "this",
            })}
            selected={directory.month === "this"}
          >
            This month
          </DirectoryFilterLink>
          <DirectoryFilterLink
            href={memberDirectoryPath({
              q: directory.searchTerm,
              status: directory.status,
              month: "next",
            })}
            selected={directory.month === "next"}
          >
            Next month
          </DirectoryFilterLink>
        </div>
      </div>

      {directory.searchError ? (
        <p className="mt-3 text-sm text-destructive">{directory.searchError}</p>
      ) : null}

      {membersError || !members ? (
        <p className="mt-6 text-sm text-destructive">
          Unable to load members. Please try again.
        </p>
      ) : members.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{emptyMessage}</CardTitle>
            {emptyMessage === "No members yet" ? (
              <CardDescription>
                Members you add to {organization.name} will appear here.
              </CardDescription>
            ) : null}
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="mt-6 hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Birthday</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canManageMembers ? (
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b last:border-b-0"
                    style={{
                      backgroundColor: memberCardColor(
                        member.birth_month,
                        member.birth_day,
                        birthdayColorYear
                      ),
                    }}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          initials={memberInitials(
                            member.first_name,
                            member.last_name,
                            member.display_name
                          )}
                          imageUrl={photoUrls.get(member.id) ?? null}
                        />
                        <span>{member.display_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {formatBirthday(
                        member.birth_month,
                        member.birth_day,
                        member.birth_year
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ContactDetails
                        email={member.email}
                        phone={member.phone}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <MemberStatus isActive={member.is_active} />
                    </td>
                    {canManageMembers ? (
                      <td className="px-4 py-3">
                        <MemberActions
                          memberId={member.id}
                          isActive={member.is_active}
                          directory={directory}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-2 md:hidden">
            {members.map((member) => (
              <Card
                key={member.id}
                className="[--card-spacing:--spacing(3)]"
                style={{
                  backgroundColor: memberCardColor(
                    member.birth_month,
                    member.birth_day,
                    birthdayColorYear
                  ),
                }}
              >
                <div className="flex items-start gap-3 px-(--card-spacing)">
                  <MemberAvatar
                    initials={memberInitials(
                      member.first_name,
                      member.last_name,
                      member.display_name
                    )}
                    imageUrl={photoUrls.get(member.id) ?? null}
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="font-medium leading-tight">{member.display_name}</p>
                    <p className="text-muted-foreground">
                      {formatBirthday(
                        member.birth_month,
                        member.birth_day,
                        member.birth_year
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <ContactDetails
                        email={member.email}
                        phone={member.phone}
                      />
                      <span className="text-muted-foreground" aria-hidden="true">
                        ·
                      </span>
                      <MemberStatus isActive={member.is_active} />
                    </div>
                  </div>
                  {canManageMembers ? (
                    <MemberActions
                      memberId={member.id}
                      isActive={member.is_active}
                      directory={directory}
                    />
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
          <ListPagination
            page={directory.page}
            pageCount={memberPageCount}
            hrefForPage={(page) =>
              memberDirectoryPath({
                q: directory.searchTerm,
                status: directory.status,
                month: directory.month,
                page,
              })
            }
          />
        </>
      )}
    </main>
  );
}
