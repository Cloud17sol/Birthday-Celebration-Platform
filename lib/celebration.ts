import { calendarMonthName } from "@/lib/birthday-calendar";

const duplicateCelebration = "This month's celebration is already active.";
const activateFailed = "Unable to activate celebration. Please try again.";

export function celebrationActivateError(code: string | undefined) {
  if (code === "23505") {
    return duplicateCelebration;
  }

  return activateFailed;
}

export function formatStoredCelebrationDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthName = calendarMonthName(month);

  if (!monthName || day < 1 || day > 31) {
    return null;
  }

  return `${day} ${monthName} ${year}`;
}

export function lastFridayLabel(day: number, monthName: string, year: number) {
  return `Friday, ${day} ${monthName} ${year}`;
}
