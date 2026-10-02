import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { BirthdayOverview, type BirthdayOverviewState } from "@/components/birthday-overview";
import { RegistrationLinkSection } from "@/components/registration-link-section";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUpcomingBirthdays } from "@/lib/birthday";
import {
  birthdaySummaryCounts,
  dashboardBirthdayWindowDays,
  presentUpcomingBirthday,
  toBirthdayPerson,
  utcReferenceCivilDate,
  visibleUpcomingBirthdays,
} from "@/lib/dashboard-birthday";
import { signMemberPhotoUrls } from "@/lib/member-photo-urls";
import {
  isRegistrationManager,
  parseRegistrationLinkState,
  registrationLinkView,
  requestOrigin,
  type RegistrationLinkView,
} from "@/lib/registration-link";
import {
  pendingRegistrationSummary,
  type PendingRegistrationSummary,
} from "@/lib/registration-review";
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "./actions";

type DashboardPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function formatRole(role: string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "member") return "Member";
  return role;
}

const emptyBirthdayCounts = {
  today: 0,
  withinSevenDays: 0,
  withinThirtyDays: 0,
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { error } = await searchParams;
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
  let birthdayState: BirthdayOverviewState = { status: "error" };

  if (!membershipError && currentMembership && organization) {
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select(
        "id, display_name, first_name, last_name, birth_month, birth_day, birth_year, photo_url"
      )
      .eq("organization_id", currentMembership.organization_id)
      .eq("is_active", true);

    if (membersError || !members) {
      birthdayState = { status: "error" };
    } else {
      const upcoming = getUpcomingBirthdays(
        members.map(toBirthdayPerson),
        utcReferenceCivilDate(),
        dashboardBirthdayWindowDays
      );

      if (!upcoming.ok) {
        birthdayState = { status: "error" };
      } else if (members.length === 0) {
        birthdayState = {
          status: "empty",
          message: "No active members yet.",
          counts: emptyBirthdayCounts,
        };
      } else if (upcoming.value.length === 0) {
        birthdayState = {
          status: "empty",
          message: "No birthdays in the next 30 days.",
          counts: emptyBirthdayCounts,
        };
      } else {
        const visible = visibleUpcomingBirthdays(upcoming.value);
        const membersById = new Map(members.map((member) => [member.id, member]));
        const visibleMembers = visible.flatMap((birthday) => {
          const member = membersById.get(birthday.id);

          if (!member) {
            return [];
          }

          return [
            {
              id: member.id,
              photo_url: member.photo_url,
            },
          ];
        });
        const signedPhotoUrls = await signMemberPhotoUrls(
          supabase,
          currentMembership.organization_id,
          visibleMembers
        );
        const imageUrls: Record<string, string> = {};

        for (const [memberId, imageUrl] of signedPhotoUrls) {
          imageUrls[memberId] = imageUrl;
        }

        birthdayState = {
          status: "ready",
          counts: birthdaySummaryCounts(upcoming.value),
          total: upcoming.value.length,
          imageUrls,
          rows: visible.flatMap((birthday) => {
            const member = membersById.get(birthday.id);

            if (!member) {
              return [];
            }

            return [
              presentUpcomingBirthday(birthday, {
                first_name: member.first_name,
                last_name: member.last_name,
              }),
            ];
          }),
        };
      }
    }
  }

  let registrationView: RegistrationLinkView = { status: "hidden" };

  if (
    !membershipError &&
    currentMembership &&
    organization &&
    isRegistrationManager(currentMembership.role)
  ) {
    try {
      const headerList = await headers();
      const origin = requestOrigin({
        host: headerList.get("host"),
        forwardedHost: headerList.get("x-forwarded-host"),
        forwardedProto: headerList.get("x-forwarded-proto"),
      });
      const { data, error: registrationError } = await supabase.rpc(
        "ensure_registration_link"
      );
      const link = registrationError ? null : parseRegistrationLinkState(data);

      registrationView = registrationLinkView({
        role: currentMembership.role,
        origin,
        link,
        failed: Boolean(registrationError) || link === null,
      });
    } catch {
      registrationView = { status: "error" };
    }
  }

  let pendingSummary: PendingRegistrationSummary = { status: "hidden" };

  if (
    !membershipError &&
    currentMembership &&
    organization &&
    isRegistrationManager(currentMembership.role)
  ) {
    const { count, error: pendingError } = await supabase
      .from("member_submissions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", currentMembership.organization_id)
      .eq("status", "pending");

    pendingSummary = pendingRegistrationSummary(
      currentMembership.role,
      count,
      Boolean(pendingError)
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <p className="mt-2 text-muted-foreground">
        Signed in as {user.email}
      </p>

      {membershipError || !organization ? (
        <Card className="mt-6 w-full">
          <CardHeader>
            <CardTitle>Create your organization</CardTitle>
            <CardDescription>
              Create your organization to start managing birthdays and
              celebrations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {membershipError ? (
              <p className="text-sm text-destructive">
                Unable to load your organization. Please try again.
              </p>
            ) : (
              <form action={createOrganization} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="organization_name">Organization name</Label>
                  <Input
                    id="organization_name"
                    name="organization_name"
                    maxLength={80}
                    required
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
                    spellCheck={false}
                    autoCapitalize="none"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit">Create organization</Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mt-4 w-full" size="sm">
            <CardContent>
              {memberships.length > 1 ? (
                <p className="mb-2 text-sm text-muted-foreground">
                  Organization switching will be implemented later.
                </p>
              ) : null}
              {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    {organization.name}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {formatRole(currentMembership.role)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {organization.slug}
                  </p>
                </div>
                {currentMembership.role === "owner" ||
                currentMembership.role === "admin" ? (
                  <Link
                    href="/dashboard/organization"
                    className={cn(buttonVariants(), "h-11 shrink-0")}
                  >
                    Edit organization
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <RegistrationLinkSection view={registrationView} />
          {pendingSummary.status === "hidden" ? null : (
            <Card className="mt-3" size="sm">
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">Pending registrations</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pendingSummary.status === "ready"
                        ? pendingSummary.label
                        : "Unable to load pending registrations right now."}
                    </p>
                  </div>
                  <Link
                    href="/registrations"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-11 shrink-0"
                    )}
                  >
                    Review registrations
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
          <BirthdayOverview state={birthdayState} />
        </>
      )}

    </main>
  );
}
