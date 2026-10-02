"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyRegistrationLink({ url }: { url: string }) {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">("idle");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={copyLink}>
        Copy link
      </Button>
      {feedback === "copied" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Copied
        </p>
      ) : null}
      {feedback === "failed" ? (
        <p className="text-sm text-destructive" role="status">
          Unable to copy the link. Select it and copy it manually.
        </p>
      ) : null}
    </div>
  );
}
