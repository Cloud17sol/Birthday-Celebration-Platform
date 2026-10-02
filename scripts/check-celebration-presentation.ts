import { getBirthdaysInMonth, type BirthdayPerson } from "../lib/birthday";
import { celebrationPath } from "../lib/birthday-calendar";
import {
  CELEBRATION_SLIDE_INTERVAL_MS,
  buildCelebrationSlides,
  celebrationPresentationPath,
  hasSlides,
  isSingleSlide,
  nextSlideIndex,
  previousSlideIndex,
  shouldAutoAdvance,
  type CelebrationSlideInput,
} from "../lib/celebration-presentation";

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

function slidesFor(
  people: readonly BirthdayPerson[],
  year: number,
  month: number,
  details: Record<
    string,
    Pick<CelebrationSlideInput, "firstName" | "lastName" | "photoUrl">
  > = {}
) {
  const birthdays = getBirthdaysInMonth(people, year, month);

  assert(birthdays.ok, "month birthdays");

  return buildCelebrationSlides(
    birthdays.value.map((birthday) => ({
      birthday,
      ...details[birthday.id],
    }))
  );
}

const none = slidesFor([], 2026, 10);
assert(none.length === 0, "zero celebrants");
assert(hasSlides(none.length) === false, "zero slides are absent");
assert(isSingleSlide(none.length) === false, "zero slides are not a single slide");

const only = slidesFor(
  [person("only", "James Bond", 2, 9, null)],
  2026,
  2,
  { only: { firstName: "James", lastName: "Bond", photoUrl: null } }
);
assert(only.length === 1, "one celebrant");
assert(isSingleSlide(only.length), "one slide");
assert(only[0]?.displayName === "James Bond", "display name is preserved");
assert(only[0]?.birthdayLabel === "9 February", "birthday label omits the year");
assert(only[0]?.occurrence.year === 2026, "occurrence year");
assert(only[0]?.occurrence.month === 2, "occurrence month");
assert(only[0]?.occurrence.day === 9, "occurrence day");
assert(only[0]?.ageTurning === null, "unknown year has no age");
assert(only[0]?.turningLabel === null, "unknown year has no turning label");
assert(only[0]?.initials === "JB", "initials come from the name");
assert(!("email" in only[0]!), "slide has no email");
assert(!("phone" in only[0]!), "slide has no phone");

const orderedPeople = [
  person("c", "Cara Stone", 10, 25, 1995),
  person("a", "Amy Stone", 10, 25, null),
  person("z", "Zoe Stone", 10, 9, 1990),
];
const ordered = slidesFor(orderedPeople, 2026, 10);
assert(
  ordered.map((slide) => slide.id).join(",") === "z,a,c",
  "established day then name order is preserved"
);
assert(ordered[0]?.birthdayLabel === "9 October", "earlier occurrence label");
assert(ordered[2]?.birthdayLabel === "25 October", "later occurrence label");
assert(ordered[2]?.ageTurning === 31, "known birth year age");
assert(ordered[2]?.turningLabel === "Turning 31", "known birth year label");
assert(ordered[1]?.ageTurning === null, "shared date can have an unknown year");
assert(ordered[1]?.turningLabel === null, "unknown year on a shared date");

const leap = slidesFor(
  [person("leap", "Leap Day", 2, 29, 2000)],
  2024,
  2
);
assert(leap[0]?.occurrence.day === 29, "leap-year occurrence stays 29 February");
assert(leap[0]?.birthdayLabel === "29 February", "leap-year label");
assert(leap[0]?.bornOnLine === null, "leap-year celebration has no born-on line");
assert(leap[0]?.ageTurning === 24, "leap-year age uses the occurrence year");
assert(leap[0]?.turningLabel === "Turning 24", "leap-year turning label");

const nonLeap = slidesFor(
  [person("non-leap", "Leap Day", 2, 29, 2000)],
  2026,
  2
);
assert(nonLeap[0]?.occurrence.day === 28, "non-leap occurrence is 28 February");
assert(nonLeap[0]?.birthdayLabel === "28 February", "non-leap label");
assert(
  nonLeap[0]?.bornOnLine === "Born 29 February 2000",
  "non-leap year uses the existing born-on line"
);

const missingPhoto = slidesFor(
  [person("plain", "No Photo", 3, 14, null)],
  2026,
  3,
  { plain: { firstName: null, lastName: null, photoUrl: "   " } }
);
assert(missingPhoto[0]?.photoUrl === null, "blank photo becomes absent");
assert(missingPhoto[0]?.initials === "NP", "missing photo still has initials");

const signed = "https://example.test/signed-photo";
const withPhoto = slidesFor(
  [person("photo", "Has Photo", 3, 14, null)],
  2026,
  3,
  { photo: { firstName: "Has", lastName: "Photo", photoUrl: signed } }
);
assert(withPhoto[0]?.photoUrl === signed, "signed photo is preserved");
assert(withPhoto[0]?.initials === "HP", "initials remain beside a photo");

assert(nextSlideIndex(3, 2) === 0, "next wraps from last to first");
assert(previousSlideIndex(3, 0) === 2, "previous wraps from first to last");
assert(
  [0, 1, 2, 0].every((expected, step) => {
    let index = 0;

    for (let move = 0; move < step; move += 1) {
      index = nextSlideIndex(3, index);
    }

    return index === expected;
  }),
  "multiple slides advance 0 to 1 to 2 then wrap"
);
assert(nextSlideIndex(1, 0) === 0, "one slide next stays at 0");
assert(previousSlideIndex(1, 0) === 0, "one slide previous stays at 0");
assert(nextSlideIndex(0, 0) === 0, "zero slides next is safe");
assert(previousSlideIndex(0, 4) === 0, "zero slides previous is safe");
assert(Number.isNaN(nextSlideIndex(0, 0)) === false, "zero slides do not return NaN");
assert(nextSlideIndex(0, -1) >= 0, "zero slides do not return a negative index");

assert(shouldAutoAdvance(0, false) === false, "zero slides do not autoplay");
assert(shouldAutoAdvance(1, false) === false, "one slide does not autoplay");
assert(shouldAutoAdvance(2, true) === false, "reduced motion does not autoplay");
assert(shouldAutoAdvance(2, false) === true, "two slides autoplay in normal motion");
assert(CELEBRATION_SLIDE_INTERVAL_MS === 7000, "interval is 7000 milliseconds");

assert(
  celebrationPresentationPath(2026, 10) === "/celebrations/present?year=2026&month=10",
  "presentation path"
);
assert(
  celebrationPath({ year: 2026, month: 10 }) === "/celebrations?year=2026&month=10",
  "workspace return path keeps the existing query"
);
assert(celebrationPresentationPath(0, 10) === null, "invalid year has no path");
assert(celebrationPresentationPath(2026, 13) === null, "invalid month has no path");

console.log("celebration presentation checks passed");
