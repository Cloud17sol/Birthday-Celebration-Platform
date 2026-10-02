export const monthNames = [
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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MemberDraft = {
  displayName: string;
  firstName: string;
  lastName: string;
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type MemberDraftResult =
  | { ok: true; value: MemberDraft }
  | { ok: false; error: string };

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalText(value: string, maxLength: number, tooLong: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true as const, value: null };
  }

  if (trimmed.length > maxLength) {
    return { ok: false as const, error: tooLong };
  }

  return { ok: true as const, value: trimmed };
}

function parseInteger(value: string) {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function maximumBirthDay(month: number, year: number | null) {
  if (month === 2) {
    if (year == null || isLeapYear(year)) {
      return 29;
    }

    return 28;
  }

  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }

  return 31;
}

export function validateMemberInput(
  input: {
    displayName: string;
    firstName: string;
    lastName: string;
    birthMonth: string;
    birthDay: string;
    birthYear: string;
    email: string;
    phone: string;
    notes: string;
  },
  currentYear: number
): MemberDraftResult {
  const firstName = input.firstName.trim();

  if (!firstName) {
    return { ok: false, error: "First name is required." };
  }

  if (firstName.length > 100) {
    return {
      ok: false,
      error: "First name must be 100 characters or fewer.",
    };
  }

  const lastName = input.lastName.trim();

  if (!lastName) {
    return { ok: false, error: "Last name is required." };
  }

  if (lastName.length > 100) {
    return {
      ok: false,
      error: "Last name must be 100 characters or fewer.",
    };
  }

  const suppliedDisplayName = input.displayName.trim();
  const displayName = suppliedDisplayName || `${firstName} ${lastName}`;

  if (displayName.length > 200) {
    return {
      ok: false,
      error: suppliedDisplayName
        ? "Display name must be 200 characters or fewer."
        : "First and last name combination is too long.",
    };
  }

  const email = optionalText(
    input.email,
    254,
    "Enter a valid email address."
  );

  if (!email.ok) {
    return email;
  }

  if (email.value && !emailPattern.test(email.value)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const phone = optionalText(
    input.phone,
    50,
    "Phone must be 50 characters or fewer."
  );

  if (!phone.ok) {
    return phone;
  }

  const notes = optionalText(
    input.notes,
    2000,
    "Notes must be 2000 characters or fewer."
  );

  if (!notes.ok) {
    return notes;
  }

  const birthMonth = parseInteger(input.birthMonth);

  if (birthMonth == null || birthMonth < 1 || birthMonth > 12) {
    return { ok: false, error: "Select a valid birth month." };
  }

  const birthDay = parseInteger(input.birthDay);

  if (birthDay == null) {
    return { ok: false, error: "Enter a valid birthday." };
  }

  const yearText = input.birthYear.trim();
  let birthYear: number | null = null;

  if (yearText) {
    birthYear = parseInteger(yearText);

    if (birthYear == null) {
      return { ok: false, error: "Enter a valid birthday." };
    }

    if (birthYear > currentYear) {
      return { ok: false, error: "Birth year cannot be in the future." };
    }

    if (birthYear < 1900) {
      return {
        ok: false,
        error: "Enter a birth year from 1900 through the current year.",
      };
    }
  }

  if (birthDay < 1 || birthDay > maximumBirthDay(birthMonth, birthYear)) {
    return { ok: false, error: "Enter a valid birthday." };
  }

  return {
    ok: true,
    value: {
      displayName,
      firstName,
      lastName,
      birthMonth,
      birthDay,
      birthYear,
      email: email.value,
      phone: phone.value,
      notes: notes.value,
    },
  };
}

const memberIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMemberId(value: string) {
  return memberIdPattern.test(value);
}

export function displayNameInputValue(
  firstName: string | null,
  lastName: string | null,
  displayName: string
) {
  if (firstName && lastName && displayName === `${firstName} ${lastName}`) {
    return "";
  }

  return displayName;
}

export function validateMemberForm(
  formData: FormData,
  currentYear: number
): MemberDraftResult {
  return validateMemberInput(
    {
      displayName: readText(formData, "display_name"),
      firstName: readText(formData, "first_name"),
      lastName: readText(formData, "last_name"),
      birthMonth: readText(formData, "birth_month"),
      birthDay: readText(formData, "birth_day"),
      birthYear: readText(formData, "birth_year"),
      email: readText(formData, "email"),
      phone: readText(formData, "phone"),
      notes: readText(formData, "notes"),
    },
    currentYear
  );
}
