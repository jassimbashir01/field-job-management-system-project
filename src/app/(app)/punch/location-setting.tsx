"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setPunchLocationAction } from "./actions";

export function LocationSetting({ enabled }: { enabled: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const result = await setPunchLocationAction(!enabled);
      if (result.success) setMessage(result.message);
      else setError(result.error?.message ?? "Couldn't change the setting.");
    });

  return (
    <div className="rounded-md border p-4">
      <h2 className="text-sm font-semibold">Location capture</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        When on, a team member&apos;s phone is asked for its position each time
        they punch in or out. If the phone says no, the punch still works and is
        marked &ldquo;location unavailable&rdquo;. Currently{" "}
        <strong>{enabled ? "on" : "off"}</strong>.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3"
        disabled={isPending}
        onClick={toggle}
      >
        {isPending ? "Saving…" : enabled ? "Turn off" : "Turn on"}
      </Button>
      {message && (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
