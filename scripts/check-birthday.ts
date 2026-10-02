import {
  getLastFridayOfMonth,
  getNextBirthday,
  getUpcomingBirthdays,
  type BirthdayPerson,
  type CivilDate,
} from "../lib/birthday";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function date(year: number, month: number, day: number): CivilDate {
  return { year, month, day };
}

function expectOccurrence(
  message: string,
  birthday: { birthMonth: number; birthDay: number; birthYear: number | null },
  reference: CivilDate,
  occurrence: CivilDate,
  daysUntil: number,
  ageTurning: number | null
) {
  const result = getNextBirthday(birthday, reference);
  assert(result.ok, `${message} should succeed`);

  if (!result.ok) {
    return;
  }

  assert(
    result.value.occurrence.year === occurrence.year &&
      result.value.occurrence.month === occurrence.month &&
      result.value.occurrence.day === occurrence.day,
    `${message} occurrence`
  );
  assert(result.value.daysUntil === daysUntil, `${message} days until`);
  assert(result.value.ageTurning === ageTurning, `${message} age`);
}

function expectInvalid(
  message: string,
  birthday: { birthMonth: number; birthDay: number; birthYear: number | null },
  reference: CivilDate
) {
  const result = getNextBirthday(birthday, reference);
  assert(!result.ok && result.reason === "invalid-date", message);
}

const june15 = { birthMonth: 6, birthDay: 15, birthYear: null };
const referenceJune = date(2026, 6, 15);

expectOccurrence(
  "birthday today",
  june15,
  referenceJune,
  date(2026, 6, 15),
  0,
  null
);
expectOccurrence(
  "birthday tomorrow",
  { birthMonth: 6, birthDay: 16, birthYear: null },
  referenceJune,
  date(2026, 6, 16),
  1,
  null
);
expectOccurrence(
  "birthday yesterday",
  { birthMonth: 6, birthDay: 14, birthYear: null },
  referenceJune,
  date(2027, 6, 14),
  364,
  null
);
expectOccurrence(
  "later this month",
  { birthMonth: 6, birthDay: 20, birthYear: null },
  date(2026, 6, 10),
  date(2026, 6, 20),
  10,
  null
);
expectOccurrence(
  "earlier this month",
  { birthMonth: 6, birthDay: 10, birthYear: null },
  date(2026, 6, 20),
  date(2027, 6, 10),
  355,
  null
);
expectOccurrence(
  "January 1 from December 31",
  { birthMonth: 1, birthDay: 1, birthYear: null },
  date(2025, 12, 31),
  date(2026, 1, 1),
  1,
  null
);
expectOccurrence(
  "December 31 from December 30",
  { birthMonth: 12, birthDay: 31, birthYear: null },
  date(2025, 12, 30),
  date(2025, 12, 31),
  1,
  null
);
expectOccurrence(
  "year rollover age",
  { birthMonth: 1, birthDay: 1, birthYear: 1990 },
  date(2025, 12, 31),
  date(2026, 1, 1),
  1,
  36
);
expectOccurrence(
  "known year",
  { birthMonth: 6, birthDay: 15, birthYear: 1990 },
  date(2026, 6, 1),
  date(2026, 6, 15),
  14,
  36
);
expectOccurrence(
  "unknown year",
  { birthMonth: 6, birthDay: 15, birthYear: null },
  date(2026, 6, 1),
  date(2026, 6, 15),
  14,
  null
);

expectOccurrence(
  "February 29 in a leap year",
  { birthMonth: 2, birthDay: 29, birthYear: null },
  date(2024, 2, 1),
  date(2024, 2, 29),
  28,
  null
);
expectOccurrence(
  "February 29 on the leap day",
  { birthMonth: 2, birthDay: 29, birthYear: 2000 },
  date(2024, 2, 29),
  date(2024, 2, 29),
  0,
  24
);
expectOccurrence(
  "February 29 approaching a non-leap year",
  { birthMonth: 2, birthDay: 29, birthYear: 2000 },
  date(2025, 2, 1),
  date(2025, 2, 28),
  27,
  25
);
expectOccurrence(
  "February 29 on February 28 of a non-leap year",
  { birthMonth: 2, birthDay: 29, birthYear: 2000 },
  date(2025, 2, 28),
  date(2025, 2, 28),
  0,
  25
);
expectOccurrence(
  "February 29 after February 28 of a non-leap year",
  { birthMonth: 2, birthDay: 29, birthYear: 2000 },
  date(2025, 3, 1),
  date(2026, 2, 28),
  364,
  26
);
expectOccurrence(
  "February 29 after a leap day",
  { birthMonth: 2, birthDay: 29, birthYear: null },
  date(2024, 3, 1),
  date(2025, 2, 28),
  364,
  null
);
expectOccurrence(
  "March 1 after a leap day is the following non-leap substitute",
  { birthMonth: 2, birthDay: 29, birthYear: null },
  date(2024, 3, 1),
  date(2025, 2, 28),
  364,
  null
);
expectOccurrence(
  "2100 occurrence is February 28",
  { birthMonth: 2, birthDay: 29, birthYear: null },
  date(2100, 2, 1),
  date(2100, 2, 28),
  27,
  null
);
expectOccurrence(
  "2400 occurrence is February 29",
  { birthMonth: 2, birthDay: 29, birthYear: 2400 },
  date(2400, 2, 1),
  date(2400, 2, 29),
  28,
  0
);
expectOccurrence(
  "February 28 stays February 28 in a leap year",
  { birthMonth: 2, birthDay: 28, birthYear: null },
  date(2024, 2, 1),
  date(2024, 2, 28),
  27,
  null
);
expectOccurrence(
  "non-leap February 28 to March 1 is one day",
  { birthMonth: 3, birthDay: 1, birthYear: null },
  date(2025, 2, 28),
  date(2025, 3, 1),
  1,
  null
);
expectOccurrence(
  "leap February 28 to March 1 is two days",
  { birthMonth: 3, birthDay: 1, birthYear: null },
  date(2024, 2, 28),
  date(2024, 3, 1),
  2,
  null
);

expectInvalid(
  "month 0",
  { birthMonth: 0, birthDay: 1, birthYear: null },
  referenceJune
);
expectInvalid(
  "month 13",
  { birthMonth: 13, birthDay: 1, birthYear: null },
  referenceJune
);
expectInvalid(
  "day 0",
  { birthMonth: 6, birthDay: 0, birthYear: null },
  referenceJune
);
expectInvalid(
  "April 31",
  { birthMonth: 4, birthDay: 31, birthYear: null },
  referenceJune
);
expectInvalid(
  "February 30",
  { birthMonth: 2, birthDay: 30, birthYear: null },
  referenceJune
);
expectInvalid(
  "February 29 in 2100",
  { birthMonth: 2, birthDay: 29, birthYear: 2100 },
  date(2100, 1, 1)
);
expectInvalid(
  "February 29 in 2025",
  { birthMonth: 2, birthDay: 29, birthYear: 2025 },
  date(2025, 1, 1)
);
expectInvalid(
  "non-integer month",
  { birthMonth: 6.5, birthDay: 1, birthYear: null },
  referenceJune
);
expectInvalid(
  "non-integer day",
  { birthMonth: 6, birthDay: 1.5, birthYear: null },
  referenceJune
);
expectInvalid(
  "non-integer year",
  { birthMonth: 6, birthDay: 1, birthYear: 1990.5 },
  referenceJune
);
expectInvalid(
  "invalid reference date",
  june15,
  date(2025, 2, 29)
);
expectInvalid(
  "birth year before 1900",
  { birthMonth: 6, birthDay: 1, birthYear: 1899 },
  referenceJune
);

const people: BirthdayPerson[] = [
  {
    id: "b",
    displayName: "Sam",
    birthMonth: 6,
    birthDay: 15,
    birthYear: null,
  },
  {
    id: "a",
    displayName: "Sam",
    birthMonth: 6,
    birthDay: 15,
    birthYear: null,
  },
  {
    id: "c",
    displayName: "Ada",
    birthMonth: 6,
    birthDay: 16,
    birthYear: 1990,
  },
  {
    id: "d",
    displayName: "Bea",
    birthMonth: 6,
    birthDay: 15,
    birthYear: null,
  },
  {
    id: "invalid",
    displayName: "Broken",
    birthMonth: 4,
    birthDay: 31,
    birthYear: null,
  },
];

const todayOnly = getUpcomingBirthdays(people, referenceJune, 0);
assert(todayOnly.ok, "today window succeeds");
if (todayOnly.ok) {
  assert(
    todayOnly.value.map((person) => person.id).join(",") === "d,a,b",
    "today window sorts name then id"
  );
}

const throughTomorrow = getUpcomingBirthdays(people, referenceJune, 1);
assert(throughTomorrow.ok, "one-day window succeeds");
if (throughTomorrow.ok) {
  assert(
    throughTomorrow.value.map((person) => person.id).join(",") === "d,a,b,c",
    "different days sort by days until"
  );
  assert(throughTomorrow.value[3]?.ageTurning === 36, "upcoming age");
}

const day30 = getUpcomingBirthdays(
  [
    {
      id: "edge",
      displayName: "Edge",
      birthMonth: 7,
      birthDay: 15,
      birthYear: null,
    },
  ],
  referenceJune,
  30
);
assert(day30.ok && day30.value.length === 1, "day 30 is included");

const day31 = getUpcomingBirthdays(
  [
    {
      id: "past-edge",
      displayName: "Later",
      birthMonth: 7,
      birthDay: 16,
      birthYear: null,
    },
  ],
  referenceJune,
  30
);
assert(day31.ok && day31.value.length === 0, "day 31 is excluded");

const negativeWindow = getUpcomingBirthdays(people, referenceJune, -1);
assert(
  !negativeWindow.ok && negativeWindow.reason === "invalid-window",
  "negative window"
);
const fractionalWindow = getUpcomingBirthdays(people, referenceJune, 30.5);
assert(
  !fractionalWindow.ok && fractionalWindow.reason === "invalid-window",
  "non-integer window"
);

const skipped = getUpcomingBirthdays(
  [
    people[4],
    {
      id: "ok",
      displayName: "Ok",
      birthMonth: 6,
      birthDay: 15,
      birthYear: null,
    },
  ],
  referenceJune,
  30
);
assert(
  skipped.ok && skipped.value.length === 1 && skipped.value[0]?.id === "ok",
  "invalid person is skipped"
);

function expectLastFriday(
  message: string,
  year: number,
  month: number,
  day: number
) {
  const result = getLastFridayOfMonth({ year, month });
  assert(result.ok, `${message} should succeed`);

  if (!result.ok) {
    return;
  }

  assert(result.value.year === year, `${message} year`);
  assert(result.value.month === month, `${message} month`);
  assert(result.value.day === day, `${message} day`);
  assert(
    Object.keys(result.value).join(",") === "year,month,day",
    `${message} has only year, month, and day`
  );
}

function expectInvalidLastFriday(
  message: string,
  year: number,
  month: number
) {
  const result = getLastFridayOfMonth({ year, month });
  assert(!result.ok && result.reason === "invalid-date", message);
}

expectLastFriday("October 2026 ends Saturday", 2026, 10, 30);
expectLastFriday("April 2026 ends Thursday", 2026, 4, 24);
expectLastFriday("February 2025 ends Friday", 2025, 2, 28);
expectLastFriday("February 2026 ends Saturday", 2026, 2, 27);
expectLastFriday("February 2024 leap year", 2024, 2, 23);
expectLastFriday("February 2100 ends Sunday", 2100, 2, 26);
expectLastFriday("May 2026 ends Sunday", 2026, 5, 29);
// 1970-01-01 is Thursday, so 1969-12-31 is Wednesday and 1969-12-26 is Friday.
expectLastFriday("December 1969 before 1970", 1969, 12, 26);

expectInvalidLastFriday("month 0", 2026, 0);
expectInvalidLastFriday("month 13", 2026, 13);
expectInvalidLastFriday("year 0", 0, 1);
expectInvalidLastFriday("year 10000", 10000, 1);
expectInvalidLastFriday("non-integer month", 2026, 6.5);
expectInvalidLastFriday("non-integer year", 2026.5, 10);
expectInvalidLastFriday("NaN year", Number.NaN, 10);
expectInvalidLastFriday("Infinity month", 2026, Number.POSITIVE_INFINITY);

console.log("birthday calculation checks passed");
