"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MEMBER_PHOTO_STORED_CONTENT_TYPE,
  MEMBER_PHOTO_STORED_MAX_BYTES,
  isAllowedMemberPhotoSize,
  memberPhotoExtension,
} from "@/lib/member-photo";
import { optimizeMemberPhoto } from "@/lib/member-photo-optimize";
import {
  ORGANIZATION_LOGO_BUCKET,
  isOrganizationLogoPath,
  organizationLogoObjectPath,
} from "@/lib/organization-logo";

const organizationSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function redirectWithOrganizationError(message: string): never {
  redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}

function redirectWithOrganizationEditError(message: string): never {
  redirect(`/dashboard/organization?error=${encodeURIComponent(message)}`);
}

export async function logout() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/login");
}

export async function createOrganization(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const rawName = formData.get("organization_name");
  const rawSlug = formData.get("organization_slug");
  const organizationName = typeof rawName === "string" ? rawName.trim() : "";
  const organizationSlug =
    typeof rawSlug === "string" ? rawSlug.trim().toLowerCase() : "";

  if (!organizationName) {
    redirectWithOrganizationError("Organization name is required.");
  }

  if (organizationName.length > 80) {
    redirectWithOrganizationError(
      "Organization name must be 80 characters or fewer."
    );
  }

  if (!organizationSlug) {
    redirectWithOrganizationError("Organization slug is required.");
  }

  if (
    organizationSlug.length > 63 ||
    !organizationSlugPattern.test(organizationSlug)
  ) {
    redirectWithOrganizationError(
      "Use a lowercase slug with letters, numbers, and single hyphens."
    );
  }

  const { count, error: membershipError } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (membershipError) {
    redirectWithOrganizationError(
      "Unable to create the organization. Please try again."
    );
  }

  if ((count ?? 0) > 0) {
    redirectWithOrganizationError("You already belong to an organization.");
  }

  const { error } = await supabase.rpc("create_organization", {
    organization_name: organizationName,
    organization_slug: organizationSlug,
  });

  if (error) {
    if (
      error.code === "23505" ||
      error.message.includes("organizations_slug_key")
    ) {
      redirectWithOrganizationError("That organization slug is already in use.");
    }

    redirectWithOrganizationError(
      "Unable to create the organization. Please try again."
    );
  }

  redirect("/dashboard");
}

export async function updateOrganization(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const rawName = formData.get("organization_name");
  const rawSlug = formData.get("organization_slug");
  const organizationName = typeof rawName === "string" ? rawName.trim() : "";
  const organizationSlug =
    typeof rawSlug === "string" ? rawSlug.trim().toLowerCase() : "";

  if (!organizationName) {
    redirectWithOrganizationEditError("Organization name is required.");
  }

  if (organizationName.length > 80) {
    redirectWithOrganizationEditError(
      "Organization name must be 80 characters or fewer."
    );
  }

  if (!organizationSlug) {
    redirectWithOrganizationEditError("Organization slug is required.");
  }

  if (
    organizationSlug.length > 63 ||
    !organizationSlugPattern.test(organizationSlug)
  ) {
    redirectWithOrganizationEditError(
      "Use a lowercase slug with letters, numbers, and single hyphens."
    );
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);

  const currentMembership = memberships?.[0];

  if (membershipError || !currentMembership) {
    redirectWithOrganizationEditError(
      "Unable to save the organization. Please try again."
    );
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirect("/dashboard");
  }

  const { data: updatedRows, error } = await supabase
    .from("organizations")
    .update({
      name: organizationName,
      slug: organizationSlug,
    })
    .eq("id", currentMembership.organization_id)
    .select("id");

  if (error) {
    if (
      error.code === "23505" ||
      error.message.includes("organizations_slug_key")
    ) {
      redirectWithOrganizationEditError("That organization slug is already in use.");
    }

    redirectWithOrganizationEditError(
      "Unable to save the organization. Please try again."
    );
  }

  if (!updatedRows || updatedRows.length !== 1) {
    redirectWithOrganizationEditError(
      "Unable to save the organization. Please try again."
    );
  }

  redirect("/dashboard");
}

async function requireOrganizationLogoEditor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);

  const currentMembership = memberships?.[0];

  if (membershipError || !currentMembership) {
    redirectWithOrganizationEditError(
      "Unable to save the registration logo. Please try again."
    );
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirect("/dashboard");
  }

  return { supabase, organizationId: currentMembership.organization_id };
}

export async function uploadOrganizationLogo(formData: FormData) {
  const { supabase, organizationId } = await requireOrganizationLogoEditor();
  const photo = formData.get("logo");

  if (!(photo instanceof File) || photo.size === 0) {
    redirectWithOrganizationEditError("Please choose a logo.");
  }

  if (!isAllowedMemberPhotoSize(photo.size)) {
    redirectWithOrganizationEditError("Logo must be 5 MB or smaller.");
  }

  if (!memberPhotoExtension(photo.type)) {
    redirectWithOrganizationEditError("Use a JPEG, PNG, or WebP image.");
  }

  const optimized = await optimizeMemberPhoto(Buffer.from(await photo.arrayBuffer()));

  if (!optimized.ok || optimized.data.length >= MEMBER_PHOTO_STORED_MAX_BYTES) {
    redirectWithOrganizationEditError(
      optimized.ok
        ? "Unable to reduce this logo below 2 MB. Please choose another image."
        : "Unable to process this logo. Please choose another image."
    );
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("logo_path")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError || !organization) {
    redirectWithOrganizationEditError(
      "Unable to save the registration logo. Please try again."
    );
  }

  const objectPath = organizationLogoObjectPath();
  const { error: uploadError } = await supabase.storage
    .from(ORGANIZATION_LOGO_BUCKET)
    .upload(objectPath, optimized.data, {
      contentType: MEMBER_PHOTO_STORED_CONTENT_TYPE,
      upsert: false,
    });

  if (uploadError) {
    redirectWithOrganizationEditError(
      "Unable to save the registration logo. Please try again."
    );
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("organizations")
    .update({ logo_path: objectPath })
    .eq("id", organizationId)
    .select("id");

  if (updateError || !updatedRows || updatedRows.length !== 1) {
    await supabase.storage.from(ORGANIZATION_LOGO_BUCKET).remove([objectPath]);
    redirectWithOrganizationEditError(
      "Unable to save the registration logo. Please try again."
    );
  }

  if (
    isOrganizationLogoPath(organization.logo_path) &&
    organization.logo_path !== objectPath
  ) {
    await supabase.storage
      .from(ORGANIZATION_LOGO_BUCKET)
      .remove([organization.logo_path]);
  }

  redirect("/dashboard/organization");
}

export async function removeOrganizationLogo() {
  const { supabase, organizationId } = await requireOrganizationLogoEditor();
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("logo_path")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError || !organization) {
    redirectWithOrganizationEditError(
      "Unable to remove the registration logo. Please try again."
    );
  }

  if (!isOrganizationLogoPath(organization.logo_path)) {
    redirect("/dashboard/organization");
  }

  const { error: removeError } = await supabase.storage
    .from(ORGANIZATION_LOGO_BUCKET)
    .remove([organization.logo_path]);

  if (removeError) {
    redirectWithOrganizationEditError(
      "Unable to remove the registration logo. Please try again."
    );
  }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ logo_path: null })
    .eq("id", organizationId);

  if (updateError) {
    redirectWithOrganizationEditError(
      "Unable to remove the registration logo. Please try again."
    );
  }

  redirect("/dashboard/organization");
}
