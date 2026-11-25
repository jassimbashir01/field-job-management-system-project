"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { punchInAction, punchOutAction } from "./punch-actions";

interface Position {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

function getPosition(): Promise<Position | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracyMeters: p.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

export function PunchCard({
  openSince,
  openStale,
  locationEnabled,
}: {
  openSince: string | null;
  openStale: boolean;
  locationEnabled: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const punchedIn = openSince !== null;

  const press = () =>
    startTransition(async () => {
      setMessage(null);
      setError(null);
      // Location is best-effort: if the phone says no, the punch still goes through.
      const location = locationEnabled ? await getPosition() : null;
      const result = punchedIn
        ? await punchOutAction({ location })
        : await punchInAction({ location });
      if (result.success) setMessage(result.message);
      else setError(result.error?.message ?? "Couldn't record the punch.");
      router.refresh();
    });

  return (
    <div className="rounded-lg border p-5 text-center">
      <p className="text-sm font-medium">
        {punchedIn ? `Punched in since ${openSince}` : "Not punched in"}
      </p>
      {punchedIn && openStale && (
        <p role="alert" className="mt-1 text-xs font-medium">
          This has been running a long time. If you forgot to punch out, tell
          your manager.
        </p>
      )}
      <Button
        type="button"
        size="lg"
        variant={punchedIn ? "outline" : "default"}
        className="mt-4 h-16 w-full text-lg"
        disabled={isPending}
        onClick={press}
      >
        {isPending ? "Please wait…" : punchedIn ? "Punch out" : "Punch in"}
      </Button>
      {locationEnabled && (
        <p className="mt-2 text-xs text-muted-foreground">
          Your location is recorded when you punch. If your phone won&apos;t
          share it, the punch still works.
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
