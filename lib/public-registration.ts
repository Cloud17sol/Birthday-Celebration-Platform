import { validateMemberInput } from "@/app/members/new/validation";

const registrationTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export const publicRegistrationMessages = {
  firstName: "Please enter your first name.",
  lastName: "Please enter your last name.",
  firstNameLength: "Please enter a first name of 100 characters or fewer.",
  lastNameLength: "Please enter a last name of 100 characters or fewer.",
  nameLength: "Please use a shorter first and last name.",
  birthday: "Please select a valid birthday.",
  email: "Please enter a valid email address.",
  phone: "Please enter a phone number of 50 characters or fewer.",
  contact: "Please provide an email address or phone number.",
  unavailable: "This registration link is unavailable.",
  invalidInput:
    "There is a problem with the information you entered. Please check your details and try again.",
  duplicate:
    "A registration for these details has already been submitted to this organization.",
  rateLimited:
    "Too many registrations have been submitted recently. Please try again later.",
  unexpected: "We couldn't submit your registration right now. Please try again.",
} as const;

export type PublicRegistrationValues = {
  firstName: string;
  lastName: string;
  birthMonth: string;
  birthDay: string;
  birthYear: string;
  email: string;
  phone: string;
};

export type PublicRegistrationDraft = {
  firstName: string;
  lastName: string;
  birthMonth: number;
  birthDay: number;
  birthYear: number | null;
  email: string | null;
  phone: string | null;
};

export type PublicRegistrationFormState = {
  revision: number;
  error: string | null;
  values: PublicRegistrationValues;
};

export const initialPublicRegistrationFormState: PublicRegistrationFormState = {
  revision: 0,
  error: null,
  values: {
    firstName: "",
    lastName: "",
    birthMonth: "",
    birthDay: "",
    birthYear: "",
    email: "",
    phone: "",
  },
};

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function clip(value: string, maxLength: number) {
  return value.slice(0, maxLength);
}

export function isPublicRegistrationToken(value: string) {
  return registrationTokenPattern.test(value);
}

export function isHoneypotFilled(value: string) {
  return value.length > 0;
}

export function readPublicRegistrationValues(
  formData: FormData
): PublicRegistrationValues {
  return {
    firstName: clip(readText(formData, "first_name"), 100),
    lastName: clip(readText(formData, "last_name"), 100),
    birthMonth: clip(readText(formData, "birth_month"), 2),
    birthDay: clip(readText(formData, "birth_day"), 2),
    birthYear: clip(readText(formData, "birth_year"), 4),
    email: clip(readText(formData, "email"), 254),
    phone: clip(readText(formData, "phone"), 50),
  };
}

function publicFieldMessage(error: string) {
  if (error === "First name is required.") {
    return publicRegistrationMessages.firstName;
  }

  if (error === "First name must be 100 characters or fewer.") {
    return publicRegistrationMessages.firstNameLength;
  }

  if (error === "Last name is required.") {
    return publicRegistrationMessages.lastName;
  }

  if (error === "Last name must be 100 characters or fewer.") {
    return publicRegistrationMessages.lastNameLength;
  }

  if (
    error === "First and last name combination is too long." ||
    error === "Display name must be 200 characters or fewer."
  ) {
    return publicRegistrationMessages.nameLength;
  }

  if (error === "Enter a valid email address.") {
    return publicRegistrationMessages.email;
  }

  if (error === "Phone must be 50 characters or fewer.") {
    return publicRegistrationMessages.phone;
  }

  if (
    error === "Select a valid birth month." ||
    error === "Enter a valid birthday." ||
    error === "Birth year cannot be in the future." ||
    error === "Enter a birth year from 1900 through the current year."
  ) {
    return publicRegistrationMessages.birthday;
  }

  return publicRegistrationMessages.invalidInput;
}

export function validatePublicRegistration(
  input: PublicRegistrationValues,
  currentYear: number
) {
  const draft = validateMemberInput(
    {
      displayName: "",
      firstName: input.firstName,
      lastName: input.lastName,
      birthMonth: input.birthMonth,
      birthDay: input.birthDay,
      birthYear: input.birthYear,
      email: input.email,
      phone: input.phone,
      notes: "",
    },
    currentYear
  );

  if (!draft.ok) {
    return { ok: false as const, error: publicFieldMessage(draft.error) };
  }

  if (!draft.value.email && !draft.value.phone) {
    return { ok: false as const, error: publicRegistrationMessages.contact };
  }

  return {
    ok: true as const,
    value: {
      firstName: draft.value.firstName,
      lastName: draft.value.lastName,
      birthMonth: draft.value.birthMonth,
      birthDay: draft.value.birthDay,
      birthYear: draft.value.birthYear,
      email: draft.value.email,
      phone: draft.value.phone,
    } satisfies PublicRegistrationDraft,
  };
}

function submissionUuid(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}

export function parsePublicSubmission(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  if (!("success" in data) || !("code" in data)) {
    return null;
  }

  if (typeof data.success !== "boolean" || typeof data.code !== "string") {
    return null;
  }

  return {
    success: data.success,
    code: data.code,
    submissionId:
      "submission_id" in data ? submissionUuid(data.submission_id) : null,
    organizationId:
      "organization_id" in data ? submissionUuid(data.organization_id) : null,
  };
}

export function publicSubmissionOutcome(
  result: { success: boolean; code: string } | null
) {
  if (!result || (result.success && result.code !== "submitted")) {
    return {
      status: "message" as const,
      message: publicRegistrationMessages.unexpected,
    };
  }

  if (result.success && result.code === "submitted") {
    return { status: "submitted" as const };
  }

  if (result.code === "invalid_link") {
    return {
      status: "message" as const,
      message: publicRegistrationMessages.unavailable,
    };
  }

  if (result.code === "invalid_input") {
    return {
      status: "message" as const,
      message: publicRegistrationMessages.invalidInput,
    };
  }

  if (result.code === "duplicate") {
    return {
      status: "message" as const,
      message: publicRegistrationMessages.duplicate,
    };
  }

  if (result.code === "rate_limited") {
    return {
      status: "message" as const,
      message: publicRegistrationMessages.rateLimited,
    };
  }

  return {
    status: "message" as const,
    message: publicRegistrationMessages.unexpected,
  };
}

export function publicJoinView(input: {
  organizationName: string | null;
  submitted: boolean;
}) {
  if (!input.organizationName) {
    return { status: "unavailable" as const };
  }

  if (input.submitted) {
    return {
      status: "success" as const,
      organizationName: input.organizationName,
    };
  }

  return {
    status: "form" as const,
    organizationName: input.organizationName,
  };
}
