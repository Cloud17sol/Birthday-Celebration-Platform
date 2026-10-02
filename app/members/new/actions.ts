"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateMemberForm } from "./validation";

function redirectWithMemberError(message: string): never {
  redirect(`/members/new?error=${encodeURIComponent(message)}`);
}

export async function createMember(formData: FormData) {
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
    redirectWithMemberError("Unable to add member. Please try again.");
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
    redirectWithMemberError(draft.error);
  }

  const { error } = await supabase.from("members").insert({
    organization_id: currentMembership.organization_id,
    display_name: draft.value.displayName,
    first_name: draft.value.firstName,
    last_name: draft.value.lastName,
    birth_month: draft.value.birthMonth,
    birth_day: draft.value.birthDay,
    birth_year: draft.value.birthYear,
    email: draft.value.email,
    phone: draft.value.phone,
    notes: draft.value.notes,
    created_by: user.id,
  });

  if (error) {
    redirectWithMemberError("Unable to add member. Please try again.");
  }

  redirect("/members");
}
