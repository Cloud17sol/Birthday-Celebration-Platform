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

const minimumYear = 1;
const maximumYear = 9999;

export type CalendarMonth = {
  year: number;
  month: number;
};

function isCalendarMonth(year: number, month: number) {
  return (
    Number.isInteger(year) &&
    year >= minimumYear &&
    year <= maximumYear &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  );
}

export function calendarMonthName(month: number) {
  return monthNames[month - 1] ?? null;
}

export function calendarMonthFromQuery(
  yearValue: string | undefined,
  monthValue: string | undefined,
  today: CalendarMonth
): CalendarMonth {
  const fallback = { year: today.year, month: today.month };

  if (yearValue === undefined && monthValue === undefined) {
    return fallback;
  }

  if (yearValue === undefined || monthValue === undefined) {
    return fallback;
  }

  if (!/^[0-9]+$/.test(yearValue) || !/^[0-9]+$/.test(monthValue)) {
    return fallback;
  }

  const year = Number(yearValue);
  const month = Number(monthValue);

  if (!isCalendarMonth(year, month)) {
    return fallback;
  }

  return { year, month };
}

export function adjacentCalendarMonth(
  current: CalendarMonth,
  direction: "previous" | "next"
): CalendarMonth | null {
  if (direction === "previous") {
    if (current.month === 1) {
      if (current.year <= minimumYear) {
        return null;
      }

      return { year: current.year - 1, month: 12 };
    }

    return { year: current.year, month: current.month - 1 };
  }

  if (current.month === 12) {
    if (current.year >= maximumYear) {
      return null;
    }

    return { year: current.year + 1, month: 1 };
  }

  return { year: current.year, month: current.month + 1 };
}

export function birthdayCalendarPath(month: CalendarMonth) {
  return `/birthdays?year=${month.year}&month=${month.month}`;
}

export function celebrationPath(month: CalendarMonth) {
  return `/celebrations?year=${month.year}&month=${month.month}`;
}

// Unlike calendarMonthFromQuery, an invalid value is rejected instead of
// falling back to today. Activation must not write the current month by accident.
export function strictCalendarMonth(
  yearValue: string | undefined,
  monthValue: string | undefined
): CalendarMonth | null {
  if (yearValue === undefined || monthValue === undefined) {
    return null;
  }

  if (!/^[0-9]+$/.test(yearValue) || !/^[0-9]+$/.test(monthValue)) {
    return null;
  }

  const year = Number(yearValue);
  const month = Number(monthValue);

  if (!isCalendarMonth(year, month)) {
    return null;
  }

  return { year, month };
}
