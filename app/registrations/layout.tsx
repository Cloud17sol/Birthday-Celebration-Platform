import { AppShell } from "@/components/app-shell";

export default function RegistrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
