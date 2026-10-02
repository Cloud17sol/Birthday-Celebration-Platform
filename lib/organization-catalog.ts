const organizationCatalogIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const organizationCatalogNameMaxLength = 80;

export type OrganizationCatalogKind = "department" | "group";

function catalogLabel(kind: OrganizationCatalogKind) {
  if (kind === "department") {
    return "Department";
  }

  return "Group";
}

export function isOrganizationCatalogId(value: string) {
  return organizationCatalogIdPattern.test(value);
}

export function validateOrganizationCatalogName(
  raw: unknown,
  kind: OrganizationCatalogKind
): { ok: true; name: string } | { ok: false; error: string } {
  const label = catalogLabel(kind);
  const name = typeof raw === "string" ? raw.trim() : "";

  if (!name) {
    return { ok: false, error: `${label} name is required.` };
  }

  if (name.length > organizationCatalogNameMaxLength) {
    return {
      ok: false,
      error: `${label} name must be ${organizationCatalogNameMaxLength} characters or fewer.`,
    };
  }

  return { ok: true, name };
}

export function organizationCatalogSaveError(
  kind: OrganizationCatalogKind,
  code: string | undefined
) {
  if (code === "23505") {
    return `A ${kind} with that name already exists.`;
  }

  return `Unable to save ${kind}. Please try again.`;
}
