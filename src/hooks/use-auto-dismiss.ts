"use client";

import { useEffect, useState } from "react";

export function useAutoDismiss(
  trigger: unknown,
  show: boolean,
  durationMs = 4000,
): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timer);
  }, [trigger, show, durationMs]);

  return visible;
}
