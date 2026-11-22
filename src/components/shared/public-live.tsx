"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 60_000;

export function PublicLive({
  kind,
  token,
}: {
  kind: "quote" | "invoice";
  token: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const base = kind === "quote" ? "q" : "i";
    let last: string | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const response = await fetch(
          `/${base}/${encodeURIComponent(token)}/live`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok) return;
        const { stamp } = (await response.json()) as { stamp: string | null };
        if (stamp && last !== null && stamp !== last) router.refresh();
        if (stamp) last = stamp;
      } catch {}
    }

    function loop() {
      timer = setTimeout(async () => {
        await check();
        if (!cancelled) loop();
      }, INTERVAL_MS);
    }

    void check();
    loop();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [kind, token, router]);

  return null;
}
