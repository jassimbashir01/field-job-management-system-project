"use client";

import { useEffect, useState } from "react";

const ERROR_DURATION_MS = 12000;

export function useAutoDismiss(
  trigger: unknown,
  show: boolean,
  durationMs = 4000,
): boolean {
  const [dismissed, setDismissed] = useState<{ value: unknown } | null>(null);

  const isError =
    typeof trigger === "object" &&
    trigger !== null &&
    "error" in trigger &&
    Boolean((trigger as { error?: unknown }).error);
  const visibleMs = isError
    ? Math.max(durationMs, ERROR_DURATION_MS)
    : durationMs;

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setDismissed({ value: trigger }), visibleMs);
    return () => clearTimeout(timer);
  }, [trigger, show, visibleMs]);

  return show && !(dismissed !== null && Object.is(dismissed.value, trigger));
}
