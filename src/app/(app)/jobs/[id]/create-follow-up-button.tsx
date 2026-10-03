"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createFollowUpJobAction } from "./follow-up-actions";

export function CreateFollowUpButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createFollowUpJobAction(jobId);
            if (result.success && result.newJobId) {
              router.push(`/jobs/${result.newJobId}`);
            } else {
              setError(
                result.error?.message ??
                  "Couldn't create the follow-up job. Please try again.",
              );
            }
          });
        }}
      >
        {isPending ? "Creating…" : "Create follow-up job"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
