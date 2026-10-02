import { PublicRegistrationForm } from "@/components/public-registration-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isPublicRegistrationToken,
  publicJoinView,
} from "@/lib/public-registration";
import { createClient } from "@/lib/supabase/server";
import { submitPublicRegistration } from "./actions";

type JoinPageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams: Promise<{
    submitted?: string;
    photo?: string;
  }>;
};

async function publicOrganizationName(token: string) {
  if (!isPublicRegistrationToken(token)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_registration", {
    registration_token: token,
  });

  if (error || typeof data !== "string") {
    return null;
  }

  const name = data.trim();

  return name.length > 0 ? name : null;
}

function JoinFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#f3f6fb] lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="bg-[#160b33] px-5 py-8 text-white [background-image:radial-gradient(ellipse_70%_80%_at_20%_0%,#7c3aed_0%,transparent_55%),radial-gradient(ellipse_50%_40%_at_100%_100%,#f97316_0%,transparent_50%),linear-gradient(165deg,#2a1468,#120a28)] lg:flex lg:min-h-dvh lg:flex-col lg:justify-end lg:px-12 lg:py-16">
        <p className="text-sm font-medium text-white/80">Birthday registration</p>
        <h1 className="mt-2 max-w-sm text-3xl font-semibold tracking-tight text-balance">
          Join the celebration
        </h1>
      </section>
      <section className="px-4 py-6 sm:px-8 sm:py-10">{children}</section>
    </main>
  );
}

function UnavailableRegistration() {
  return (
    <JoinFrame>
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Birthday Registration</CardTitle>
          <CardDescription className="text-base text-foreground">
            This registration link is unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please contact the organization that shared the link with you.
          </p>
        </CardContent>
      </Card>
    </JoinFrame>
  );
}

function RegistrationReceived({
  organizationName,
  photoFailed,
}: {
  organizationName: string;
  photoFailed: boolean;
}) {
  return (
    <JoinFrame>
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Thank you!</CardTitle>
          <CardDescription className="break-words text-base text-foreground">
            Your birthday details have been submitted to {organizationName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            They will appear after an administrator reviews and approves your
            registration.
          </p>
          {photoFailed ? (
            <p className="text-sm text-muted-foreground">
              Your photo could not be saved. The organization can add one after
              approval.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </JoinFrame>
  );
}

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
  const { token } = await params;
  const { submitted, photo } = await searchParams;
  const organizationName = await publicOrganizationName(token);
  const view = publicJoinView({
    organizationName,
    submitted: submitted === "1",
  });

  if (view.status === "unavailable") {
    return <UnavailableRegistration />;
  }

  if (view.status === "success") {
    return (
      <RegistrationReceived
        organizationName={view.organizationName}
        photoFailed={photo === "failed"}
      />
    );
  }

  const submitRegistration = submitPublicRegistration.bind(null, token);

  return (
    <JoinFrame>
      <Card size="sm" className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Birthday Registration</CardTitle>
          <CardDescription className="break-words text-base font-medium text-foreground">
            {view.organizationName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add your birthday so it can be included in celebrations.
          </p>
          <PublicRegistrationForm action={submitRegistration} />
        </CardContent>
      </Card>
    </JoinFrame>
  );
}
