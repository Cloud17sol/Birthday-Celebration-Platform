import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { membersToCsv, type MemberCsvRow } from "@/lib/member-csv";
import { createClient } from "@/lib/supabase/server";

const exportError = "Unable to export members. Please try again.";
const pageSize = 1000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const organizationId = memberships?.[0]?.organization_id;

  if (membershipError) {
    redirect(`/members?error=${encodeURIComponent(exportError)}`);
  }

  if (!organizationId) {
    redirect("/dashboard");
  }

  const members: MemberCsvRow[] = [];
  let previousFirstId: string | null = null;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("members")
      .select(
        "id, first_name, last_name, display_name, birth_day, birth_month, birth_year, email, phone, is_active, notes"
      )
      .eq("organization_id", organizationId)
      .order("display_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error || !data) {
      redirect(`/members?error=${encodeURIComponent(exportError)}`);
    }

    if (data.length === 0) {
      break;
    }

    if (data[0]?.id === previousFirstId) {
      redirect(`/members?error=${encodeURIComponent(exportError)}`);
    }

    previousFirstId = data[0]?.id ?? null;
    members.push(
      ...data.map((member) => ({
        first_name: member.first_name,
        last_name: member.last_name,
        display_name: member.display_name,
        birth_day: member.birth_day,
        birth_month: member.birth_month,
        birth_year: member.birth_year,
        email: member.email,
        phone: member.phone,
        is_active: member.is_active,
        notes: member.notes,
      }))
    );

    if (data.length < pageSize) {
      break;
    }
  }

  return new NextResponse(membersToCsv(members), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="members.csv"',
      "Cache-Control": "no-store",
    },
  });
}
