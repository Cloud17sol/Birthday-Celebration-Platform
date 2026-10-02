import {
  isOrganizationCatalogId,
  organizationCatalogSaveError,
  validateOrganizationCatalogName,
} from "../lib/organization-catalog";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const departmentRequired = validateOrganizationCatalogName("   ", "department");
assert(!departmentRequired.ok, "blank department name fails");
if (!departmentRequired.ok) {
  assert(
    departmentRequired.error === "Department name is required.",
    "blank department message"
  );
}

const groupRequired = validateOrganizationCatalogName(undefined, "group");
assert(!groupRequired.ok, "missing group name fails");
if (!groupRequired.ok) {
  assert(groupRequired.error === "Group name is required.", "blank group message");
}

const trimmed = validateOrganizationCatalogName("  Finance  ", "department");
assert(trimmed.ok && trimmed.name === "Finance", "name is trimmed");

const maxName = "A".repeat(80);
const maxResult = validateOrganizationCatalogName(maxName, "group");
assert(maxResult.ok && maxResult.name === maxName, "80 characters is valid");

const tooLong = validateOrganizationCatalogName("B".repeat(81), "department");
assert(!tooLong.ok, "81 characters fails");
if (!tooLong.ok) {
  assert(
    tooLong.error === "Department name must be 80 characters or fewer.",
    "length message"
  );
}

assert(
  organizationCatalogSaveError("department", "23505") ===
    "A department with that name already exists.",
  "department duplicate message"
);
assert(
  organizationCatalogSaveError("group", "23505") ===
    "A group with that name already exists.",
  "group duplicate message"
);
assert(
  organizationCatalogSaveError(
    "department",
    "23505"
  ).includes("departments_organization_id_lower_name_idx") === false,
  "duplicate message hides the constraint"
);
assert(
  organizationCatalogSaveError("group", "XX000") ===
    "Unable to save group. Please try again.",
  "generic group save error"
);

assert(
  isOrganizationCatalogId("f860324b-9b34-4da1-83fc-b11ada4d951c"),
  "uuid is accepted"
);
assert(isOrganizationCatalogId("not-an-id") === false, "non-uuid is rejected");

console.log("organization catalog checks passed");
