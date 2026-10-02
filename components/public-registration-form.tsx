"use client";

import { useActionState } from "react";
import { monthNames } from "@/app/members/new/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialPublicRegistrationFormState,
  type PublicRegistrationFormState,
} from "@/lib/public-registration";

const fieldClassName = "h-10 text-sm";
const selectClassName =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function PublicRegistrationForm({
  action,
}: {
  action: (
    previous: PublicRegistrationFormState,
    formData: FormData
  ) => Promise<PublicRegistrationFormState>;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialPublicRegistrationFormState
  );

  return (
    <form key={state.revision} action={formAction} className="relative mt-4 space-y-3">
      <div className="h-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="first_name">First name *</Label>
          <Input
            id="first_name"
            name="first_name"
            className={fieldClassName}
            maxLength={100}
            required
            autoComplete="given-name"
            defaultValue={state.values.firstName}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="last_name">Last name *</Label>
          <Input
            id="last_name"
            name="last_name"
            className={fieldClassName}
            maxLength={100}
            required
            autoComplete="family-name"
            defaultValue={state.values.lastName}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="birth_month">Birth month *</Label>
          <select
            id="birth_month"
            name="birth_month"
            required
            defaultValue={state.values.birthMonth}
            className={selectClassName}
          >
            <option value="" disabled>
              Select month
            </option>
            {monthNames.map((monthName, index) => (
              <option key={monthName} value={index + 1}>
                {monthName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="birth_day">Birth day *</Label>
          <Input
            id="birth_day"
            name="birth_day"
            className={fieldClassName}
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            step={1}
            required
            defaultValue={state.values.birthDay}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="birth_year">Birth year</Label>
        <Input
          id="birth_year"
          name="birth_year"
          className={fieldClassName}
          type="number"
          inputMode="numeric"
          min={1900}
          step={1}
          defaultValue={state.values.birthYear}
        />
        <p className="text-xs text-muted-foreground">Optional.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            className={fieldClassName}
            type="email"
            maxLength={254}
            autoComplete="email"
            spellCheck={false}
            defaultValue={state.values.email}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            className={fieldClassName}
            type="tel"
            maxLength={50}
            autoComplete="tel"
            defaultValue={state.values.phone}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Email or phone is required. You can enter both.
      </p>

      <div className="space-y-1">
        <Label htmlFor="photo">Photo</Label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-[#eef2ff] file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-[#142033]"
        />
        <p className="text-xs text-muted-foreground">
          Optional. JPEG, PNG, or WebP up to 5 MB.
        </p>
      </div>

      <Button type="submit" className="h-10 w-full rounded-xl bg-[#315efb] text-white" disabled={pending}>
        {pending ? "Submitting…" : "Submit birthday details"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Your details are shared with the organization that sent this link.
      </p>
    </form>
  );
}
