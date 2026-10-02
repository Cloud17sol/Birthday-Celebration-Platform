"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";

export type BirthdayCardPerson = {
  id: string;
  displayName: string;
  fullName: string | null;
  initials: string;
  imageUrl: string | null;
  birthdayLabel: string;
  celebrationLabel: string;
  ageLabel: string | null;
  bornLine: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function BirthdayDateCard({
  label,
  people,
  backgroundColor,
}: {
  label: string;
  people: BirthdayCardPerson[];
  backgroundColor: string;
}) {
  const names = people.map((person) => person.displayName).join(", ");

  return (
    <Dialog.Root>
      <Dialog.Trigger
        data-slot="card"
        aria-label={`View birthday details for ${label}`}
        style={{ backgroundColor }}
        className="flex w-full cursor-pointer flex-col gap-4 rounded-xl py-4 text-left text-sm text-card-foreground ring-1 ring-foreground/10 outline-none transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_16px_32px_-18px_rgb(15_23_42/0.45)] focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
      >
        <div className="px-4">
          <p className="text-base leading-snug font-medium">{label}</p>
        </div>
        <ul className="divide-y divide-foreground/10 px-4">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
            >
              <MemberAvatar initials={person.initials} imageUrl={person.imageUrl} />
              <div className="min-w-0">
                <p className="font-medium">{person.displayName}</p>
                {person.ageLabel ? (
                  <p className="text-sm text-muted-foreground">{person.ageLabel}</p>
                ) : null}
                {person.bornLine ? (
                  <p className="text-sm text-muted-foreground">{person.bornLine}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-[#0e1730]/45 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[70] flex max-h-[min(40rem,calc(100dvh-2rem))] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.25rem] bg-white text-[#142033] shadow-[0_24px_60px_-28px_rgb(14_23_48/0.55)] outline-none transition duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold tracking-[-0.03em]">
                {label}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[#52657a]">
                {names}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[0.85rem] text-[#142033] ring-1 ring-[#e2e8f0] outline-none hover:bg-[#f3f6fb] focus-visible:ring-3 focus-visible:ring-[#315efb]/40"
            >
              <X />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 pt-4 pb-5">
            <ul className="space-y-5">
              {people.map((person) => (
                <li
                  key={person.id}
                  className="border-t border-[#e2e8f0] pt-5 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      initials={person.initials}
                      imageUrl={person.imageUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-base font-semibold">{person.displayName}</p>
                      {person.fullName ? (
                        <p className="text-sm text-[#52657a]">{person.fullName}</p>
                      ) : null}
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <Detail label="Birthday">{person.birthdayLabel}</Detail>
                    <Detail label="Celebrated">{person.celebrationLabel}</Detail>
                    <Detail label="Age">
                      {person.ageLabel ?? "Birth year not recorded"}
                    </Detail>
                    {person.bornLine ? (
                      <Detail label="Born">{person.bornLine.replace(/^Born /, "")}</Detail>
                    ) : null}
                  </dl>
                  {person.email || person.phone ? (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-[#52657a]">Contact</p>
                      {person.email ? (
                        <p className="mt-0.5 text-sm break-all">{person.email}</p>
                      ) : null}
                      {person.phone ? (
                        <p className="mt-0.5 text-sm">{person.phone}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {person.notes ? (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-[#52657a]">Notes</p>
                      <p className="mt-0.5 text-sm whitespace-pre-wrap">{person.notes}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
