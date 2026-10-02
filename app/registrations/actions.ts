"use server";

import { redirect } from "next/navigation";
import {
  MEMBER_PHOTO_BUCKET,
  MEMBER_PHOTO_STORED_CONTENT_TYPE,
} from "@/lib/member-photo";
import { isRegistrationManager } from "@/lib/registration-link";
import { isRegistrationPhotoPath } from "@/lib/registration-photo";
import {
  isSubmissionId,
  parseReviewDecision,
  parseReviewResult,
  reviewRedirect,
} from "@/lib/registration-review";
import { createClient } from "@/lib/supabase/server";

async function removeRegistrationPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  objectPath: string
) {
  try {
    await supabase.storage.from(MEMBER_PHOTO_BUCKET).remove([objectPath]);
  } catch {
    // A leftover private object can be removed later. The review still stands.
  }
}

async function copyRegistrationPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  submissionId: string,
  memberId: string
) {
  const { data: submission, error } = await supabase
    .from("member_submissions")
    .select("photo_path")
    .eq("id", submissionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !isRegistrationPhotoPath(submission?.photo_path, organizationId, submissionId)) {
    return;
  }

  const photoPath = submission.photo_path;
  let downloaded: Blob | null = null;

  try {
    const result = await supabase.storage.from(MEMBER_PHOTO_BUCKET).download(photoPath);
    downloaded = result.error ? null : result.data;
  } catch {
    downloaded = null;
  }

  if (!downloaded) {
    return;
  }

  const objectPath = `${organizationId}/${memberId}/avatar-${crypto.randomUUID()}.webp`;
  let uploaded = false;

  try {
    const { error: uploadError } = await supabase.storage
      .from(MEMBER_PHOTO_BUCKET)
      .upload(objectPath, downloaded, {
        contentType: MEMBER_PHOTO_STORED_CONTENT_TYPE,
        upsert: false,
      });
    uploaded = !uploadError;
  } catch {
    uploaded = false;
  }

  if (!uploaded) {
    return;
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("members")
    .update({ photo_url: objectPath })
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .select("id");

  if (updateError || !updatedRows || updatedRows.length !== 1) {
    await removeRegistrationPhoto(supabase, objectPath);
    return;
  }

  await removeRegistrationPhoto(supabase, photoPath);
}

export async function reviewRegistration(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const submissionIdValue = formData.get("submission_id");
  const submissionId =
    typeof submissionIdValue === "string" ? submissionIdValue : "";
  const decision = parseReviewDecision(formData.get("decision"));

  if (!isSubmissionId(submissionId) || !decision) {
    redirect("/registrations?notice=failed");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];

  if (membershipError || !currentMembership) {
    redirect("/dashboard");
  }

  if (!isRegistrationManager(currentMembership.role)) {
    redirect("/dashboard");
  }

  const { data: ownedSubmission, error: ownedError } = await supabase
    .from("member_submissions")
    .select("id")
    .eq("id", submissionId)
    .eq("organization_id", currentMembership.organization_id)
    .maybeSingle();

  if (ownedError || !ownedSubmission) {
    redirect("/registrations?notice=missing");
  }

  let reviewResult: ReturnType<typeof parseReviewResult> = null;

  try {
    const { data, error } = await supabase.rpc("review_member_submission", {
      submission_id: submissionId,
      decision,
    });

    if (!error) {
      reviewResult = parseReviewResult(data);
    }
  } catch {
    reviewResult = null;
  }

  if (reviewResult?.success && reviewResult.code === "approved" && reviewResult.memberId) {
    await copyRegistrationPhoto(
      supabase,
      currentMembership.organization_id,
      submissionId,
      reviewResult.memberId
    );
  }

  if (reviewResult?.success && reviewResult.code === "rejected") {
    const { data: submission } = await supabase
      .from("member_submissions")
      .select("photo_path")
      .eq("id", submissionId)
      .eq("organization_id", currentMembership.organization_id)
      .maybeSingle();

    if (isRegistrationPhotoPath(submission?.photo_path, currentMembership.organization_id, submissionId)) {
      await removeRegistrationPhoto(supabase, submission.photo_path);
    }
  }

  redirect(reviewRedirect(submissionId, reviewResult));
}
