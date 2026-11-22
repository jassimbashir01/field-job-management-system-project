import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/notifications";
import {
  markAllNotificationsReadAction,
  openNotificationAction,
} from "./actions";

export const dynamic = "force-dynamic";

const formatWhen = (date: Date) =>
  `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`;

export default async function NotificationsPage() {
  const viewer = await requireUser();
  const items = await listNotifications(viewer.id);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/notifications/preferences">Preferences</Link>}
          />
          {unread > 0 && (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="outline">
                Mark all as read
              </Button>
            </form>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. You&apos;ll be notified here when a customer pays or
          responds to a quote.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((n) => (
            <li key={n.id}>
              <form action={openNotificationAction}>
                <input type="hidden" name="id" value={n.id} />
                <button
                  type="submit"
                  className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-accent ${
                    n.readAt ? "" : "bg-muted/50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {!n.readAt && (
                      <span
                        className="inline-block size-2 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    )}
                    {n.title}
                  </span>
                  {n.body && (
                    <span className="text-sm text-muted-foreground">
                      {n.body}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(n.createdAt)}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
