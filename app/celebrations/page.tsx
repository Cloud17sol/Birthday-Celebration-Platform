import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { cn } from "cn";
import { activateCelebration } from "@/app/celebrations/actions";
import { AppShell } from "@/components/app-shell";
import { CelebrationMonthNav } from "@/components/celebration-month-nav";
import { MemberAvatar } from "@/components/member-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBirthdaysInMonth, getLastFridayOfMonth, type MonthBirthday } from "@/lib/birthday";
import {
  calendarMonthFromQuery,
  calendarMonthName,
} from "@/lib/birthday-calendar";
import { formatStoredCelebrationDate, lastFridayLabel } from "@/lib/celebration";
import { celebrationPresentationPath } from "@/lib/celebration-presentation";
import {
  bornOnLine,
  turningLabel,
  utcReferenceCivilDate,
} from "@/lib/dashboard-birthday";
import { memberInitials } from "@/lib/member-photo";
import { signMemberPhotoUrls } from "@/lib/member-photo-urls";
import { createClient } from "@/lib/supabase/server";

type CelebrationsPageProps = {
  searchParams: Promise<{
    year?: string | string[];
    month?: string | string[];
    error?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

function groupByOccurrence(birthdays: readonly MonthBirthday[]) {
  const groups: {
    key: string;
    label: string;
    people: MonthBirthday[];
  }[] = [];

  for (const birthday of birthdays) {
    const key = String(birthday.occurrence.day);
    const current = groups[groups.length - 1];

    if (current && current.key === key) {
      current.people.push(birthday);
      continue;
    }

    groups.push({
      key,
      label: `${birthday.occurrence.day} ${calendarMonthName(birthday.occurrence.month) ?? ""}`.trim(),
      people: [birthday],
    });
  }

  return groups;
}

export default async function CelebrationsPage({
  searchParams,
}: CelebrationsPageProps) {
  const params = await searchParams;
  const error = firstParam(params.error);
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
        <AppShell>
        <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
          <h1 className="text-2xl font-semibold">Monthly celebration</h1>
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
        </AppShell>
      );
    }

    redirect("/dashboard");
  }

  const canManage =
    currentMembership.role === "owner" || currentMembership.role === "admin";
  const today = utcReferenceCivilDate();
  const selected = calendarMonthFromQuery(
    firstParam(params.year),
    firstParam(params.month),
    today
  );
  const monthName = calendarMonthName(selected.month) ?? "this month";
  const lastFriday = getLastFridayOfMonth(selected);
  const calculatedLabel = lastFriday.ok
    ? lastFridayLabel(lastFriday.value.day, monthName, lastFriday.value.year)
    : null;

  const { data: celebration, error: celebrationError } = await supabase
    .from("celebrations")
    .select("celebration_date, schedule_rule, status")
    .eq("organization_id", currentMembership.organization_id)
    .eq("celebration_year", selected.year)
    .eq("celebration_month", selected.month)
    .maybeSingle();

  const storedLabel = celebration
    ? formatStoredCelebrationDate(celebration.celebration_date)
    : null;
  const dateLabel = celebration ? storedLabel : calculatedLabel;
  const presentationPath = celebration
    ? celebrationPresentationPath(selected.year, selected.month)
    : null;

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select(
      "id, display_name, first_name, last_name, birth_month, birth_day, birth_year, photo_url"
    )
    .eq("organization_id", currentMembership.organization_id)
    .eq("is_active", true)
    .eq("birth_month", selected.month);

  const birthdays =
    membersError || !members
      ? null
      : getBirthdaysInMonth(
          members.map((member) => ({
            id: member.id,
            displayName: member.display_name,
            birthMonth: member.birth_month,
            birthDay: member.birth_day,
            birthYear: member.birth_year,
          })),
          selected.year,
          selected.month
        );
  const celebrantsFailed = !birthdays || !birthdays.ok;
  const groups = birthdays?.ok ? groupByOccurrence(birthdays.value) : [];
  const membersById = new Map((members ?? []).map((member) => [member.id, member]));
  const imageUrls: Record<string, string> = {};

  if (birthdays?.ok) {
    const visibleMembers = birthdays.value.flatMap((birthday) => {
      const member = membersById.get(birthday.id);

      if (!member) {
        return [];
      }

      return [{ id: member.id, photo_url: member.photo_url }];
    });
    const signedPhotoUrls = await signMemberPhotoUrls(
      supabase,
      currentMembership.organization_id,
      visibleMembers
    );

    for (const [memberId, imageUrl] of signedPhotoUrls) {
      imageUrls[memberId] = imageUrl;
    }
  }

  return (
    <AppShell>
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Monthly celebration</h1>
          <p className="mt-2 font-medium">{organization.name}</p>
        </div>
        <Link
          href="/dashboard"
          aria-label="Dashboard"
          title="Dashboard"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "size-11 shrink-0"
          )}
        >
          <LayoutDashboard />
        </Link>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">
          {monthName} {selected.year}
        </h2>
        <div className="mt-3">
          <CelebrationMonthNav year={selected.year} month={selected.month} />
        </div>
      </div>

      {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}

      <Card className="mt-6" size="sm">
        <CardContent>
          {celebrationError ? (
            <p className="text-sm text-destructive">
              Unable to load celebration. Please try again.
            </p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  Celebration
                  <span className="ml-2 font-normal text-muted-foreground">
                    {celebration ? "Active" : "Not active yet."}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dateLabel ?? "Unable to load celebration. Please try again."}
                  {celebration?.schedule_rule === "last_friday" ? " · Last Friday" : null}
                </p>
              </div>
              {presentationPath ? (
                <Link
                  href={presentationPath}
                  className={cn(buttonVariants(), "h-11 shrink-0")}
                >
                  Present celebration
                </Link>
              ) : null}
              {!celebration && canManage && calculatedLabel ? (
                <form action={activateCelebration} className="shrink-0">
                  <input type="hidden" name="year" value={selected.year} />
                  <input type="hidden" name="month" value={selected.month} />
                  <Button type="submit" className="h-11">
                    Activate celebration
                  </Button>
                </form>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="mt-6 space-y-4" aria-labelledby="celebrants-heading">
        <h2 id="celebrants-heading" className="text-lg font-semibold">
          {monthName} celebrants
        </h2>
        {celebrantsFailed ? (
          <p className="text-sm text-destructive">
            Unable to load celebrants. Please try again.
          </p>
        ) : groups.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No active celebrants in {monthName}.</CardTitle>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`celebrant-date-${group.key}`}>
              <Card>
                <CardHeader>
                  <CardTitle id={`celebrant-date-${group.key}`}>{group.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-foreground/10">
                    {group.people.map((birthday) => {
                      const member = membersById.get(birthday.id);
                      const bornLine = bornOnLine(birthday);
                      const ageLabel = turningLabel(birthday.ageTurning);

                      return (
                        <li
                          key={birthday.id}
                          className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <MemberAvatar
                            initials={memberInitials(
                              member?.first_name,
                              member?.last_name,
                              birthday.displayName
                            )}
                            imageUrl={imageUrls[birthday.id] ?? null}
                          />
                          <div className="min-w-0">
                            <p className="font-medium">{birthday.displayName}</p>
                            <p className="text-sm">{group.label}</p>
                            {ageLabel ? (
                              <p className="text-sm text-muted-foreground">{ageLabel}</p>
                            ) : null}
                            {bornLine ? (
                              <p className="text-sm text-muted-foreground">{bornLine}</p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ))}
          </div>
        )}
      </section>
    </main>
    </AppShell>
  );
}
