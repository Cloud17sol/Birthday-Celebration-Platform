import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, LayoutDashboard } from "lucide-react";
import { cn } from "cn";
import { ApproveAllRegistrations } from "@/components/approve-all-registrations";
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
        <main className="w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
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
    <main className="w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Registrations</h1>
          <p className="mt-2 break-words text-muted-foreground">{organization.name}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {pending.length > 0 ? <ApproveAllRegistrations /> : null}
          <Link
            href="/dashboard"
            aria-label="Dashboard"
            title="Dashboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "size-9 shrink-0"
            )}
          >
            <LayoutDashboard />
          </Link>
        </div>
      </div>

      {notice === "approved-all" ? (
        <p className="mt-4 text-sm" role="status">
          All pending registrations were approved.
        </p>
      ) : null}

      {notice === "approve-failed" ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Some registrations could not be approved. Review the ones still pending.
        </p>
      ) : null}

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
        <>
        <ul className="mt-4 space-y-2 md:hidden">
          {pending.map((submission) => {
            const birthday = formatSubmissionBirthday(
              submission.birth_month,
              submission.birth_day,
              submission.birth_year
            );
            const submittedAt = formatSubmittedAt(submission.created_at);
            const contact = [submission.email, submission.phone]
              .filter(Boolean)
              .join(" · ");

            return (
              <li
                key={submission.id}
                data-slot="card"
                className="px-3 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 font-medium break-words">
                    {submission.display_name}
                  </p>
                  <p className="shrink-0 text-muted-foreground">
                    {submissionStatusLabel(submission.status)}
                  </p>
                  <Link
                    href={`/registrations/${submission.id}`}
                    aria-label="Review"
                    title="Review"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon" }),
                      "size-8 shrink-0"
                    )}
                  >
                    <ClipboardCheck />
                  </Link>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {birthday ?? "Birthday unavailable"}
                  {contact ? ` · ${contact}` : ""}
                </p>
                {submittedAt ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Submitted {submittedAt}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <ul className="@container mt-4 hidden flex-col gap-2 md:flex">
          {pending.map((submission) => {
            const birthday = formatSubmissionBirthday(
              submission.birth_month,
              submission.birth_day,
              submission.birth_year
            );
            const submittedAt = formatSubmittedAt(submission.created_at);
            const contact = [submission.email, submission.phone]
              .filter(Boolean)
              .join(" · ");
            const details = [
              birthday ?? "Birthday unavailable",
              contact,
              submittedAt ? `Submitted ${submittedAt}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <li
                key={submission.id}
                data-slot="card"
                className="min-w-0 overflow-hidden px-3 py-2 text-sm @min-[56rem]:flex @min-[56rem]:items-center @min-[56rem]:gap-3 @min-[56rem]:px-4 @min-[56rem]:py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2 @min-[56rem]:contents">
                  <p className="min-w-0 flex-1 truncate font-medium @min-[56rem]:w-36 @min-[56rem]:flex-none">
                    {submission.display_name}
                  </p>
                  <p className="hidden w-28 truncate @min-[56rem]:block">
                    {birthday ?? "Birthday unavailable"}
                  </p>
                  <p className="shrink-0 text-muted-foreground @min-[56rem]:w-20">
                    {submissionStatusLabel(submission.status)}
                  </p>
                  <p className="hidden min-w-0 flex-1 truncate @min-[56rem]:block">
                    {contact || "No contact"}
                  </p>
                  <p className="hidden min-w-0 max-w-56 truncate text-muted-foreground @min-[56rem]:block">
                    {submittedAt ? `Submitted ${submittedAt}` : ""}
                  </p>
                  <Link
                    href={`/registrations/${submission.id}`}
                    aria-label="Review"
                    title="Review"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon" }),
                      "size-8 shrink-0"
                    )}
                  >
                    <ClipboardCheck />
                  </Link>
                </div>
                <p className="mt-0.5 truncate text-muted-foreground @min-[56rem]:hidden">
                  {details}
                </p>
              </li>
            );
          })}
        </ul>
        </>
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
