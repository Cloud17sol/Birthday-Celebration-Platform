import { AppShell } from "@/components/app-shell";

export default function DepartmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
