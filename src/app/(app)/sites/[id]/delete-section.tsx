"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { sites } from "@/db/schema";
import { deleteSiteAction } from "../actions";

type Site = typeof sites.$inferSelect;

export function SiteDeleteSection({
  site,
  canDelete,
  blockers,
  blockersTotal,
  blockersSummary,
}: {
  site: Site;
  canDelete: boolean;
  blockers: { href: string; label: string }[];
  blockersTotal: number;
  blockersSummary: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) return null;

  if (blockersTotal > 0) {
    const remaining = blockersTotal - blockers.length;
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Delete site</h2>
        <p className="text-sm text-muted-foreground">
          Can&apos;t delete this site yet — {blockersSummary}{" "}
          {blockersTotal === 1 ? "is" : "are"} still linked to it:
        </p>
        {blockers.length > 0 && (
          <ul className="space-y-1 text-sm">
            {blockers.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {remaining > 0 && (
          <p className="text-xs text-muted-foreground">
            …and {remaining} more
            {blockers.length === 0 ? " you may not have access to see" : ""}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Delete or reassign these first, then come back here.
        </p>
      </div>
    );
  }

  if (!confirming) {
    return (
      <div>
        <h2 className="text-sm font-semibold">Delete site</h2>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Permanent — cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete {site.name}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Delete site</h2>
      <p className="text-xs text-muted-foreground">
        Type <strong>{site.name}</strong> to confirm — this is permanent.
      </p>
      <Input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="max-w-xs"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="destructive"
          disabled={confirmText !== site.name || isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteSiteAction(site.id);
              if (!result.success && result.error) {
                setError(result.error.message);
              }
            })
          }
        >
          {isPending ? "Deleting…" : "Confirm delete"}
        </Button>
        <Button variant="outline" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
