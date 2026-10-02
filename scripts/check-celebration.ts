import { formatCivilDate } from "../lib/birthday";
import { strictCalendarMonth } from "../lib/birthday-calendar";
import {
  celebrationActivateError,
  formatStoredCelebrationDate,
} from "../lib/celebration";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

assert(formatCivilDate({ year: 2026, month: 10, day: 30 }) === "2026-10-30", "October date");
assert(formatCivilDate({ year: 1, month: 2, day: 3 }) === "0001-02-03", "padded date");
assert(formatCivilDate({ year: 2026, month: 13, day: 1 }) === null, "invalid month is not formatted");

assert(
  celebrationActivateError("23505") === "This month's celebration is already active.",
  "duplicate message"
);
assert(
  celebrationActivateError("23505").includes("celebrations_organization_year_month_key") ===
    false,
  "duplicate message hides the constraint"
);
assert(
  celebrationActivateError("XX000") === "Unable to activate celebration. Please try again.",
  "generic activation error"
);
assert(
  celebrationActivateError(undefined) === "Unable to activate celebration. Please try again.",
  "missing code is generic"
);

assert(
  formatStoredCelebrationDate("2026-10-30") === "30 October 2026",
  "stored date label"
);
assert(formatStoredCelebrationDate("not-a-date") === null, "bad stored date");

assert(
  strictCalendarMonth("2026", "10")?.year === 2026 &&
    strictCalendarMonth("2026", "10")?.month === 10,
  "strict month accepts digits"
);
assert(strictCalendarMonth("nope", "10") === null, "strict month rejects text");
assert(strictCalendarMonth("0", "1") === null, "strict month rejects year 0");
assert(strictCalendarMonth("10000", "1") === null, "strict month rejects year 10000");
assert(strictCalendarMonth("2026", undefined) === null, "strict month rejects a missing month");

console.log("celebration support checks passed");
