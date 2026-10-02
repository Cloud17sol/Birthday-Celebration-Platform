"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
