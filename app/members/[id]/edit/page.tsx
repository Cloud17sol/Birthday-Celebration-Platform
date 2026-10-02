import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { memberInitials } from "@/lib/member-photo";
import { signMemberPhotoUrls } from "@/lib/member-photo-urls";
import { createClient } from "@/lib/supabase/server";
import {
  displayNameInputValue,
  isMemberId,
  monthNames,
} from "@/app/members/new/validation";
import { removeMemberPhoto, updateMember, uploadMemberPhoto } from "./actions";

type EditMemberPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export default async function EditMemberPage({
  params,
  searchParams,
}: EditMemberPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
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
    .select("id, organization_id, role, created_at, organizations(name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];
  const organization = currentMembership?.organizations;

  if (membershipError || !currentMembership || !organization) {
    if (membershipError) {
      return (
        <main className="mx-auto w-full max-w-md p-4 sm:p-8">
          <h1 className="text-2xl font-semibold">Edit member</h1>
          <p className="mt-6 text-sm text-destructive">
            Unable to load your organization. Please try again.
          </p>
          <Link
            href="/members"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
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
    redirect("/members");
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select(
      "id, display_name, first_name, last_name, birth_month, birth_day, birth_year, email, phone, notes, is_active, photo_url"
    )
    .eq("id", id)
    .eq("organization_id", currentMembership.organization_id)
    .maybeSingle();

  if (memberError) {
    return (
      <main className="mx-auto w-full max-w-md p-4 sm:p-8">
        <h1 className="text-2xl font-semibold">Edit member</h1>
        <p className="mt-6 text-sm text-destructive">
          Unable to load member. Please try again.
        </p>
        <Link
          href="/members"
          className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
        >
          Cancel
        </Link>
      </main>
    );
  }

  if (!member) {
    notFound();
  }

  const displayName = displayNameInputValue(
    member.first_name,
    member.last_name,
    member.display_name
  );
  const photoUrls = await signMemberPhotoUrls(
    supabase,
    currentMembership.organization_id,
    [member]
  );
  const photoUrl = photoUrls.get(member.id) ?? null;
  const hasStoredPhoto = member.photo_url !== null;

  return (
    <main className="mx-auto w-full max-w-md p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Edit member</h1>
      <p className="mt-2 font-medium">{organization.name}</p>
      <p className="text-sm text-muted-foreground">Birthday directory</p>

      {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}

      <section className="mt-6 space-y-4">
        <h2 className="text-sm font-medium">Member Photo</h2>
        <MemberAvatar
          initials={memberInitials(
            member.first_name,
            member.last_name,
            member.display_name
          )}
          imageUrl={photoUrl}
          size="md"
        />
        <form
          action={uploadMemberPhoto.bind(null, member.id)}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="photo">Choose Photo</Label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-sm text-muted-foreground">
              JPEG, PNG or WebP. Maximum original size 5 MB. Images are
              automatically optimized before upload.
            </p>
          </div>
          <Button type="submit">
            {hasStoredPhoto ? "Replace Photo" : "Upload Photo"}
          </Button>
        </form>
        {hasStoredPhoto ? (
          <form action={removeMemberPhoto.bind(null, member.id)}>
            <Button type="submit" variant="outline">
              Remove Photo
            </Button>
          </form>
        ) : null}
      </section>

      <form action={updateMember.bind(null, member.id)} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">First name *</Label>
          <Input
            id="first_name"
            name="first_name"
            maxLength={100}
            required
            autoComplete="given-name"
            defaultValue={member.first_name ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_name">Last name *</Label>
          <Input
            id="last_name"
            name="last_name"
            maxLength={100}
            required
            autoComplete="family-name"
            defaultValue={member.last_name ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            name="display_name"
            maxLength={200}
            autoComplete="nickname"
            defaultValue={displayName}
          />
          <p className="text-sm text-muted-foreground">
            Optional. Leave blank to use first and last name.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_month">Birth month *</Label>
          <select
            id="birth_month"
            name="birth_month"
            required
            defaultValue={String(member.birth_month)}
            className={selectClassName}
          >
            <option value="" disabled>
              Select month
            </option>
            {monthNames.map((monthName, index) => (
              <option key={monthName} value={index + 1}>
                {monthName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_day">Birth day *</Label>
          <Input
            id="birth_day"
            name="birth_day"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            step={1}
            required
            defaultValue={member.birth_day}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_year">Birth year</Label>
          <Input
            id="birth_year"
            name="birth_year"
            type="number"
            inputMode="numeric"
            min={1900}
            step={1}
            defaultValue={member.birth_year ?? ""}
          />
          <p className="text-sm text-muted-foreground">
            Optional. Leave blank if the year is unknown.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            spellCheck={false}
            defaultValue={member.email ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            maxLength={50}
            autoComplete="tel"
            defaultValue={member.phone ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            maxLength={2000}
            defaultValue={member.notes ?? ""}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit">Save changes</Button>
          <Link
            href="/members"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
