import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { RegistrationReviewControls } from "@/components/registration-review-controls";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isRegistrationManager } from "@/lib/registration-link";
import {
  formatSubmissionBirthday,
  formatSubmittedAt,
  isSubmissionId,
  registrationReviewNotice,
  submissionStatusLabel,
} from "@/lib/registration-review";
import { createClient } from "@/lib/supabase/server";

type RegistrationReviewPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    reviewed?: string;
    notice?: string;
  }>;
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="break-all font-medium">{value}</p>
    </div>
  );
}

export default async function RegistrationReviewPage({
  params,
  searchParams,
}: RegistrationReviewPageProps) {
  const { id } = await params;
  const { reviewed, notice } = await searchParams;
  const reviewNotice = registrationReviewNotice(reviewed, notice);

  if (!isSubmissionId(id)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
        <main className="mx-auto w-full max-w-lg overflow-x-hidden p-4 sm:p-8">
          <h1 className="text-2xl font-semibold">Review registration</h1>
          <p className="mt-6 text-sm text-destructive">
            Unable to load your organization. Please try again.
          </p>
        </main>
      );
    }

    redirect("/dashboard");
  }

  if (!isRegistrationManager(currentMembership.role)) {
    redirect("/dashboard");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("member_submissions")
    .select(
      "id, display_name, birth_month, birth_day, birth_year, email, phone, status, created_at, member_id"
    )
    .eq("id", id)
    .eq("organization_id", currentMembership.organization_id)
    .maybeSingle();

  if (submissionError) {
    return (
      <main className="mx-auto w-full max-w-lg overflow-x-hidden p-4 sm:p-8">
        <h1 className="text-2xl font-semibold">Review registration</h1>
        <p className="mt-6 text-sm text-destructive">
          Unable to load this registration. Please try again.
        </p>
      </main>
    );
  }

  if (!submission) {
    notFound();
  }

  let memberStillExists = false;

  if (submission.status === "approved" && submission.member_id) {
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("id", submission.member_id)
      .eq("organization_id", currentMembership.organization_id)
      .maybeSingle();

    memberStillExists = Boolean(member);
  }

  const submittedAt = formatSubmittedAt(submission.created_at);
  const canReview = submission.status === "pending";

  return (
    <main className="mx-auto w-full max-w-lg overflow-x-hidden p-4 sm:p-8">
      <Link
        href="/registrations"
        className={cn(buttonVariants({ variant: "outline" }), "h-11")}
      >
        All registrations
      </Link>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="break-words text-xl">
            {submission.display_name}
          </CardTitle>
          <CardDescription className="break-words">
            {organization.name} · {submissionStatusLabel(submission.status)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviewNotice ? (
            <p className="text-sm text-muted-foreground" role="status">
              {reviewNotice}
            </p>
          ) : null}

          <Detail label="Name" value={submission.display_name} />
          <Detail
            label="Birthday"
            value={
              formatSubmissionBirthday(
                submission.birth_month,
                submission.birth_day,
                null
              ) ?? "Unavailable"
            }
          />
          {submission.birth_year != null ? (
            <Detail label="Birth year" value={String(submission.birth_year)} />
          ) : null}
          <Detail
            label="Email"
            value={submission.email ?? "Not provided"}
          />
          <Detail
            label="Phone"
            value={submission.phone ?? "Not provided"}
          />
          <Detail
            label="Submitted"
            value={submittedAt ?? "Unavailable"}
          />
          <Detail
            label="Status"
            value={submissionStatusLabel(submission.status)}
          />

          {canReview ? (
            <RegistrationReviewControls submissionId={submission.id} />
          ) : null}

          {memberStillExists && submission.member_id ? (
            <Link
              href={`/members/${submission.member_id}/edit`}
              className={cn(buttonVariants({ variant: "outline" }), "h-11")}
            >
              Edit member
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
