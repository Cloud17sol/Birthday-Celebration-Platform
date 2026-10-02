import { login } from "./actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="min-h-dvh bg-[#f3f6fb] lg:grid lg:grid-cols-2">
      <section className="bg-[#160b33] px-5 py-8 text-white [background-image:radial-gradient(ellipse_70%_80%_at_20%_0%,#7c3aed_0%,transparent_55%),radial-gradient(ellipse_50%_40%_at_100%_100%,#f97316_0%,transparent_50%),linear-gradient(165deg,#2a1468,#120a28)] lg:flex lg:min-h-dvh lg:flex-col lg:justify-end lg:px-12 lg:py-16">
        <p className="text-sm font-medium text-white/80">Birthday celebrations</p>
        <h1 className="mt-2 max-w-sm text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Celebrate together
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-white/80">
          Bring people together through the birthdays your organization already
          keeps.
        </p>
      </section>
      <section className="flex items-center px-4 py-8 sm:px-8">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_12px_28px_-22px_rgb(15_23_42/0.45)] sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-[#142033]">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-[#52657a]">
            Sign in to manage your organization&apos;s celebrations.
          </p>
          <form action={login} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="h-11 rounded-xl bg-white px-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11 rounded-xl bg-white px-3"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="h-11 w-full rounded-xl bg-[#315efb] text-white">
              Sign in
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
