"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMemberId } from "@/app/members/new/validation";
import { MEMBER_PHOTO_BUCKET, isMemberPhotoPath } from "@/lib/member-photo";
import {
  memberDirectoryPath,
  parseMemberDirectoryQuery,
  type MemberDirectoryParams,
} from "@/lib/member-directory-query";

const statusUpdateError = "Unable to update member status. Please try again.";

function directoryReturnPath(directory?: MemberDirectoryParams) {
  const parsed = parseMemberDirectoryQuery(directory ?? {});

  return memberDirectoryPath({
    q: parsed.searchTerm,
    status: parsed.status,
    month: parsed.month,
    page: parsed.page,
  });
}

function redirectWithStatusError(directory?: MemberDirectoryParams): never {
  const path = directoryReturnPath(directory);
  const separator = path.includes("?") ? "&" : "?";

  redirect(
    `${path}${separator}error=${encodeURIComponent(statusUpdateError)}`
  );
}

export async function setMemberActiveState(
  memberId: string,
  isActive: boolean,
  directory?: MemberDirectoryParams
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMemberId(memberId) || typeof isActive !== "boolean") {
    redirectWithStatusError(directory);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];

  if (membershipError) {
    redirectWithStatusError(directory);
  }

  if (!currentMembership) {
    redirect("/dashboard");
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirect(directoryReturnPath(directory));
  }

  const { data: updatedRows, error } = await supabase
    .from("members")
    .update({ is_active: isActive })
    .eq("id", memberId)
    .eq("organization_id", currentMembership.organization_id)
    .select("id");

  if (error || !updatedRows || updatedRows.length !== 1) {
    redirectWithStatusError(directory);
  }

  redirect(directoryReturnPath(directory));
}

const deleteMemberError = "Unable to delete this member. Please try again.";

function redirectWithDeleteError(directory?: MemberDirectoryParams): never {
  const path = directoryReturnPath(directory);
  const separator = path.includes("?") ? "&" : "?";

  redirect(`${path}${separator}error=${encodeURIComponent(deleteMemberError)}`);
}

export async function deleteMember(
  memberId: string,
  directory?: MemberDirectoryParams
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMemberId(memberId)) {
    redirectWithDeleteError(directory);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];

  if (membershipError) {
    redirectWithDeleteError(directory);
  }

  if (!currentMembership) {
    redirect("/dashboard");
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirect(directoryReturnPath(directory));
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, photo_url")
    .eq("id", memberId)
    .eq("organization_id", currentMembership.organization_id)
    .maybeSingle();

  if (memberError) {
    redirectWithDeleteError(directory);
  }

  if (!member) {
    redirect(directoryReturnPath(directory));
  }

  if (isMemberPhotoPath(member.photo_url, currentMembership.organization_id, member.id)) {
    await supabase.storage.from(MEMBER_PHOTO_BUCKET).remove([member.photo_url]);
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from("members")
    .delete()
    .eq("id", member.id)
    .eq("organization_id", currentMembership.organization_id)
    .select("id");

  if (deleteError || !deletedRows || deletedRows.length !== 1) {
    redirectWithDeleteError(directory);
  }

  redirect(directoryReturnPath(directory));
}
