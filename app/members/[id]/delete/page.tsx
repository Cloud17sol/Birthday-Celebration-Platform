import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { deleteMember } from "@/app/members/actions";
import { isMemberId } from "@/app/members/new/validation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  memberDirectoryPath,
  parseMemberDirectoryQuery,
  type MemberDirectoryParams,
} from "@/lib/member-directory-query";
import { createClient } from "@/lib/supabase/server";

type DeleteMemberPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<MemberDirectoryParams>;
};

export default async function DeleteMemberPage({
  params,
  searchParams,
}: DeleteMemberPageProps) {
  const { id } = await params;
  const directoryQuery = parseMemberDirectoryQuery(await searchParams);
  const directoryPath = memberDirectoryPath({
    q: directoryQuery.searchTerm,
    status: directoryQuery.status,
    month: directoryQuery.month,
    page: directoryQuery.page,
  });
  const directoryState = {
    q: directoryQuery.searchTerm ?? "",
    status: directoryQuery.status,
    month: directoryQuery.month,
    page: String(directoryQuery.page),
  };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMemberId(id)) {
    notFound();
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, created_at, organizations(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];
  const organization = currentMembership?.organizations;

  if (membershipError || !currentMembership || !organization) {
    if (membershipError) {
      return (
        <main className="mx-auto w-full max-w-md p-4 sm:p-8">
          <h1 className="text-2xl font-semibold">Delete member</h1>
          <p className="mt-6 text-sm text-destructive">
            Unable to load your organization. Please try again.
          </p>
          <Link
            href={directoryPath}
            className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11")}
          >
            Cancel
          </Link>
        </main>
      );
    }

    redirect("/dashboard");
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirect(directoryPath);
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, display_name")
    .eq("id", id)
    .eq("organization_id", currentMembership.organization_id)
    .maybeSingle();

  if (memberError) {
    return (
      <main className="mx-auto w-full max-w-md p-4 sm:p-8">
        <h1 className="text-2xl font-semibold">Delete member</h1>
        <p className="mt-6 text-sm text-destructive">
          Unable to delete this member. Please try again.
        </p>
        <Link
          href={directoryPath}
          className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11")}
        >
          Cancel
        </Link>
      </main>
    );
  }

  if (!member) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-md p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Delete {member.display_name}?</h1>
      <p className="mt-2 font-medium">{organization.name}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        This permanently removes the member from the directory and celebrations.
        Deactivate them instead if you only want to hide them.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <form action={deleteMember.bind(null, member.id, directoryState)}>
          <Button type="submit" variant="destructive" className="h-11">
            Delete member
          </Button>
        </form>
        <Link
          href={directoryPath}
          className={cn(buttonVariants({ variant: "outline" }), "h-11")}
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}
