"use server";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isOrganizationCatalogId,
  organizationCatalogSaveError,
  validateOrganizationCatalogName,
} from "@/lib/organization-catalog";

const statusError = "Unable to update group. Please try again.";

function redirectToNewGroup(message: string): never {
  redirect(`/groups/new?error=${encodeURIComponent(message)}`);
}

function redirectToEditGroup(groupId: string, message: string): never {
  redirect(`/groups/${groupId}/edit?error=${encodeURIComponent(message)}`);
}

function redirectToGroups(message?: string): never {
  if (!message) {
    redirect("/groups");
  }

  redirect(`/groups?error=${encodeURIComponent(message)}`);
}

async function requireGroupManager() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];

  if (membershipError) {
    return { ok: false as const, reason: "load" as const };
  }

  if (!currentMembership) {
    redirect("/dashboard");
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirect("/groups");
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    organizationId: currentMembership.organization_id,
  };
}

export async function createGroup(formData: FormData) {
  const access = await requireGroupManager();

  if (!access.ok) {
    redirectToNewGroup("Unable to save group. Please try again.");
  }

  const draft = validateOrganizationCatalogName(formData.get("name"), "group");

  if (!draft.ok) {
    redirectToNewGroup(draft.error);
  }

  const { error } = await access.supabase.from("groups").insert({
    organization_id: access.organizationId,
    name: draft.name,
    created_by: access.userId,
  });

  if (error) {
    redirectToNewGroup(organizationCatalogSaveError("group", error.code));
  }

  redirect("/groups");
}

export async function updateGroup(groupId: string, formData: FormData) {
  if (!isOrganizationCatalogId(groupId)) {
    notFound();
  }

  const access = await requireGroupManager();

  if (!access.ok) {
    redirectToEditGroup(groupId, "Unable to save group. Please try again.");
  }

  const draft = validateOrganizationCatalogName(formData.get("name"), "group");

  if (!draft.ok) {
    redirectToEditGroup(groupId, draft.error);
  }

  const { data: updatedRows, error } = await access.supabase
    .from("groups")
    .update({ name: draft.name })
    .eq("id", groupId)
    .eq("organization_id", access.organizationId)
    .select("id");

  if (error) {
    redirectToEditGroup(
      groupId,
      organizationCatalogSaveError("group", error.code)
    );
  }

  if (!updatedRows || updatedRows.length !== 1) {
    notFound();
  }

  redirect("/groups");
}

export async function setGroupActiveState(groupId: string, isActive: boolean) {
  if (!isOrganizationCatalogId(groupId) || typeof isActive !== "boolean") {
    redirectToGroups(statusError);
  }

  const access = await requireGroupManager();

  if (!access.ok) {
    redirectToGroups(statusError);
  }

  const { data: updatedRows, error } = await access.supabase
    .from("groups")
    .update({ is_active: isActive })
    .eq("id", groupId)
    .eq("organization_id", access.organizationId)
    .select("id");

  if (error || !updatedRows || updatedRows.length !== 1) {
    redirectToGroups(statusError);
  }

  redirect("/groups");
}
