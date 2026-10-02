import { CopyRegistrationLink } from "@/components/copy-registration-link";
import { Card, CardContent } from "@/components/ui/card";
import type { RegistrationLinkView } from "@/lib/registration-link";

export function RegistrationLinkSection({ view }: { view: RegistrationLinkView }) {
  if (view.status === "hidden") {
    return null;
  }

  return (
    <Card className="mt-3" size="sm">
      <CardContent>
        {view.status === "error" ? (
          <p className="text-sm text-destructive">
            Unable to load the registration link right now.
          </p>
        ) : null}
        {view.status === "disabled" ? (
          <p className="text-sm text-muted-foreground">
            Registration link is currently disabled.
          </p>
        ) : null}
        {view.status === "ready" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">Birthday registration</p>
              <p className="mt-1 truncate font-mono text-sm text-muted-foreground">
                {view.url}
              </p>
            </div>
            <CopyRegistrationLink url={view.url} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
