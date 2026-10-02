"use server";

import { redirect } from "next/navigation";
import { celebrationPath, strictCalendarMonth } from "@/lib/birthday-calendar";
import { formatCivilDate, getLastFridayOfMonth } from "@/lib/birthday";
import { celebrationActivateError } from "@/lib/celebration";
import { createClient } from "@/lib/supabase/server";

const activateFailed = "Unable to activate celebration. Please try again.";

function redirectToCelebration(
  year: number | null,
  month: number | null,
  message?: string
): never {
  if (year === null || month === null) {
    if (!message) {
      redirect("/celebrations");
    }

    redirect(`/celebrations?error=${encodeURIComponent(message)}`);
  }

  const path = celebrationPath({ year, month });

  if (!message) {
    redirect(path);
  }

  redirect(`${path}&error=${encodeURIComponent(message)}`);
}

export async function activateCelebration(formData: FormData) {
  const yearValue = formData.get("year");
  const monthValue = formData.get("month");
  const selected = strictCalendarMonth(
    typeof yearValue === "string" ? yearValue : undefined,
    typeof monthValue === "string" ? monthValue : undefined
  );
  const year = selected?.year ?? null;
  const month = selected?.month ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const currentMembership = memberships?.[0];

  if (membershipError || !currentMembership) {
    redirectToCelebration(year, month, activateFailed);
  }

  if (
    currentMembership.role !== "owner" &&
    currentMembership.role !== "admin"
  ) {
    redirectToCelebration(year, month);
  }

  if (!selected) {
    redirectToCelebration(null, null, activateFailed);
  }

  const lastFriday = getLastFridayOfMonth(selected);
  const celebrationDate = lastFriday.ok ? formatCivilDate(lastFriday.value) : null;

  if (!lastFriday.ok || !celebrationDate) {
    redirectToCelebration(selected.year, selected.month, activateFailed);
  }

  const { error } = await supabase.from("celebrations").insert({
    organization_id: currentMembership.organization_id,
    celebration_year: selected.year,
    celebration_month: selected.month,
    celebration_date: celebrationDate,
    schedule_rule: "last_friday",
    status: "active",
    created_by: user.id,
  });

  if (error) {
    redirectToCelebration(
      selected.year,
      selected.month,
      celebrationActivateError(error.code)
    );
  }

  redirectToCelebration(selected.year, selected.month);
}
