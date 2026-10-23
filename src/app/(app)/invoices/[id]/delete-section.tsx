"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { invoices } from "@/db/schema";
import { deleteInvoiceAction } from "../actions";

export function InvoiceDeleteSection({
  invoice,
  canDelete,
}: {
  invoice: typeof invoices.$inferSelect;
  canDelete: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!canDelete) return null;

  if (invoice.status !== "draft" && invoice.status !== "void") {
    return (
      <div>
        <h2 className="text-sm font-semibold">Delete invoice</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {invoice.status === "paid"
            ? "A paid invoice is a permanent record and can't be deleted."
            : "Only Draft or Void invoices can be deleted. Void this invoice first if it was sent by mistake."}
        </p>
      </div>
    );
  }

  if (!confirming) {
    return (
      <div>
        <h2 className="text-sm font-semibold">Delete invoice</h2>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Permanent — cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete {invoice.title}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Delete invoice</h2>
      <p className="text-xs text-muted-foreground">
        Type <strong>{invoice.title}</strong> to confirm — this is permanent.
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
          disabled={confirmText !== invoice.title || isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await deleteInvoiceAction(invoice.id);
              if (result.success) {
                router.push("/invoices");
              } else {
                setError(
                  result.error?.message ?? "Couldn't delete this invoice.",
                );
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
