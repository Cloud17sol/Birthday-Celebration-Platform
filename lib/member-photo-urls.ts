import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  MEMBER_PHOTO_BUCKET,
  MEMBER_PHOTO_SIGNED_URL_SECONDS,
  isMemberPhotoPath,
} from "@/lib/member-photo";

type MemberPhotoRecord = {
  id: string;
  photo_url: string | null;
};

export async function signMemberPhotoUrls(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  members: MemberPhotoRecord[]
) {
  const signedUrls = new Map<string, string>();
  const signable = members.flatMap((member) => {
    if (!isMemberPhotoPath(member.photo_url, organizationId, member.id)) {
      return [];
    }

    return [{ id: member.id, photoPath: member.photo_url }];
  });

  if (signable.length === 0) {
    return signedUrls;
  }

  const paths = signable.map((member) => member.photoPath);
  const memberIdByPath = new Map(
    signable.map((member) => [member.photoPath, member.id])
  );

  try {
    const { data, error } = await supabase.storage
      .from(MEMBER_PHOTO_BUCKET)
      .createSignedUrls(paths, MEMBER_PHOTO_SIGNED_URL_SECONDS);

    if (error || !data) {
      return signedUrls;
    }

    for (const item of data) {
      if (!item.path || item.error || !item.signedUrl) {
        continue;
      }

      const memberId = memberIdByPath.get(item.path);

      if (memberId) {
        signedUrls.set(memberId, item.signedUrl);
      }
    }
  } catch {
    return signedUrls;
  }

  return signedUrls;
}
