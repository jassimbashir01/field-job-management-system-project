"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { relevantKeys } from "@/lib/live-routes";
import type { NotificationSnapshot } from "@/lib/notification-types";

const CHECK_MS = 60_000;

interface LiveContextValue {
  notifications: NotificationSnapshot;
  setNotifications: (next: NotificationSnapshot) => void;
}
const LiveContext = createContext<LiveContextValue | null>(null);

export function useLiveNotifications(): LiveContextValue {
  const value = useContext(LiveContext);
  if (!value)
    throw new Error("useLiveNotifications must be used inside <LiveProvider>.");
  return value;
}

const currentKey = () => `${window.location.pathname}${window.location.search}`;
const signature = (n: NotificationSnapshot) =>
  `${n.unreadCount}:${n.items[0]?.id ?? ""}`;

export function LiveProvider({
  initialNotifications,
  children,
}: {
  initialNotifications: NotificationSnapshot;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [seenInitial, setSeenInitial] = useState(initialNotifications);
  const [bannerPath, setBannerPath] = useState<string | null>(null);

  if (seenInitial !== initialNotifications) {
    setSeenInitial(initialNotifications);
    setNotifications(initialNotifications);
  }

  const pathnameRef = useRef(pathname);
  const lastStamps = useRef<Record<string, string> | null>(null);
  const lastNotifSignature = useRef(signature(initialNotifications));
  const pending = useRef(false);
  const dirtyKey = useRef<string | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
    pending.current = false;
    dirtyKey.current = null;
  }, [pathname]);

  const refreshNow = useCallback(() => {
    pending.current = false;
    dirtyKey.current = null;
    setBannerPath(null);
    router.refresh();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const visible = () => document.visibilityState === "visible";

    const applyPending = () => {
      if (!pending.current) return;
      if (dirtyKey.current === currentKey()) {
        setBannerPath(pathnameRef.current);
      } else {
        refreshNow();
      }
    };

    async function check() {
      if (cancelled || stopped.current) return;
      const hidden = !visible();
      try {
        const response = await fetch(
          hidden ? "/api/live?scope=notifications" : "/api/live",
          { cache: "no-store" },
        );
        if (response.status === 401 || response.status === 403) {
          stopped.current = true;
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as {
          stamps?: Record<string, string>;
          notifications: NotificationSnapshot;
        };

        setNotifications(data.notifications);

        let changed = false;
        const keys = relevantKeys(pathnameRef.current);

        const sig = signature(data.notifications);
        if (sig !== lastNotifSignature.current) {
          lastNotifSignature.current = sig;
          if (keys.includes("notifications")) changed = true;
        }

        const stamps = data.stamps;
        if (stamps) {
          const previous = lastStamps.current;
          lastStamps.current = stamps;
          if (
            previous &&
            keys.some(
              (key) => key !== "notifications" && previous[key] !== stamps[key],
            )
          ) {
            changed = true;
          }
        }

        if (changed) pending.current = true;
        if (!hidden) applyPending();
      } catch {}
    }

    function loop() {
      if (cancelled) return;
      timer = setTimeout(async () => {
        await check();
        loop();
      }, CHECK_MS);
    }

    const onInput = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("main")) {
        dirtyKey.current = currentKey();
      }
    };
    const onSubmit = () => {
      dirtyKey.current = null;
    };
    const onVisible = () => {
      if (visible()) void check();
    };

    void check();
    loop();
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("input", onInput, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [refreshNow]);

  return (
    <LiveContext.Provider value={{ notifications, setNotifications }}>
      {children}
      {bannerPath === pathname && (
        <div
          role="status"
          className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-md border bg-background p-3 shadow-lg"
        >
          <p className="text-sm">
            This page has new changes. Refreshing now would discard what
            you&apos;ve typed.
          </p>
          <Button type="button" size="sm" onClick={refreshNow}>
            Refresh
          </Button>
        </div>
      )}
    </LiveContext.Provider>
  );
}
