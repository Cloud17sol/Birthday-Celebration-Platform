import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { cn } from "cn";
import { BirthdayDateCard } from "@/components/birthday-date-card";
import { CelebrationMonthNav } from "@/components/celebration-month-nav";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getBirthdaysInMonth, type CivilDate, type MonthBirthday } from "@/lib/birthday";
import { birthdayCardColors } from "@/lib/birthday-card-colors";
import {
  calendarMonthFromQuery,
  calendarMonthName,
} from "@/lib/birthday-calendar";
import {
  bornOnLine,
  formatCelebrationDate,
  turningLabel,
  utcReferenceCivilDate,
} from "@/lib/dashboard-birthday";
import { memberInitials } from "@/lib/member-photo";
import { signMemberPhotoUrls } from "@/lib/member-photo-urls";
import { createClient } from "@/lib/supabase/server";

type BirthdaysPageProps = {
  searchParams: Promise<{
    year?: string | string[];
    month?: string | string[];
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
      label: formatCelebrationDate(birthday.occurrence),
      people: [birthday],
    });
  }

  return groups;
}

function withYear(monthDay: string, year: number | null) {
  if (monthDay === "—" || year == null) {
    return monthDay;
  }

  return `${monthDay} ${year}`;
}

function personFullName(
  firstName: string | null,
  lastName: string | null,
  displayName: string
) {
  const name = [firstName, lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");

  if (!name || name.toLowerCase() === displayName.trim().toLowerCase()) {
    return null;
  }

  return name;
}

function celebrationLabel(occurrence: CivilDate) {
  return withYear(formatCelebrationDate(occurrence), occurrence.year);
}

function storedBirthdayLabel(birthday: MonthBirthday) {
  return withYear(
    formatCelebrationDate({
      year: birthday.occurrence.year,
      month: birthday.birthMonth,
      day: birthday.birthDay,
    }),
    birthday.birthYear
  );
}

export default async function BirthdaysPage({ searchParams }: BirthdaysPageProps) {
  const params = await searchParams;
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
          <h1 className="text-2xl font-semibold">Birthday calendar</h1>
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

  const today = utcReferenceCivilDate();
  const selected = calendarMonthFromQuery(
    firstParam(params.year),
    firstParam(params.month),
    today
  );
  const monthName = calendarMonthName(selected.month) ?? "this month";

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select(
      "id, display_name, first_name, last_name, birth_month, birth_day, birth_year, photo_url, email, phone, notes"
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

  const loadFailed = !birthdays || !birthdays.ok;
  const groups = birthdays?.ok ? groupByOccurrence(birthdays.value) : [];
  const cardColors = birthdayCardColors(
    groups.map((group) => `${selected.year}-${selected.month}-${group.key}`)
  );
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
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Birthday calendar</h1>
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
          <CelebrationMonthNav
            year={selected.year}
            month={selected.month}
            kind="calendar"
          />
        </div>
      </div>

      {loadFailed ? (
        <p className="mt-6 text-sm text-destructive">
          Unable to load birthdays. Please try again.
        </p>
      ) : groups.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>No birthdays in {monthName}.</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {groups.map((group, index) => (
            <BirthdayDateCard
              key={group.key}
              label={group.label}
              backgroundColor={cardColors[index]}
              people={group.people.map((birthday) => {
                const member = membersById.get(birthday.id);

                return {
                  id: birthday.id,
                  displayName: birthday.displayName,
                  fullName: personFullName(
                    member?.first_name ?? null,
                    member?.last_name ?? null,
                    birthday.displayName
                  ),
                  initials: memberInitials(
                    member?.first_name,
                    member?.last_name,
                    birthday.displayName
                  ),
                  imageUrl: imageUrls[birthday.id] ?? null,
                  birthdayLabel: storedBirthdayLabel(birthday),
                  celebrationLabel: celebrationLabel(birthday.occurrence),
                  ageLabel: turningLabel(birthday.ageTurning),
                  bornLine: bornOnLine(birthday),
                  email: member?.email ?? null,
                  phone: member?.phone ?? null,
                  notes: member?.notes ?? null,
                };
              })}
            />
          ))}
        </div>
      )}
    </main>
  );
}
