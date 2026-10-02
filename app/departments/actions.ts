"use server";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isOrganizationCatalogId,
  organizationCatalogSaveError,
  validateOrganizationCatalogName,
} from "@/lib/organization-catalog";

const statusError = "Unable to update department. Please try again.";

function redirectToNewDepartment(message: string): never {
  redirect(`/departments/new?error=${encodeURIComponent(message)}`);
}

function redirectToEditDepartment(departmentId: string, message: string): never {
  redirect(
    `/departments/${departmentId}/edit?error=${encodeURIComponent(message)}`
  );
}

function redirectToDepartments(message?: string): never {
  if (!message) {
    redirect("/departments");
  }

  redirect(`/departments?error=${encodeURIComponent(message)}`);
}

async function requireDepartmentManager() {
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
    redirect("/departments");
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    organizationId: currentMembership.organization_id,
  };
}

export async function createDepartment(formData: FormData) {
  const access = await requireDepartmentManager();

  if (!access.ok) {
    redirectToNewDepartment("Unable to save department. Please try again.");
  }

  const draft = validateOrganizationCatalogName(
    formData.get("name"),
    "department"
  );

  if (!draft.ok) {
    redirectToNewDepartment(draft.error);
  }

  const { error } = await access.supabase.from("departments").insert({
    organization_id: access.organizationId,
    name: draft.name,
    created_by: access.userId,
  });

  if (error) {
    redirectToNewDepartment(organizationCatalogSaveError("department", error.code));
  }

  redirect("/departments");
}

export async function updateDepartment(departmentId: string, formData: FormData) {
  if (!isOrganizationCatalogId(departmentId)) {
    notFound();
  }

  const access = await requireDepartmentManager();

  if (!access.ok) {
    redirectToEditDepartment(
      departmentId,
      "Unable to save department. Please try again."
    );
  }

  const draft = validateOrganizationCatalogName(
    formData.get("name"),
    "department"
  );

  if (!draft.ok) {
    redirectToEditDepartment(departmentId, draft.error);
  }

  const { data: updatedRows, error } = await access.supabase
    .from("departments")
    .update({ name: draft.name })
    .eq("id", departmentId)
    .eq("organization_id", access.organizationId)
    .select("id");

  if (error) {
    redirectToEditDepartment(
      departmentId,
      organizationCatalogSaveError("department", error.code)
    );
  }

  if (!updatedRows || updatedRows.length !== 1) {
    notFound();
  }

  redirect("/departments");
}

export async function setDepartmentActiveState(
  departmentId: string,
  isActive: boolean
) {
  if (!isOrganizationCatalogId(departmentId) || typeof isActive !== "boolean") {
    redirectToDepartments(statusError);
  }

  const access = await requireDepartmentManager();

  if (!access.ok) {
    redirectToDepartments(statusError);
  }

  const { data: updatedRows, error } = await access.supabase
    .from("departments")
    .update({ is_active: isActive })
    .eq("id", departmentId)
    .eq("organization_id", access.organizationId)
    .select("id");

  if (error || !updatedRows || updatedRows.length !== 1) {
    redirectToDepartments(statusError);
  }

  redirect("/departments");
}
