import type { BirthdayPerson, CivilDate, UpcomingBirthday } from "@/lib/birthday";

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

export const dashboardBirthdayWindowDays = 30;
export const dashboardBirthdayListLimit = 5;

export type DashboardMemberRow = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  birth_month: number;
  birth_day: number;
  birth_year: number | null;
};

export type BirthdayOverviewCounts = {
  today: number;
  withinSevenDays: number;
  withinThirtyDays: number;
};

export type BirthdayOverviewRow = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  relativeLabel: string;
  celebrationDate: string;
  bornLine: string | null;
  turningLabel: string | null;
};

// UTC is the temporary civil "today" until an organization timezone exists.
// Callers pass this date into the birthday helper. The helper does not read the clock.
export function utcReferenceCivilDate(now: Date = new Date()): CivilDate {
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

export function toBirthdayPerson(member: DashboardMemberRow): BirthdayPerson {
  return {
    id: member.id,
    displayName: member.display_name,
    birthMonth: member.birth_month,
    birthDay: member.birth_day,
    birthYear: member.birth_year,
  };
}

export function birthdaySummaryCounts(
  upcoming: readonly UpcomingBirthday[]
): BirthdayOverviewCounts {
  let today = 0;
  let withinSevenDays = 0;

  for (const birthday of upcoming) {
    if (birthday.daysUntil === 0) {
      today += 1;
    }

    if (birthday.daysUntil <= 7) {
      withinSevenDays += 1;
    }
  }

  return {
    today,
    withinSevenDays,
    withinThirtyDays: upcoming.length,
  };
}

export function visibleUpcomingBirthdays(
  upcoming: readonly UpcomingBirthday[]
) {
  return upcoming.slice(0, dashboardBirthdayListLimit);
}

export function relativeBirthdayLabel(daysUntil: number) {
  if (daysUntil === 0) {
    return "Today";
  }

  if (daysUntil === 1) {
    return "Tomorrow";
  }

  return `In ${daysUntil} days`;
}

export function formatCelebrationDate(occurrence: CivilDate) {
  const monthName = monthNames[occurrence.month - 1];

  if (!monthName) {
    return "—";
  }

  return `${occurrence.day} ${monthName}`;
}

export function bornOnLine(birthday: {
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
  occurrence: CivilDate;
}) {
  const storedOnLeapDay = birthday.birthMonth === 2 && birthday.birthDay === 29;
  const celebratedOnLeapDay =
    birthday.occurrence.month === 2 && birthday.occurrence.day === 29;

  if (!storedOnLeapDay || celebratedOnLeapDay) {
    return null;
  }

  if (birthday.birthYear === null) {
    return "Born 29 February";
  }

  return `Born 29 February ${birthday.birthYear}`;
}

export function turningLabel(ageTurning: number | null) {
  if (ageTurning === null) {
    return null;
  }

  return `Turning ${ageTurning}`;
}

export function presentUpcomingBirthday(
  birthday: UpcomingBirthday,
  member: Pick<DashboardMemberRow, "first_name" | "last_name">
): BirthdayOverviewRow {
  return {
    id: birthday.id,
    displayName: birthday.displayName,
    firstName: member.first_name,
    lastName: member.last_name,
    relativeLabel: relativeBirthdayLabel(birthday.daysUntil),
    celebrationDate: formatCelebrationDate(birthday.occurrence),
    bornLine: bornOnLine(birthday),
    turningLabel: turningLabel(birthday.ageTurning),
  };
}
