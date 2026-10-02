import { AppShell } from "@/components/app-shell";

export default function GroupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
