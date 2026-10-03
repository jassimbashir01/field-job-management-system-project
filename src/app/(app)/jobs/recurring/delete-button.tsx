"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteRecurrenceAction } from "./actions";

export function DeleteRecurrenceButton({
  recurrenceId,
  redirectTo,
}: {
  recurrenceId: string;
  redirectTo?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">Delete this series?</span>
      <Button
        variant="destructive"
        size="sm"
        onClick={async () => {
          await deleteRecurrenceAction(recurrenceId);
          if (redirectTo) {
            router.push(redirectTo);
          }
        }}
      >
        Yes
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        No
      </Button>
    </div>
  );
}
