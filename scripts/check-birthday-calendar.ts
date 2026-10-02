import { getBirthdaysInMonth, type BirthdayPerson } from "../lib/birthday";
import {
  adjacentCalendarMonth,
  calendarMonthFromQuery,
} from "../lib/birthday-calendar";

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
): BirthdayPerson {
  return { id, displayName, birthMonth, birthDay, birthYear };
}

const october = getBirthdaysInMonth(
  [
    person("late", "Late", 10, 20, null),
    person("other", "Other", 11, 1, null),
    person("b", "Sam", 10, 2, null),
    person("a", "Sam", 10, 2, 1990),
    person("ada", "Ada", 10, 2, null),
    person("invalid", "Broken", 10, 32, null),
  ],
  2026,
  10
);

assert(october.ok, "October month succeeds");
if (october.ok) {
  assert(
    october.value.map((birthday) => birthday.id).join(",") === "ada,a,b,late",
    "October includes the month, sorts day then name then id, and skips another month"
  );
  assert(october.value[0]?.ageTurning === null, "unknown year has no age");
  assert(october.value[1]?.ageTurning === 36, "known year age");
  assert(
    october.value.every((birthday) => birthday.occurrence.month === 10),
    "October occurrences stay in October"
  );
}

const february2026 = getBirthdaysInMonth(
  [person("leap", "Leap", 2, 29, 2000)],
  2026,
  2
);
assert(february2026.ok, "February 2026 succeeds");
if (february2026.ok) {
  assert(february2026.value.length === 1, "February 2026 includes leap-day birthday");
  assert(
    february2026.value[0]?.occurrence.year === 2026 &&
      february2026.value[0]?.occurrence.month === 2 &&
      february2026.value[0]?.occurrence.day === 28,
    "February 2026 celebrates 29 February on 28 February"
  );
  assert(february2026.value[0]?.birthDay === 29, "stored day stays 29");
  assert(february2026.value[0]?.ageTurning === 26, "non-leap age uses occurrence year");
}

const february2024 = getBirthdaysInMonth(
  [person("leap", "Leap", 2, 29, null)],
  2024,
  2
);
assert(february2024.ok, "February 2024 succeeds");
if (february2024.ok) {
  assert(
    february2024.value[0]?.occurrence.day === 29 &&
      february2024.value[0]?.ageTurning === null,
    "February 2024 keeps 29 February and unknown age"
  );
}

const invalidMonth = getBirthdaysInMonth([], 2026, 0);
assert(!invalidMonth.ok && invalidMonth.reason === "invalid-date", "month 0 fails");
const invalidMonthHigh = getBirthdaysInMonth([], 2026, 13);
assert(
  !invalidMonthHigh.ok && invalidMonthHigh.reason === "invalid-date",
  "month 13 fails"
);
const invalidYear = getBirthdaysInMonth([], 0, 1);
assert(!invalidYear.ok && invalidYear.reason === "invalid-date", "year 0 fails");
const invalidYearHigh = getBirthdaysInMonth([], 10000, 1);
assert(
  !invalidYearHigh.ok && invalidYearHigh.reason === "invalid-date",
  "year 10000 fails"
);

const skipped = getBirthdaysInMonth(
  [
    person("bad", "Broken", 4, 31, null),
    person("ok", "Ok", 4, 2, null),
  ],
  2026,
  4
);
assert(
  skipped.ok && skipped.value.length === 1 && skipped.value[0]?.id === "ok",
  "invalid person is skipped"
);

const today = { year: 2026, month: 10 };
assert(
  calendarMonthFromQuery(undefined, undefined, today).month === 10 &&
    calendarMonthFromQuery(undefined, undefined, today).year === 2026,
  "missing query uses the UTC month"
);
assert(
  calendarMonthFromQuery("2026", "2", today).month === 2,
  "valid query selects that month"
);
assert(
  calendarMonthFromQuery("nope", "10", today).month === 10 &&
    calendarMonthFromQuery("2026", "13", today).year === 2026,
  "malformed query falls back to the UTC month"
);

const intoJanuary = adjacentCalendarMonth({ year: 2026, month: 12 }, "next");
assert(
  intoJanuary?.year === 2027 && intoJanuary.month === 1,
  "December moves to January of the next year"
);
const intoDecember = adjacentCalendarMonth({ year: 2026, month: 1 }, "previous");
assert(
  intoDecember?.year === 2025 && intoDecember.month === 12,
  "January moves to December of the previous year"
);
assert(
  adjacentCalendarMonth({ year: 1, month: 1 }, "previous") === null,
  "year 1 has no previous month"
);
assert(
  adjacentCalendarMonth({ year: 9999, month: 12 }, "next") === null,
  "year 9999 has no next month"
);

console.log("birthday calendar checks passed");
