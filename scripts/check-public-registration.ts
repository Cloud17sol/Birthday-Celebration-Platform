import {
  isHoneypotFilled,
  isPublicRegistrationToken,
  parsePublicSubmission,
  publicJoinView,
  publicRegistrationMessages,
  publicSubmissionOutcome,
  validatePublicRegistration,
} from "../lib/public-registration";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const currentYear = 2026;
const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

const valid = {
  firstName: "Ada",
  lastName: "Lovelace",
  birthMonth: "2",
  birthDay: "29",
  birthYear: "",
  email: "ada@example.test",
  phone: "",
};

assert(isPublicRegistrationToken(token), "43-character token is accepted");
assert(!isPublicRegistrationToken("short"), "malformed token is rejected");
assert(!isPublicRegistrationToken(`${token}x`), "long token is rejected");
assert(isHoneypotFilled("http://spam.test"), "honeypot text is filled");
assert(isHoneypotFilled(" "), "honeypot whitespace is filled");
assert(!isHoneypotFilled(""), "blank honeypot is empty");

const leapBlank = validatePublicRegistration(valid, currentYear);
assert(leapBlank.ok, "February 29 is allowed when the year is blank");

const leapYear = validatePublicRegistration(
  { ...valid, birthYear: "2024" },
  currentYear
);
assert(leapYear.ok, "February 29 is allowed in a leap year");

const nonLeap = validatePublicRegistration(
  { ...valid, birthYear: "2023" },
  currentYear
);
assert(!nonLeap.ok, "February 29 is rejected in a non-leap year");
assert(
  !nonLeap.ok && nonLeap.error === publicRegistrationMessages.birthday,
  "invalid birthday uses the public message"
);

assert(
  validatePublicRegistration({ ...valid, firstName: "  " }, currentYear).ok ===
    false,
  "blank first name fails"
);
assert(
  validatePublicRegistration({ ...valid, lastName: "" }, currentYear).ok ===
    false,
  "blank last name fails"
);

const noContact = validatePublicRegistration(
  { ...valid, email: "  ", phone: "" },
  currentYear
);
assert(
  !noContact.ok && noContact.error === publicRegistrationMessages.contact,
  "email or phone is required"
);

const phoneOnly = validatePublicRegistration(
  { ...valid, email: "", phone: "555-0100" },
  currentYear
);
assert(phoneOnly.ok && phoneOnly.value.email === null, "phone alone is enough");
assert(
  phoneOnly.ok && phoneOnly.value.birthYear === null,
  "blank birth year stays null"
);

assert(
  validatePublicRegistration(
    { ...valid, email: "not-an-email" },
    currentYear
  ).ok === false,
  "email shape is rejected"
);
assert(
  validatePublicRegistration({ ...valid, birthYear: "1899" }, currentYear)
    .ok === false,
  "year before 1900 is rejected"
);
assert(
  validatePublicRegistration({ ...valid, birthYear: "2027" }, currentYear)
    .ok === false,
  "future year is rejected"
);

assert(
  publicJoinView({ organizationName: null, submitted: false }).status ===
    "unavailable",
  "missing name is unavailable"
);
assert(
  publicJoinView({ organizationName: null, submitted: true }).status ===
    "unavailable",
  "a success flag cannot reveal an unresolved link"
);
assert(
  publicJoinView({ organizationName: "Qubraz", submitted: false }).status ===
    "form",
  "resolved link shows the form"
);

const success = publicJoinView({
  organizationName: "Qubraz",
  submitted: true,
});
assert(success.status === "success", "submitted flag shows confirmation");
assert(
  success.status === "success" && success.organizationName === "Qubraz",
  "confirmation keeps the organization name"
);

assert(
  publicSubmissionOutcome({ success: true, code: "submitted" }).status ===
    "submitted",
  "submitted code"
);
assert(
  publicSubmissionOutcome({ success: false, code: "duplicate" }).status ===
    "message" &&
    publicSubmissionOutcome({ success: false, code: "duplicate" }).status ===
      "message",
  "duplicate stays a message"
);

const duplicate = publicSubmissionOutcome({ success: false, code: "duplicate" });
assert(
  duplicate.status === "message" &&
    duplicate.message === publicRegistrationMessages.duplicate &&
    !duplicate.message.toLowerCase().includes("email") &&
    !duplicate.message.toLowerCase().includes("phone"),
  "duplicate message hides the matched field"
);
assert(
  publicSubmissionOutcome({ success: false, code: "rate_limited" }).status ===
    "message",
  "rate limit code"
);
assert(
  publicSubmissionOutcome({ success: false, code: "invalid_link" }).status ===
    "message",
  "invalid link code"
);
assert(parsePublicSubmission("nope") === null, "string rpc payload is rejected");
assert(
  parsePublicSubmission({ success: true, code: "submitted" })?.code ===
    "submitted",
  "object rpc payload parses"
);

console.log("public registration checks passed");
