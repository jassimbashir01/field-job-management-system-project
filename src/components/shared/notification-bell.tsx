"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLiveNotifications } from "@/components/shared/live-provider";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getNotificationSnapshotAction,
  markAllReadFromMenuAction,
  markNotificationReadAction,
  type SnapshotResult,
} from "@/app/(app)/notifications/actions";

const formatWhen = (iso: string) =>
  `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

const isInternalPath = (href: string | null): href is string =>
  Boolean(href && href.startsWith("/") && !href.startsWith("//"));

export function NotificationBell() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { notifications: snapshot, setNotifications } = useLiveNotifications();
  const [error, setError] = useState<string | null>(null);

  function apply(result: SnapshotResult) {
    if (result.success && result.snapshot) {
      setNotifications(result.snapshot);
      setError(null);
    } else {
      setError(result.error?.message ?? "Couldn't load notifications.");
    }
  }

  const label =
    snapshot.unreadCount > 0
      ? `Notifications, ${snapshot.unreadCount} unread`
      : "Notifications, none unread";

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return;
        startTransition(async () =>
          apply(await getNotificationSnapshotAction()),
        );
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className="relative"
          >
            <Bell className="size-4" />
            {snapshot.unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
                {snapshot.unreadCount > 99 ? "99+" : snapshot.unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="w-96 max-w-[calc(100vw-1rem)]"
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">Notifications</span>
          {snapshot.unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () =>
                  apply(await markAllReadFromMenuAction()),
                )
              }
            >
              Mark all as read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {error && (
          <p role="alert" className="px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {snapshot.items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing yet. You&apos;ll be notified here when a customer pays or
            responds to a quote.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {snapshot.items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex-col items-start gap-0.5 px-3 py-2"
                onClick={() => {
                  const target = isInternalPath(item.href) ? item.href : null;
                  startTransition(async () => {
                    const result = await markNotificationReadAction(item.id);
                    apply(result);
                    if (target) router.push(target);
                  });
                }}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {!item.read && (
                    <span
                      className="inline-block size-2 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  )}
                  {item.title}
                </span>
                {item.body && (
                  <span className="text-xs text-muted-foreground">
                    {item.body}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {formatWhen(item.createdAt)}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <div className="flex items-center justify-between">
          <DropdownMenuItem
            render={<Link href="/notifications">View all</Link>}
            className="text-sm underline"
          />
          <DropdownMenuItem
            render={<Link href="/notifications/preferences">Preferences</Link>}
            className="text-sm underline"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
