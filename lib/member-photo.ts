export const MEMBER_PHOTO_BUCKET = "member-photos";

export const MEMBER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const MEMBER_PHOTO_STORED_MAX_BYTES = 2 * 1024 * 1024;

export const MEMBER_PHOTO_MAX_EDGE = 1200;

export const MEMBER_PHOTO_STORED_CONTENT_TYPE = "image/webp" as const;

export const MEMBER_PHOTO_SIGNED_URL_SECONDS = 1800;

const memberPhotoExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type MemberPhotoExtension =
  (typeof memberPhotoExtensions)[keyof typeof memberPhotoExtensions];

export function memberPhotoExtension(mimeType: string): MemberPhotoExtension | null {
  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/webp"
  ) {
    return memberPhotoExtensions[mimeType];
  }

  return null;
}

export function isAllowedMemberPhotoSize(size: number) {
  return Number.isFinite(size) && size > 0 && size <= MEMBER_PHOTO_MAX_BYTES;
}

export function isMemberPhotoPath(
  photoPath: string | null | undefined,
  organizationId: string,
  memberId: string
): photoPath is string {
  if (!photoPath || !organizationId || !memberId) {
    return false;
  }

  const prefix = `${organizationId}/${memberId}/`;

  if (!photoPath.startsWith(prefix)) {
    return false;
  }

  const fileName = photoPath.slice(prefix.length);

  if (
    !fileName ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("..") ||
    fileName === "." ||
    fileName === ".."
  ) {
    return false;
  }

  return true;
}

function firstCharacter(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  for (const character of Array.from(trimmed)) {
    if (/[\p{L}\p{N}]/u.test(character)) {
      return character.toLocaleUpperCase();
    }
  }

  return null;
}

export function memberInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  displayName: string | null | undefined
) {
  const firstInitial = firstCharacter(firstName);
  const lastInitial = firstCharacter(lastName);

  if (firstInitial && lastInitial) {
    return `${firstInitial}${lastInitial}`;
  }

  const displayInitials = (displayName ?? "")
    .trim()
    .split(/\s+/)
    .map((part) => firstCharacter(part))
    .filter((initial): initial is string => initial !== null)
    .slice(0, 2);

  if (displayInitials.length > 0) {
    return displayInitials.join("");
  }

  return "?";
}
