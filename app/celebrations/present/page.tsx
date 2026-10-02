import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { CelebrationSlideshow } from "@/components/celebration-slideshow";
import { buttonVariants } from "@/components/ui/button";
import { getBirthdaysInMonth } from "@/lib/birthday";
import {
  calendarMonthName,
  celebrationPath,
  strictCalendarMonth,
} from "@/lib/birthday-calendar";
import { formatStoredCelebrationDate } from "@/lib/celebration";
import { buildCelebrationSlides } from "@/lib/celebration-presentation";
import { signMemberPhotoUrls } from "@/lib/member-photo-urls";
import { createClient } from "@/lib/supabase/server";

type CelebrationPresentPageProps = {
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

const presentationShell =
  "presentation-stage flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 text-center text-white";

function workspaceLink(year: number, month: number, label: string) {
  return (
    <Link
      href={celebrationPath({ year, month })}
      className={cn(
        buttonVariants({ variant: "outline", size: "lg" }),
        "h-11 border-white/20 bg-white/90 px-4 text-sm text-[#142033] shadow-none"
      )}
    >
      {label}
    </Link>
  );
}

export default async function CelebrationPresentPage({
  searchParams,
}: CelebrationPresentPageProps) {
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
    .select("id, organization_id, role, created_at, organizations(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];
  const organization = currentMembership?.organizations;

  if (membershipError) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">Celebration presentation</h1>
          <p className="mt-4 text-sm text-destructive">
            Unable to load your organization. Please try again.
          </p>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-6 h-11 px-4")}
          >
            Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!currentMembership || !organization) {
    redirect("/dashboard");
  }

  const selected = strictCalendarMonth(
    firstParam(params.year),
    firstParam(params.month)
  );

  if (!selected) {
    redirect("/celebrations");
  }

  const monthName = calendarMonthName(selected.month) ?? "this month";
  const { data: celebration, error: celebrationError } = await supabase
    .from("celebrations")
    .select("celebration_date")
    .eq("organization_id", currentMembership.organization_id)
    .eq("celebration_year", selected.year)
    .eq("celebration_month", selected.month)
    .maybeSingle();

  if (celebrationError) {
    return (
      <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="max-w-xl">
          <p className="font-medium">{organization.name}</p>
          <h1 className="mt-3 text-3xl font-semibold">
            {monthName} {selected.year}
          </h1>
          <p className="mt-4 text-sm text-destructive">
            Unable to load celebration. Please try again.
          </p>
        </div>
        {workspaceLink(selected.year, selected.month, "Back to celebration workspace")}
      </main>
    );
  }

  if (!celebration) {
    return (
      <main className={cn(presentationShell, "gap-8")}>
        <div className="max-w-xl">
          <p className="text-xs font-medium tracking-[0.16em] text-white/75 uppercase sm:text-sm">
            {organization.name}
          </p>
          <h1 className="mt-3 text-balance text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight">
            {monthName} {selected.year}
          </h1>
          <p className="mt-6 text-lg">This celebration has not been activated yet.</p>
          <p className="mt-3 text-white/75">
            Activate the celebration from the monthly workspace before starting the
            presentation.
          </p>
        </div>
        {workspaceLink(selected.year, selected.month, "Back to celebration workspace")}
      </main>
    );
  }

  const dateLabel = formatStoredCelebrationDate(celebration.celebration_date);
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select(
      "id, display_name, first_name, last_name, birth_month, birth_day, birth_year, photo_url"
    )
    .eq("organization_id", currentMembership.organization_id)
    .eq("is_active", true)
    .eq("birth_month", selected.month);

  if (membersError || !members) {
    return (
      <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="max-w-xl">
          <p className="font-medium">{organization.name}</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold sm:text-5xl">
            Celebrating Our {monthName} Birthdays
          </h1>
          <p className="mt-4 text-sm text-destructive">
            Unable to load celebrants. Please try again.
          </p>
        </div>
        {workspaceLink(selected.year, selected.month, "Back to celebration workspace")}
      </main>
    );
  }

  const birthdays = getBirthdaysInMonth(
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

  if (!birthdays.ok) {
    return (
      <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="max-w-xl">
          <p className="font-medium">{organization.name}</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold sm:text-5xl">
            Celebrating Our {monthName} Birthdays
          </h1>
          <p className="mt-4 text-sm text-destructive">
            Unable to load celebrants. Please try again.
          </p>
        </div>
        {workspaceLink(selected.year, selected.month, "Back to celebration workspace")}
      </main>
    );
  }

  const membersById = new Map(members.map((member) => [member.id, member]));
  const signedPhotoUrls = await signMemberPhotoUrls(
    supabase,
    currentMembership.organization_id,
    birthdays.value.flatMap((birthday) => {
      const member = membersById.get(birthday.id);

      if (!member) {
        return [];
      }

      return [{ id: member.id, photo_url: member.photo_url }];
    })
  );
  const slides = buildCelebrationSlides(
    birthdays.value.map((birthday) => {
      const member = membersById.get(birthday.id);

      return {
        birthday,
        firstName: member?.first_name,
        lastName: member?.last_name,
        photoUrl: signedPhotoUrls.get(birthday.id) ?? null,
      };
    })
  );
  if (slides.length === 0) {
    return (
      <main className={cn(presentationShell, "gap-8")}>
        <div className="max-w-3xl">
          <p className="text-xs font-medium tracking-[0.16em] text-white/75 uppercase sm:text-sm">
            {organization.name}
          </p>
          <h1 className="mt-3 text-balance text-[clamp(1.75rem,3vw,3rem)] font-semibold tracking-tight">
            Celebrating Our {monthName} Birthdays
          </h1>
          {dateLabel ? (
            <p className="mt-3 text-base text-white/75 sm:text-lg">{dateLabel}</p>
          ) : null}
          <p className="mt-6 text-lg">No birthdays to celebrate this month.</p>
        </div>
        {workspaceLink(selected.year, selected.month, "Back to celebration workspace")}
      </main>
    );
  }

  return (
    <CelebrationSlideshow
      organizationName={organization.name}
      heading={`Celebrating Our ${monthName} Birthdays`}
      dateLabel={dateLabel}
      workspacePath={celebrationPath({ year: selected.year, month: selected.month })}
      slides={slides.map((slide) => ({
        displayName: slide.displayName,
        birthdayLabel: slide.birthdayLabel,
        turningLabel: slide.turningLabel,
        bornOnLine: slide.bornOnLine,
        photoUrl: slide.photoUrl,
        initials: slide.initials,
      }))}
    />
  );
}
