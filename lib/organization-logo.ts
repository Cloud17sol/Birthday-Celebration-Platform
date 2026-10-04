export const ORGANIZATION_LOGO_BUCKET = "organization-logos";

const organizationLogoPathPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function isOrganizationLogoPath(
  logoPath: string | null | undefined
): logoPath is string {
  return typeof logoPath === "string" && organizationLogoPathPattern.test(logoPath);
}

export function organizationLogoObjectPath() {
  return `${crypto.randomUUID()}.webp`;
}
