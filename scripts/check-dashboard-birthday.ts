import { getUpcomingBirthdays, type UpcomingBirthday } from "../lib/birthday";
import {
  birthdaySummaryCounts,
  bornOnLine,
  dashboardBirthdayListLimit,
  formatCelebrationDate,
  presentUpcomingBirthday,
  relativeBirthdayLabel,
  turningLabel,
  utcReferenceCivilDate,
  visibleUpcomingBirthdays,
} from "../lib/dashboard-birthday";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function person(
  id: string,
  displayName: string,
  birthMonth: number,
  birthDay: number,
  birthYear: number | null
): UpcomingBirthday {
  return {
    id,
    displayName,
    birthMonth,
    birthDay,
    birthYear,
    occurrence: { year: 2026, month: birthMonth, day: birthDay },
    daysUntil: 0,
    ageTurning: birthYear === null ? null : 2026 - birthYear,
  };
}

const utcEvening = new Date("2026-10-01T23:30:00.000Z");
const utcDate = utcReferenceCivilDate(utcEvening);
assert(utcDate.year === 2026, "UTC year");
assert(utcDate.month === 10, "UTC month");
assert(utcDate.day === 1, "UTC day");

const justAfterUtcMidnight = new Date("2026-10-02T00:30:00.000Z");
const nextUtcDate = utcReferenceCivilDate(justAfterUtcMidnight);
assert(nextUtcDate.day === 2, "UTC day rolls at UTC midnight");

assert(relativeBirthdayLabel(0) === "Today", "today label");
assert(relativeBirthdayLabel(1) === "Tomorrow", "tomorrow label");
assert(relativeBirthdayLabel(5) === "In 5 days", "later label");
assert(turningLabel(null) === null, "unknown age omitted");
assert(turningLabel(32) === "Turning 32", "known age");
assert(formatCelebrationDate({ year: 2026, month: 10, day: 15 }) === "15 October", "celebration date");

const upcoming = [
  { ...person("a", "Ada", 10, 1, 1994), daysUntil: 0, ageTurning: 32 },
  { ...person("b", "Bea", 10, 2, null), daysUntil: 1, ageTurning: null },
  { ...person("c", "Cara", 10, 8, 2000), daysUntil: 7, ageTurning: 26 },
  { ...person("d", "Dee", 10, 20, 1990), daysUntil: 19, ageTurning: 36 },
  { ...person("e", "Eli", 10, 31, null), daysUntil: 30, ageTurning: null },
  { ...person("f", "Fae", 11, 1, 1988), daysUntil: 31, ageTurning: 38 },
];

const counts = birthdaySummaryCounts(upcoming);
assert(counts.today === 1, "today count");
assert(counts.withinSevenDays === 3, "seven day count includes today");
assert(counts.withinThirtyDays === 6, "thirty day count is the full result");

const visible = visibleUpcomingBirthdays(upcoming);
assert(visible.length === dashboardBirthdayListLimit, "list limit");
assert(visible.map((row) => row.id).join() === "a,b,c,d,e", "list keeps helper order");

const unknownAge = presentUpcomingBirthday(upcoming[1], {
  first_name: "Bea",
  last_name: "Stone",
});
assert(unknownAge.turningLabel === null, "row omits unknown age");
assert(unknownAge.relativeLabel === "Tomorrow", "row relative label");
assert(unknownAge.celebrationDate === "2 October", "row celebration date");
assert(unknownAge.bornLine === null, "ordinary birthday has no born line");

const leapReference = { year: 2024, month: 2, day: 1 };
const leapResult = getUpcomingBirthdays(
  [
    {
      id: "leap",
      displayName: "Leap",
      birthMonth: 2,
      birthDay: 29,
      birthYear: 2000,
    },
  ],
  leapReference,
  30
);
assert(leapResult.ok, "leap window");
if (leapResult.ok) {
  const row = presentUpcomingBirthday(leapResult.value[0], {
    first_name: "Leap",
    last_name: "Day",
  });
  assert(row.celebrationDate === "29 February", "leap celebration date");
  assert(row.bornLine === null, "leap year does not repeat the date");
  assert(row.turningLabel === "Turning 24", "leap turning age");
  assert(bornOnLine(leapResult.value[0]) === null, "leap born line");
}

const nonLeapReference = { year: 2025, month: 2, day: 1 };
const nonLeapResult = getUpcomingBirthdays(
  [
    {
      id: "non-leap",
      displayName: "Non Leap",
      birthMonth: 2,
      birthDay: 29,
      birthYear: null,
    },
  ],
  nonLeapReference,
  30
);
assert(nonLeapResult.ok, "non-leap window");
if (nonLeapResult.ok) {
  const row = presentUpcomingBirthday(nonLeapResult.value[0], {
    first_name: null,
    last_name: null,
  });
  assert(row.celebrationDate === "28 February", "non-leap celebration date");
  assert(row.bornLine === "Born 29 February", "non-leap born line without year");
  assert(row.turningLabel === null, "non-leap unknown year omits age");
}

const nonLeapKnownYear = getUpcomingBirthdays(
  [
    {
      id: "non-leap-year",
      displayName: "Non Leap Year",
      birthMonth: 2,
      birthDay: 29,
      birthYear: 2000,
    },
  ],
  nonLeapReference,
  30
);
assert(nonLeapKnownYear.ok, "non-leap known year");
if (nonLeapKnownYear.ok) {
  assert(
    bornOnLine(nonLeapKnownYear.value[0]) === "Born 29 February 2000",
    "born line includes year"
  );
  assert(
    presentUpcomingBirthday(nonLeapKnownYear.value[0], {
      first_name: "Nia",
      last_name: "Leap",
    }).turningLabel === "Turning 25",
    "non-leap turning age uses occurrence year"
  );
}

console.log("dashboard birthday presentation checks passed");
