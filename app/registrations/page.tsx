import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { ListPagination } from "@/components/list-pagination";
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
  comparePendingSubmissions,
  formatSubmissionBirthday,
  formatSubmittedAt,
  registrationQueueNotice,
  submissionStatusLabel,
} from "@/lib/registration-review";
import { listPageCount, listPagePath, listRange, parseListPage } from "@/lib/list-page";
import { createClient } from "@/lib/supabase/server";

type RegistrationsPageProps = {
  searchParams: Promise<{
    notice?: string;
    page?: string | string[];
  }>;
};

export default async function RegistrationsPage({
  searchParams,
}: RegistrationsPageProps) {
  const params = await searchParams;
  const notice = params.notice;
  const queueNotice = registrationQueueNotice(notice);
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
        <main className="mx-auto w-full max-w-3xl overflow-x-hidden p-4 sm:p-8">
          <h1 className="text-2xl font-semibold">Registrations</h1>
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

  const requestedPage = parseListPage(params.page);
  const organizationId = currentMembership.organization_id;

  function submissionQuery(head = false) {
    return supabase
      .from("member_submissions")
      .select(
        "id, display_name, birth_month, birth_day, birth_year, email, phone, status, created_at",
        { count: "exact", head }
      )
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
  }

  const submissionCountResult = await submissionQuery(true);
  const submissionTotal = submissionCountResult.count;
  const submissionPageCount =
    submissionTotal == null ? requestedPage : listPageCount(submissionTotal);

  if (
    !submissionCountResult.error &&
    submissionTotal != null &&
    requestedPage > submissionPageCount
  ) {
    redirect(listPagePath("/registrations", submissionPageCount));
  }

  const requestedRange = listRange(requestedPage);
  const submissionsResult =
    submissionCountResult.error || submissionTotal === 0
      ? { data: [], error: submissionCountResult.error }
      : await submissionQuery().range(requestedRange.from, requestedRange.to);
  const submissions = submissionsResult.data;
  const submissionsError = submissionsResult.error;

  const pending = (submissions ?? [])
    .slice()
    .sort((left, right) =>
      comparePendingSubmissions(
        { createdAt: left.created_at, id: left.id },
        { createdAt: right.created_at, id: right.id }
      )
    );

  return (
    <main className="mx-auto w-full max-w-3xl overflow-x-hidden p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Registrations</h1>
          <p className="mt-2 break-words text-muted-foreground">{organization.name}</p>
        </div>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline" }), "h-11")}
        >
          Dashboard
        </Link>
      </div>

      {queueNotice ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {queueNotice}
        </p>
      ) : null}

      {submissionsError ? (
        <p className="mt-6 text-sm text-destructive">
          Unable to load registrations. Please try again.
        </p>
      ) : pending.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>No pending registrations.</CardTitle>
            <CardDescription>
              New birthday submissions will appear here for review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline" }), "h-11")}
            >
              Back to Dashboard
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {pending.map((submission) => {
            const birthday = formatSubmissionBirthday(
              submission.birth_month,
              submission.birth_day,
              submission.birth_year
            );
            const submittedAt = formatSubmittedAt(submission.created_at);

            return (
              <Card key={submission.id}>
                <CardHeader>
                  <CardTitle className="break-words text-base">
                    {submission.display_name}
                  </CardTitle>
                  <CardDescription>
                    {birthday ?? "Birthday unavailable"} ·{" "}
                    {submissionStatusLabel(submission.status)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {submission.email ? (
                    <p className="break-all text-sm">{submission.email}</p>
                  ) : null}
                  {submission.phone ? (
                    <p className="break-all text-sm">{submission.phone}</p>
                  ) : null}
                  {submittedAt ? (
                    <p className="text-sm text-muted-foreground">
                      Submitted {submittedAt}
                    </p>
                  ) : null}
                  <Link
                    href={`/registrations/${submission.id}`}
                    className={cn(buttonVariants({ variant: "outline" }), "h-11")}
                  >
                    Review
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {submissionsError || !submissions ? null : (
        <ListPagination
          page={requestedPage}
          pageCount={submissionPageCount}
          hrefForPage={(page) => listPagePath("/registrations", page)}
        />
      )}
    </main>
  );
}
