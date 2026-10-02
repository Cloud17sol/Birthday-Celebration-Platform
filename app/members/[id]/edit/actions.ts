"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MEMBER_PHOTO_BUCKET,
  MEMBER_PHOTO_STORED_CONTENT_TYPE,
  MEMBER_PHOTO_STORED_MAX_BYTES,
  isAllowedMemberPhotoSize,
  isMemberPhotoPath,
  memberPhotoExtension,
} from "@/lib/member-photo";
import { optimizeMemberPhoto } from "@/lib/member-photo-optimize";
import { isMemberId, validateMemberForm } from "@/app/members/new/validation";

function redirectWithMemberError(memberId: string, message: string): never {
  redirect(`/members/${memberId}/edit?error=${encodeURIComponent(message)}`);
}

export async function updateMember(memberId: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMemberId(memberId)) {
    notFound();
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];

  if (membershipError) {
    redirectWithMemberError(
      memberId,
      "Unable to update member. Please try again."
    );
  }

  if (!currentMembership) {
    redirect("/dashboard");
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirect("/members");
  }

  const draft = validateMemberForm(formData, new Date().getFullYear());

  if (!draft.ok) {
    redirectWithMemberError(memberId, draft.error);
  }

  const { data: updatedRows, error } = await supabase
    .from("members")
    .update({
      display_name: draft.value.displayName,
      first_name: draft.value.firstName,
      last_name: draft.value.lastName,
      birth_month: draft.value.birthMonth,
      birth_day: draft.value.birthDay,
      birth_year: draft.value.birthYear,
      email: draft.value.email,
      phone: draft.value.phone,
      notes: draft.value.notes,
    })
    .eq("id", memberId)
    .eq("organization_id", currentMembership.organization_id)
    .select("id");

  if (error) {
    redirectWithMemberError(
      memberId,
      "Unable to update member. Please try again."
    );
  }

  if (!updatedRows || updatedRows.length !== 1) {
    notFound();
  }

  redirect("/members");
}

const uploadPhotoError = "Unable to upload photo. Please try again.";
const removePhotoError = "Unable to remove photo. Please try again.";

function redirectToMemberPhoto(memberId: string, message?: string): never {
  const target = message
    ? `/members/${memberId}/edit?error=${encodeURIComponent(message)}`
    : `/members/${memberId}/edit`;

  redirect(target);
}

async function requireMemberPhotoAccess(memberId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMemberId(memberId)) {
    notFound();
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];

  if (membershipError || !currentMembership) {
    if (!currentMembership && !membershipError) {
      redirect("/dashboard");
    }

    return { ok: false as const, supabase };
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirect("/members");
  }

  return {
    ok: true as const,
    supabase,
    organizationId: currentMembership.organization_id,
  };
}

async function loadMemberPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberId: string,
  organizationId: string
) {
  return supabase
    .from("members")
    .select("id, photo_url")
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .maybeSingle();
}

async function removeStoredPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  objectPath: string
) {
  try {
    await supabase.storage.from(MEMBER_PHOTO_BUCKET).remove([objectPath]);
  } catch {
    // Cleanup failure must not change the member pointer or reach the user.
  }
}

function finishPhotoChange(memberId: string): never {
  revalidatePath("/members");
  revalidatePath(`/members/${memberId}/edit`);
  redirectToMemberPhoto(memberId);
}

export async function uploadMemberPhoto(memberId: string, formData: FormData) {
  const access = await requireMemberPhotoAccess(memberId);

  if (!access.ok) {
    redirectToMemberPhoto(memberId, uploadPhotoError);
  }

  const { data: member, error: memberError } = await loadMemberPhoto(
    access.supabase,
    memberId,
    access.organizationId
  );

  if (memberError) {
    redirectToMemberPhoto(memberId, uploadPhotoError);
  }

  if (!member) {
    notFound();
  }

  const photo = formData.get("photo");

  if (!(photo instanceof File) || photo.size === 0) {
    redirectToMemberPhoto(memberId, "Please choose a photo.");
  }

  if (!isAllowedMemberPhotoSize(photo.size)) {
    redirectToMemberPhoto(memberId, "Original photo must be 5 MB or smaller.");
  }

  if (!memberPhotoExtension(photo.type)) {
    redirectToMemberPhoto(memberId, "Use a JPEG, PNG, or WebP image.");
  }

  const optimized = await optimizeMemberPhoto(
    Buffer.from(await photo.arrayBuffer())
  );

  if (!optimized.ok) {
    redirectToMemberPhoto(
      memberId,
      optimized.reason === "too_large"
        ? "Unable to reduce this photo below 2 MB. Please choose another image."
        : "Unable to process this photo. Please choose another image."
    );
  }

  if (optimized.data.length >= MEMBER_PHOTO_STORED_MAX_BYTES) {
    redirectToMemberPhoto(
      memberId,
      "Unable to reduce this photo below 2 MB. Please choose another image."
    );
  }

  const objectPath = `${access.organizationId}/${memberId}/avatar-${crypto.randomUUID()}.webp`;
  let uploadFailed = false;

  try {
    const { error: uploadError } = await access.supabase.storage
      .from(MEMBER_PHOTO_BUCKET)
      .upload(objectPath, optimized.data, {
        contentType: MEMBER_PHOTO_STORED_CONTENT_TYPE,
        upsert: false,
      });
    uploadFailed = Boolean(uploadError);
  } catch {
    uploadFailed = true;
  }

  if (uploadFailed) {
    redirectToMemberPhoto(memberId, uploadPhotoError);
  }

  const { data: updatedRows, error: updateError } = await access.supabase
    .from("members")
    .update({ photo_url: objectPath })
    .eq("id", memberId)
    .eq("organization_id", access.organizationId)
    .select("id");

  if (updateError || !updatedRows || updatedRows.length !== 1) {
    await removeStoredPhoto(access.supabase, objectPath);

    if (!updateError && (!updatedRows || updatedRows.length !== 1)) {
      notFound();
    }

    redirectToMemberPhoto(memberId, uploadPhotoError);
  }

  if (isMemberPhotoPath(member.photo_url, access.organizationId, memberId)) {
    await removeStoredPhoto(access.supabase, member.photo_url);
  }

  finishPhotoChange(memberId);
}

export async function removeMemberPhoto(memberId: string) {
  const access = await requireMemberPhotoAccess(memberId);

  if (!access.ok) {
    redirectToMemberPhoto(memberId, removePhotoError);
  }

  const { data: member, error: memberError } = await loadMemberPhoto(
    access.supabase,
    memberId,
    access.organizationId
  );

  if (memberError) {
    redirectToMemberPhoto(memberId, removePhotoError);
  }

  if (!member) {
    notFound();
  }

  if (!member.photo_url) {
    finishPhotoChange(memberId);
  }

  const canDeleteStoredObject = isMemberPhotoPath(
    member.photo_url,
    access.organizationId,
    memberId
  );

  const { data: updatedRows, error: updateError } = await access.supabase
    .from("members")
    .update({ photo_url: null })
    .eq("id", memberId)
    .eq("organization_id", access.organizationId)
    .select("id");

  if (updateError || !updatedRows || updatedRows.length !== 1) {
    if (!updateError && (!updatedRows || updatedRows.length !== 1)) {
      notFound();
    }

    redirectToMemberPhoto(memberId, removePhotoError);
  }

  if (canDeleteStoredObject) {
    await removeStoredPhoto(access.supabase, member.photo_url);
  }

  finishPhotoChange(memberId);
}
