import { monthNames } from "@/app/members/new/validation";
import { isRegistrationManager } from "@/lib/registration-link";

const submissionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const registrationReviewMessages = {
  missing: "That registration could not be found.",
  unauthorized: "You cannot review this registration.",
  already: "This registration has already been reviewed.",
  failed: "We couldn't review this registration right now. Please try again.",
  approved:
    "This registration was approved. The person is now an active member.",
  rejected: "This registration was rejected. No member was added.",
} as const;

export type PendingRegistrationSummary =
  | { status: "hidden" }
  | { status: "error" }
  | { status: "ready"; count: number; label: string };

export function isSubmissionId(value: string) {
  return submissionIdPattern.test(value);
}

export function parseReviewDecision(value: unknown) {
  if (value === "approve" || value === "reject") {
    return value;
  }

  return null;
}

export function pendingRegistrationLabel(count: number) {
  if (count === 1) {
    return "1 awaiting review";
  }

  return `${count} awaiting review`;
}

export function pendingRegistrationSummary(
  role: string,
  count: number | null,
  failed: boolean
): PendingRegistrationSummary {
  if (!isRegistrationManager(role)) {
    return { status: "hidden" };
  }

  if (failed || count == null || !Number.isInteger(count) || count < 0) {
    return { status: "error" };
  }

  return {
    status: "ready",
    count,
    label: pendingRegistrationLabel(count),
  };
}

export function formatSubmissionBirthday(
  birthMonth: number,
  birthDay: number,
  birthYear: number | null
) {
  const monthName = monthNames[birthMonth - 1];

  if (!monthName || birthDay < 1 || birthDay > 31) {
    return null;
  }

  if (birthYear == null) {
    return `${birthDay} ${monthName}`;
  }

  return `${birthDay} ${monthName} ${birthYear}`;
}

export function formatSubmittedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const monthName = monthNames[date.getUTCMonth()];
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${date.getUTCDate()} ${monthName} ${date.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}

export function submissionStatusLabel(status: string) {
  if (status === "pending") {
    return "Pending";
  }

  if (status === "approved") {
    return "Approved";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Reviewed";
}

export function comparePendingSubmissions(
  left: { createdAt: string; id: string },
  right: { createdAt: string; id: string }
) {
  if (left.createdAt < right.createdAt) {
    return -1;
  }

  if (left.createdAt > right.createdAt) {
    return 1;
  }

  if (left.id < right.id) {
    return -1;
  }

  if (left.id > right.id) {
    return 1;
  }

  return 0;
}

export function parseReviewResult(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  if (!("success" in data) || !("code" in data) || !("member_id" in data)) {
    return null;
  }

  if (typeof data.success !== "boolean" || typeof data.code !== "string") {
    return null;
  }

  if (data.member_id !== null && typeof data.member_id !== "string") {
    return null;
  }

  return {
    success: data.success,
    code: data.code,
    memberId: data.member_id,
  };
}

export function reviewRedirect(
  submissionId: string,
  result: { success: boolean; code: string } | null
) {
  if (result?.success && result.code === "approved") {
    return `/registrations/${submissionId}?reviewed=approved`;
  }

  if (result?.success && result.code === "rejected") {
    return `/registrations/${submissionId}?reviewed=rejected`;
  }

  if (result?.code === "already_reviewed") {
    return `/registrations/${submissionId}?reviewed=already`;
  }

  if (result?.code === "not_found") {
    return "/registrations?notice=missing";
  }

  if (result?.code === "not_authorized") {
    return "/registrations?notice=unauthorized";
  }

  return `/registrations/${submissionId}?notice=failed`;
}

export function registrationQueueNotice(notice: string | undefined) {
  if (notice === "missing") {
    return registrationReviewMessages.missing;
  }

  if (notice === "unauthorized") {
    return registrationReviewMessages.unauthorized;
  }

  if (notice === "failed") {
    return registrationReviewMessages.failed;
  }

  return null;
}

export function registrationReviewNotice(
  reviewed: string | undefined,
  notice: string | undefined
) {
  if (reviewed === "approved") {
    return registrationReviewMessages.approved;
  }

  if (reviewed === "rejected") {
    return registrationReviewMessages.rejected;
  }

  if (reviewed === "already") {
    return registrationReviewMessages.already;
  }

  return registrationQueueNotice(notice);
}
