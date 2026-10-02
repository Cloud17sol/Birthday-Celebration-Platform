import {
  comparePendingSubmissions,
  formatSubmissionBirthday,
  formatSubmittedAt,
  parseReviewDecision,
  parseReviewResult,
  pendingRegistrationSummary,
  registrationReviewMessages,
  registrationReviewNotice,
  reviewRedirect,
  submissionStatusLabel,
} from "../lib/registration-review";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  formatSubmissionBirthday(3, 14, null) === "14 March",
  "birthday without a year"
);
assert(
  formatSubmissionBirthday(3, 14, 1995) === "14 March 1995",
  "birthday with a year"
);
assert(formatSubmissionBirthday(13, 1, null) === null, "invalid month is hidden");
assert(
  formatSubmittedAt("2026-10-01T21:05:00.000Z") === "1 October 2026, 21:05 UTC",
  "submitted time uses UTC"
);

assert(
  pendingRegistrationSummary("member", 1, false).status === "hidden",
  "plain member summary stays hidden"
);
const ready = pendingRegistrationSummary("owner", 1, false);
assert(
  ready.status === "ready" && ready.label === "1 awaiting review",
  "one pending registration"
);
const many = pendingRegistrationSummary("admin", 2, false);
assert(
  many.status === "ready" && many.label === "2 awaiting review",
  "several pending registrations"
);
assert(
  pendingRegistrationSummary("owner", null, true).status === "error",
  "count failure is an error state"
);

const rows = [
  { createdAt: "2026-10-02T00:00:00.000Z", id: "b" },
  { createdAt: "2026-10-01T00:00:00.000Z", id: "z" },
  { createdAt: "2026-10-01T00:00:00.000Z", id: "a" },
];
rows.sort(comparePendingSubmissions);
assert(
  rows.map((row) => row.id).join(",") === "a,z,b",
  "oldest submissions come first, then id"
);

assert(parseReviewDecision("approve") === "approve", "approve is allowed");
assert(parseReviewDecision("reject") === "reject", "reject is allowed");
assert(parseReviewDecision("delete") === null, "other decisions are rejected");
assert(parseReviewDecision("APPROVE") === null, "decision must already be lowercase");

assert(submissionStatusLabel("pending") === "Pending", "pending label");
assert(submissionStatusLabel("approved") === "Approved", "approved label");
assert(submissionStatusLabel("rejected") === "Rejected", "rejected label");

const id = "11111111-1111-4111-8111-111111111111";
assert(
  reviewRedirect(id, { success: true, code: "approved" }) ===
    `/registrations/${id}?reviewed=approved`,
  "approval redirect has no personal details"
);
assert(
  reviewRedirect(id, { success: true, code: "rejected" }).includes("reviewed=rejected"),
  "rejection redirect"
);
assert(
  reviewRedirect(id, { success: false, code: "already_reviewed" }).includes(
    "reviewed=already"
  ),
  "already reviewed redirect"
);
assert(
  reviewRedirect(id, { success: false, code: "not_found" }) ===
    "/registrations?notice=missing",
  "missing registration stays on the queue"
);
assert(
  registrationReviewNotice("approved", undefined) ===
    registrationReviewMessages.approved,
  "approval notice"
);
assert(
  !registrationReviewMessages.approved.toLowerCase().includes("sql"),
  "approval notice hides database details"
);
assert(
  parseReviewResult({
    success: true,
    code: "approved",
    member_id: id,
  })?.memberId === id,
  "approval result parses"
);
assert(parseReviewResult({ success: false, code: "rejected" }) === null, "incomplete result is rejected");

console.log("registration review checks passed");
