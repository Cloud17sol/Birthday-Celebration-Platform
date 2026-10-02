import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { createMember } from "./actions";
import { monthNames } from "./validation";

type NewMemberPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export default async function NewMemberPage({
  searchParams,
}: NewMemberPageProps) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
          <h1 className="text-2xl font-semibold">Add member</h1>
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

  return (
    <main className="mx-auto w-full max-w-md p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Add member</h1>
      <p className="mt-2 font-medium">{organization.name}</p>
      <p className="text-sm text-muted-foreground">Birthday directory</p>

      <form action={createMember} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">First name *</Label>
          <Input
            id="first_name"
            name="first_name"
            maxLength={100}
            required
            autoComplete="given-name"
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            name="display_name"
            maxLength={200}
            autoComplete="nickname"
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
            defaultValue=""
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            maxLength={2000}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit">Add member</Button>
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
