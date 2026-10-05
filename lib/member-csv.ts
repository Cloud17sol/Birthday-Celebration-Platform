import { monthNames } from "@/app/members/new/validation";

export type MemberCsvRow = {
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  birth_day: number;
  birth_month: number;
  birth_year: number | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  notes: string | null;
};

const memberCsvHeaders = [
  "First name",
  "Last name",
  "Display name",
  "Birth day",
  "Birth month",
  "Birth year",
  "Email",
  "Phone",
  "Status",
  "Notes",
] as const;

function csvCell(value: string) {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;

  return `"${guarded.replaceAll('"', '""')}"`;
}

function birthMonthName(month: number) {
  return monthNames[month - 1] ?? "";
}

export function membersToCsv(members: readonly MemberCsvRow[]) {
  const lines = [
    memberCsvHeaders.map(csvCell).join(","),
    ...members.map((member) =>
      [
        member.first_name ?? "",
        member.last_name ?? "",
        member.display_name,
        String(member.birth_day),
        birthMonthName(member.birth_month),
        member.birth_year == null ? "" : String(member.birth_year),
        member.email ?? "",
        member.phone ?? "",
        member.is_active ? "Active" : "Inactive",
        member.notes ?? "",
      ]
        .map(csvCell)
        .join(",")
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
