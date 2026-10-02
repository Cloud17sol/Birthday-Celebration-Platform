"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  birthdayCalendarPath,
  calendarMonthName,
  celebrationPath,
} from "@/lib/birthday-calendar";

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function CelebrationMonthNav({
  year,
  month,
  kind = "celebrations",
}: {
  year: number;
  month: number;
  kind?: "celebrations" | "calendar";
}) {
  const navRef = useRef<HTMLElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const current = currentRef.current;

    if (!nav || !current) {
      return;
    }

    const nextLeft =
      current.offsetLeft - nav.clientWidth / 2 + current.clientWidth / 2;

    nav.scrollTo({ left: Math.max(0, nextLeft) });
  }, [year, month]);

  return (
    <nav
      ref={navRef}
      aria-label={kind === "calendar" ? "Calendar months" : "Celebration months"}
      className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1"
    >
      {months.map((item) => {
        const name = calendarMonthName(item);
        const current = item === month;

        return (
          <Link
            key={item}
            ref={current ? currentRef : undefined}
            href={(kind === "calendar" ? birthdayCalendarPath : celebrationPath)({
              year,
              month: item,
            })}
            aria-current={current ? "page" : undefined}
            aria-label={`${name} ${year}`}
            className={
              current
                ? "flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#315efb] px-3 text-sm font-semibold text-white"
                : "flex h-9 shrink-0 items-center justify-center rounded-lg bg-white px-3 text-sm font-semibold text-[#52657a] ring-1 ring-[#e2e8f0]"
            }
          >
            {name?.slice(0, 3)}
          </Link>
        );
      })}
    </nav>
  );
}
