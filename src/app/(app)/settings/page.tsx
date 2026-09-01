import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { requireRoleOrRedirect } from "@/lib/auth/guards";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  await requireRoleOrRedirect("admin");

  const db = getDb();
  const rows = await db.select().from(companies).limit(1);
  const company = rows[0];

  if (!company) {
    return (
      <p className="text-sm text-muted-foreground">
        No company record exists yet — run{" "}
        <code className="rounded bg-muted px-1">pnpm db:seed</code> first.
      </p>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Company settings</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        This information appears on quotes, invoices, and anywhere else a
        customer sees your branding.
      </p>
      <SettingsForm company={company} />
    </div>
  );
}
