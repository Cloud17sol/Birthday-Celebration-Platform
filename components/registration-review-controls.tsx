"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { reviewRegistration } from "@/app/registrations/actions";
import { Button } from "@/components/ui/button";

function ReviewSubmitButton({
  idle,
  pendingLabel,
  variant = "default",
  disabled = false,
}: {
  idle: string;
  pendingLabel: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      className="h-11 w-full sm:w-auto"
      disabled={disabled || pending}
    >
      {pending ? pendingLabel : idle}
    </Button>
  );
}

export function RegistrationReviewControls({
  submissionId,
}: {
  submissionId: string;
}) {
  const [confirmingReject, setConfirmingReject] = useState(false);

  return (
    <div className="space-y-3">
      <form action={reviewRegistration}>
        <input type="hidden" name="submission_id" value={submissionId} />
        <input type="hidden" name="decision" value="approve" />
        <ReviewSubmitButton
          idle="Approve registration"
          pendingLabel="Approving…"
          disabled={confirmingReject}
        />
      </form>

      {confirmingReject ? (
        <form action={reviewRegistration} className="space-y-3 rounded-lg bg-muted p-3">
          <input type="hidden" name="submission_id" value={submissionId} />
          <input type="hidden" name="decision" value="reject" />
          <p className="text-sm">
            Reject this registration? No member will be added.
          </p>
          <div className="flex flex-wrap gap-2">
            <ReviewSubmitButton
              idle="Reject registration"
              pendingLabel="Rejecting…"
              variant="destructive"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setConfirmingReject(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full sm:w-auto"
          onClick={() => setConfirmingReject(true)}
        >
          Reject registration
        </Button>
      )}
    </div>
  );
}
