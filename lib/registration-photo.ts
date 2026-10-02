const registrationPhotoPattern =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/registrations\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/i;

export function registrationPhotoPath(organizationId: string, submissionId: string) {
  return `${organizationId}/registrations/${submissionId}.webp`;
}

export function isRegistrationPhotoPath(
  photoPath: string | null | undefined,
  organizationId: string,
  submissionId: string
): photoPath is string {
  if (!photoPath || !organizationId || !submissionId) {
    return false;
  }

  const match = registrationPhotoPattern.exec(photoPath);

  return (
    match?.[1]?.toLowerCase() === organizationId.toLowerCase() &&
    match[2]?.toLowerCase() === submissionId.toLowerCase()
  );
}
