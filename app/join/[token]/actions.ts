"use server";

import { redirect } from "next/navigation";
import {
  MEMBER_PHOTO_BUCKET,
  MEMBER_PHOTO_STORED_CONTENT_TYPE,
  MEMBER_PHOTO_STORED_MAX_BYTES,
  isAllowedMemberPhotoSize,
  memberPhotoExtension,
} from "@/lib/member-photo";
import { optimizeMemberPhoto } from "@/lib/member-photo-optimize";
import {
  initialPublicRegistrationFormState,
  isHoneypotFilled,
  isPublicRegistrationToken,
  parsePublicSubmission,
  publicRegistrationMessages,
  publicSubmissionOutcome,
  readPublicRegistrationValues,
  validatePublicRegistration,
  type PublicRegistrationFormState,
} from "@/lib/public-registration";
import {
  isRegistrationPhotoPath,
  registrationPhotoPath,
} from "@/lib/registration-photo";
import { createClient } from "@/lib/supabase/server";

const photoTypeError = "Use a JPEG, PNG, or WebP image up to 5 MB.";
const photoProcessError =
  "Unable to process this photo. Please choose another image.";

function nextState(
  previous: PublicRegistrationFormState,
  error: string,
  values: PublicRegistrationFormState["values"]
): PublicRegistrationFormState {
  return {
    revision: previous.revision + 1,
    error,
    values,
  };
}

async function attachRegistrationPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string | null,
  submissionId: string | null,
  photo: Buffer
) {
  if (!organizationId || !submissionId) {
    return false;
  }

  const objectPath = registrationPhotoPath(organizationId, submissionId);

  if (!isRegistrationPhotoPath(objectPath, organizationId, submissionId)) {
    return false;
  }

  try {
    const { error: uploadError } = await supabase.storage
      .from(MEMBER_PHOTO_BUCKET)
      .upload(objectPath, photo, {
        contentType: MEMBER_PHOTO_STORED_CONTENT_TYPE,
        upsert: false,
      });

    if (uploadError) {
      return false;
    }

    const { data: attached, error: attachError } = await supabase.rpc(
      "attach_registration_photo",
      {
        target_submission_id: submissionId,
        object_path: objectPath,
      }
    );

    if (attachError || attached !== true) {
      await supabase.storage.from(MEMBER_PHOTO_BUCKET).remove([objectPath]);
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

export async function submitPublicRegistration(
  token: string,
  previous: PublicRegistrationFormState = initialPublicRegistrationFormState,
  formData: FormData
): Promise<PublicRegistrationFormState> {
  const values = readPublicRegistrationValues(formData);

  if (!isPublicRegistrationToken(token)) {
    return nextState(previous, publicRegistrationMessages.unavailable, values);
  }

  const website = formData.get("website");
  const honeypot = typeof website === "string" ? website : "";

  if (isHoneypotFilled(honeypot)) {
    redirect(`/join/${token}?submitted=1`);
  }

  const draft = validatePublicRegistration(values, new Date().getFullYear());

  if (!draft.ok) {
    return nextState(previous, draft.error, values);
  }

  const photo = formData.get("photo");
  const photoFile = photo instanceof File && photo.size > 0 ? photo : null;
  let optimizedPhoto: Buffer | null = null;

  if (photoFile) {
    if (
      !isAllowedMemberPhotoSize(photoFile.size) ||
      !memberPhotoExtension(photoFile.type)
    ) {
      return nextState(previous, photoTypeError, values);
    }

    const optimized = await optimizeMemberPhoto(
      Buffer.from(await photoFile.arrayBuffer())
    );

    if (!optimized.ok || optimized.data.length >= MEMBER_PHOTO_STORED_MAX_BYTES) {
      return nextState(previous, photoProcessError, values);
    }

    optimizedPhoto = optimized.data;
  }

  const supabase = await createClient();
  let submission: unknown = null;
  let failed = false;

  try {
    const { data, error } = await supabase.rpc("submit_member_registration", {
      registration_token: token,
      first_name: draft.value.firstName,
      last_name: draft.value.lastName,
      birth_month: draft.value.birthMonth,
      birth_day: draft.value.birthDay,
      // Generated Args omit null. SQL accepts null for an unknown year and
      // for a contact field the visitor left blank.
      birth_year: draft.value.birthYear as number,
      email: draft.value.email as string,
      phone: draft.value.phone as string,
    });

    if (error) {
      failed = true;
    } else {
      submission = data;
    }
  } catch {
    failed = true;
  }

  if (failed) {
    return nextState(previous, publicRegistrationMessages.unexpected, values);
  }

  const parsedSubmission = parsePublicSubmission(submission);
  const outcome = publicSubmissionOutcome(parsedSubmission);

  if (outcome.status === "submitted") {
    if (!optimizedPhoto) {
      redirect(`/join/${token}?submitted=1`);
    }

    const photoSaved = await attachRegistrationPhoto(
      supabase,
      parsedSubmission?.organizationId ?? null,
      parsedSubmission?.submissionId ?? null,
      optimizedPhoto
    );

    redirect(
      photoSaved
        ? `/join/${token}?submitted=1`
        : `/join/${token}?submitted=1&photo=failed`
    );
  }

  return nextState(previous, outcome.message, values);
}
