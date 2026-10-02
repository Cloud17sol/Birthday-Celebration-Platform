export type CivilDate = {
  year: number;
  month: number;
  day: number;
};

// PostgreSQL date text. No Date and no local timezone conversion.
export function formatCivilDate(date: CivilDate) {
  if (
    !Number.isInteger(date.year) ||
    date.year < 1 ||
    date.year > 9999 ||
    !Number.isInteger(date.month) ||
    date.month < 1 ||
    date.month > 12 ||
    !Number.isInteger(date.day) ||
    date.day < 1 ||
    date.day > 31
  ) {
    return null;
  }

  const year = String(date.year).padStart(4, "0");
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export type BirthdayInput = {
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
};

export type NextBirthday = {
  occurrence: CivilDate;
  daysUntil: number;
  ageTurning: number | null;
};

export type BirthdayPerson = {
  id: string;
  displayName: string;
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
};

export type UpcomingBirthday = BirthdayPerson & NextBirthday;

export type MonthBirthday = {
  id: string;
  displayName: string;
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
  occurrence: CivilDate;
  ageTurning: number | null;
};

export type BirthdayResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "invalid-date" | "invalid-window" };

const minimumBirthYear = 1900;
const maximumYear = 9999;

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }

  return 31;
}

function isWholeYear(year: number) {
  return Number.isInteger(year) && year >= 1 && year <= maximumYear;
}

function isValidCivilDate(date: CivilDate) {
  if (!isWholeYear(date.year) || !Number.isInteger(date.month)) {
    return false;
  }

  if (date.month < 1 || date.month > 12 || !Number.isInteger(date.day)) {
    return false;
  }

  return date.day >= 1 && date.day <= daysInMonth(date.year, date.month);
}

function isValidBirthday(birthday: BirthdayInput, referenceYear: number) {
  if (!Number.isInteger(birthday.birthMonth) || !Number.isInteger(birthday.birthDay)) {
    return false;
  }

  if (birthday.birthMonth < 1 || birthday.birthMonth > 12 || birthday.birthDay < 1) {
    return false;
  }

  if (birthday.birthMonth === 2) {
    if (birthday.birthDay > 29) {
      return false;
    }
  } else if (
    birthday.birthDay >
    daysInMonth(2001, birthday.birthMonth)
  ) {
    return false;
  }

  if (birthday.birthYear === null) {
    return true;
  }

  if (
    !Number.isInteger(birthday.birthYear) ||
    birthday.birthYear < minimumBirthYear ||
    birthday.birthYear > referenceYear
  ) {
    return false;
  }

  if (birthday.birthMonth === 2 && birthday.birthDay === 29) {
    return isLeapYear(birthday.birthYear);
  }

  return true;
}

// Howard Hinnant's civil-to-days conversion. The result is days since
// 1970-01-01 and does not depend on a time zone.
function daysFromCivil(year: number, month: number, day: number) {
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;

  return era * 146097 + dayOfEra - 719468;
}

// JavaScript `%` keeps the sign of the dividend. Dates before 1970-01-01
// produce a negative civil-day count, so weekday math must normalize first.
function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

// 1970-01-01 is Thursday, and daysFromCivil returns 0 for that date.
// Sunday is 0 and Friday is 5.
function weekdayIndex(year: number, month: number, day: number) {
  return positiveModulo(daysFromCivil(year, month, day) + 4, 7);
}

function celebrationDate(
  birthday: BirthdayInput,
  occurrenceYear: number
): CivilDate {
  if (
    birthday.birthMonth === 2 &&
    birthday.birthDay === 29 &&
    !isLeapYear(occurrenceYear)
  ) {
    return { year: occurrenceYear, month: 2, day: 28 };
  }

  return {
    year: occurrenceYear,
    month: birthday.birthMonth,
    day: birthday.birthDay,
  };
}

function compareCivil(left: CivilDate, right: CivilDate) {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  if (left.month !== right.month) {
    return left.month - right.month;
  }

  return left.day - right.day;
}

function invalidDate(): BirthdayResult<NextBirthday> {
  return { ok: false, reason: "invalid-date" };
}

export function getNextBirthday(
  birthday: BirthdayInput,
  reference: CivilDate
): BirthdayResult<NextBirthday> {
  if (!isValidCivilDate(reference) || !isValidBirthday(birthday, reference.year)) {
    return invalidDate();
  }

  const thisYear = celebrationDate(birthday, reference.year);
  const occurrence =
    compareCivil(thisYear, reference) >= 0
      ? thisYear
      : celebrationDate(birthday, reference.year + 1);
  const daysUntil =
    daysFromCivil(occurrence.year, occurrence.month, occurrence.day) -
    daysFromCivil(reference.year, reference.month, reference.day);

  return {
    ok: true,
    value: {
      occurrence,
      daysUntil,
      ageTurning:
        birthday.birthYear === null
          ? null
          : occurrence.year - birthday.birthYear,
    },
  };
}

function isBirthdayPerson(person: BirthdayPerson) {
  return typeof person.id === "string" && typeof person.displayName === "string";
}

export function getUpcomingBirthdays(
  people: readonly BirthdayPerson[],
  reference: CivilDate,
  withinDays: number
): BirthdayResult<UpcomingBirthday[]> {
  if (!Number.isInteger(withinDays) || withinDays < 0) {
    return { ok: false, reason: "invalid-window" };
  }

  if (!isValidCivilDate(reference)) {
    return { ok: false, reason: "invalid-date" };
  }

  const upcoming: UpcomingBirthday[] = [];

  for (const person of people) {
    if (!isBirthdayPerson(person)) {
      continue;
    }

    const nextBirthday = getNextBirthday(person, reference);

    if (!nextBirthday.ok || nextBirthday.value.daysUntil > withinDays) {
      continue;
    }

    upcoming.push({
      id: person.id,
      displayName: person.displayName,
      birthMonth: person.birthMonth,
      birthDay: person.birthDay,
      birthYear: person.birthYear,
      occurrence: nextBirthday.value.occurrence,
      daysUntil: nextBirthday.value.daysUntil,
      ageTurning: nextBirthday.value.ageTurning,
    });
  }

  upcoming.sort((left, right) => {
    if (left.daysUntil !== right.daysUntil) {
      return left.daysUntil - right.daysUntil;
    }

    if (left.displayName < right.displayName) {
      return -1;
    }

    if (left.displayName > right.displayName) {
      return 1;
    }

    if (left.id < right.id) {
      return -1;
    }

    if (left.id > right.id) {
      return 1;
    }

    return 0;
  });

  return { ok: true, value: upcoming };
}

export function getBirthdaysInMonth(
  people: readonly BirthdayPerson[],
  year: number,
  month: number
): { ok: true; value: MonthBirthday[] } | { ok: false; reason: "invalid-date" } {
  if (!isWholeYear(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, reason: "invalid-date" };
  }

  const birthdays: MonthBirthday[] = [];

  for (const person of people) {
    if (!isBirthdayPerson(person) || person.birthMonth !== month) {
      continue;
    }

    if (!isValidBirthday(person, year)) {
      continue;
    }

    const occurrence = celebrationDate(person, year);

    birthdays.push({
      id: person.id,
      displayName: person.displayName,
      birthMonth: person.birthMonth,
      birthDay: person.birthDay,
      birthYear: person.birthYear,
      occurrence,
      ageTurning:
        person.birthYear === null ? null : occurrence.year - person.birthYear,
    });
  }

  birthdays.sort((left, right) => {
    if (left.occurrence.day !== right.occurrence.day) {
      return left.occurrence.day - right.occurrence.day;
    }

    if (left.displayName < right.displayName) {
      return -1;
    }

    if (left.displayName > right.displayName) {
      return 1;
    }

    if (left.id < right.id) {
      return -1;
    }

    if (left.id > right.id) {
      return 1;
    }

    return 0;
  });

  return { ok: true, value: birthdays };
}

const fridayWeekday = 5;

export function getLastFridayOfMonth(input: {
  year: number;
  month: number;
}): { ok: true; value: CivilDate } | { ok: false; reason: "invalid-date" } {
  if (
    !isWholeYear(input.year) ||
    !Number.isInteger(input.month) ||
    input.month < 1 ||
    input.month > 12
  ) {
    return { ok: false, reason: "invalid-date" };
  }

  const lastDay = daysInMonth(input.year, input.month);
  const daysAfterFriday = positiveModulo(
    weekdayIndex(input.year, input.month, lastDay) - fridayWeekday,
    7
  );

  return {
    ok: true,
    value: {
      year: input.year,
      month: input.month,
      day: lastDay - daysAfterFriday,
    },
  };
}
