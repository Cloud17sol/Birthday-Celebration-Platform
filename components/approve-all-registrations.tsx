"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCheck } from "lucide-react";
import { approveAllRegistrations } from "@/app/registrations/actions";
import { Button } from "@/components/ui/button";

function ApproveAllSubmit() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="h-9" disabled={pending}>
      {pending ? "Approving…" : "Approve all"}
    </Button>
  );
}

export function ApproveAllRegistrations() {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon"
        className="size-9"
        aria-label="Approve all"
        title="Approve all"
        onClick={() => setConfirming(true)}
      >
        <CheckCheck />
      </Button>
      {confirming ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[#0e1730]/40"
            aria-label="Cancel"
            onClick={() => setConfirming(false)}
          />
          <form
            action={approveAllRegistrations}
            className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_24px_60px_-24px_rgba(14,23,48,0.45)]"
          >
            <p className="text-base font-semibold text-[#142033]">
              Approve every pending registration?
            </p>
            <p className="mt-2 text-sm text-[#52657a]">
              Each pending registration becomes a member.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <ApproveAllSubmit />
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
