import { MemberAvatar } from "@/components/member-avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  BirthdayOverviewCounts,
  BirthdayOverviewRow,
} from "@/lib/dashboard-birthday";
import { memberInitials } from "@/lib/member-photo";

export type BirthdayOverviewState =
  | { status: "error" }
  | {
      status: "empty";
      message: string;
      counts: BirthdayOverviewCounts;
    }
  | {
      status: "ready";
      counts: BirthdayOverviewCounts;
      rows: BirthdayOverviewRow[];
      imageUrls: Record<string, string>;
      total: number;
    };

function SummaryCards({ counts }: { counts: BirthdayOverviewCounts }) {
  const items = [
    { label: "Today", value: counts.today },
    { label: "Within 7 days", value: counts.withinSevenDays },
    { label: "Within 30 days", value: counts.withinThirtyDays },
  ];

  return (
    <div className="grid grid-cols-3 rounded-xl bg-white ring-1 ring-[#e2e8f0]">
      {items.map((item) => (
        <div key={item.label} className="px-2 py-2.5 text-center">
          <p className="text-lg font-semibold tabular-nums">{item.value}</p>
          <p className="text-xs text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function BirthdayOverview({ state }: { state: BirthdayOverviewState }) {
  return (
    <section className="mt-3 space-y-3" aria-labelledby="birthday-overview-heading">
      <h2 id="birthday-overview-heading" className="text-lg font-semibold">
        Birthdays
      </h2>

      {state.status === "error" ? (
        <Card>
          <CardContent>
            <p className="text-sm text-destructive">
              Unable to load birthdays. Please try again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <SummaryCards counts={state.counts} />
          <Card size="sm">
            <CardHeader>
              <CardTitle>Upcoming birthdays</CardTitle>
              {state.status === "ready" && state.total > state.rows.length ? (
                <CardDescription>
                  Showing {state.rows.length} of {state.total}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent>
              {state.status === "empty" ? (
                <p className="text-sm text-muted-foreground">{state.message}</p>
              ) : (
                <ul className="divide-y divide-foreground/10">
                  {state.rows.map((row) => (
                    <li key={row.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <MemberAvatar
                        initials={memberInitials(
                          row.firstName,
                          row.lastName,
                          row.displayName
                        )}
                        imageUrl={state.imageUrls[row.id] ?? null}
                      />
                      <div className="min-w-0">
                        <p className="font-medium">{row.displayName}</p>
                        <p className="text-sm text-muted-foreground">
                          {row.relativeLabel} · {row.celebrationDate}
                          {row.turningLabel ? ` · ${row.turningLabel}` : ""}
                        </p>
                        {row.bornLine ? (
                          <p className="text-sm text-muted-foreground">{row.bornLine}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
