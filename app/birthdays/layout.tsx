import { AppShell } from "@/components/app-shell";

export default function BirthdaysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
