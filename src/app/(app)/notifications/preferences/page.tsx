import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getUserAccessLevels } from "@/lib/auth/permissions";
import {
  DEFAULT_EMAIL,
  DEFAULT_IN_APP,
  NOTIFICATION_CATEGORIES,
} from "@/lib/notification-categories";
import { getPreferenceMap } from "@/lib/notifications";
import { isEmailConfigured } from "@/lib/email";
import { PreferencesForm, type PreferenceRow } from "./preferences-form";

export const dynamic = "force-dynamic";

export default async function NotificationPreferencesPage() {
  const viewer = await requireUser();
  const [levels, saved] = await Promise.all([
    getUserAccessLevels(viewer),
    getPreferenceMap(viewer.id),
  ]);

  const rows: PreferenceRow[] = NOTIFICATION_CATEGORIES.filter(
    (c) =>
      viewer.role === "admin" ||
      levels[c.resourceKey] === "write" ||
      levels[c.resourceKey] === "delete",
  ).map((c) => ({
    key: c.key,
    label: c.label,
    inApp: saved.get(c.key)?.inApp ?? DEFAULT_IN_APP,
    email: saved.get(c.key)?.email ?? DEFAULT_EMAIL,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/notifications"
          className="text-sm text-muted-foreground underline"
        >
          ← Notifications
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Notification preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how you hear about each event. Email is off unless you turn it
          on, and goes to {viewer.email}.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to anything that sends notifications yet.
        </p>
      ) : (
        <PreferencesForm rows={rows} emailEnabled={isEmailConfigured()} />
      )}
    </div>
  );
}
