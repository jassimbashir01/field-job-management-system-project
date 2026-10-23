"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { invoices } from "@/db/schema";
import {
  duplicateInvoiceAction,
  markInvoicePaidAction,
  markInvoiceSentAction,
  markPaymentNotReceivedAction,
  voidInvoiceAction,
} from "../actions";

type Notice = { kind: "success" | "error"; text: string };

export function InvoiceStatusActions({
  invoice,
  canWrite,
}: {
  invoice: typeof invoices.$inferSelect;
  canWrite: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState<"paid" | "void" | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!justCopied) return;
    const timer = setTimeout(() => setJustCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [justCopied]);

  if (!canWrite) return null;

  function run(
    name: string,
    action: () => Promise<{
      success: boolean;
      error?: { message: string } | null;
    }>,
    successText: string,
    failureText: string,
  ) {
    setNotice(null);
    setConfirming(null);
    setActiveAction(name);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        setNotice({ kind: "success", text: successText });
        router.refresh();
      } else {
        setNotice({
          kind: "error",
          text: result.error?.message ?? failureText,
        });
      }
      setActiveAction(null);
    });
  }

  async function copyLink() {
    setNotice(null);
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/i/${invoice.publicToken}`,
      );
      setLinkCopied(true);
      setJustCopied(true);
      setNotice({
        kind: "success",
        text:
          invoice.status === "draft"
            ? "Link copied. It goes live once you mark this invoice as sent."
            : "Link copied.",
      });
    } catch {
      setNotice({
        kind: "error",
        text: "Couldn't copy the link automatically. Check your browser's clipboard permission and try again.",
      });
    }
  }

  const isDraft = invoice.status === "draft";
  const canSettle =
    invoice.status === "sent" ||
    invoice.status === "viewed" ||
    invoice.status === "payment_reported";
  const busy = (name: string) => isPending && activeAction === name;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={copyLink}
        >
          {justCopied ? "Copied ✓" : "Copy public link"}
        </Button>

        {isDraft && (
          <Button
            type="button"
            disabled={isPending || !linkCopied}
            onClick={() =>
              run(
                "send",
                () => markInvoiceSentAction(invoice.id),
                "Marked as sent — the public link is now live.",
                "Couldn't mark this as sent.",
              )
            }
          >
            {busy("send") ? "Marking as sent…" : "Mark as sent"}
          </Button>
        )}

        {canSettle && (
          <>
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                setConfirming(confirming === "paid" ? null : "paid")
              }
            >
              {busy("paid") ? "Marking as paid…" : "Mark as paid"}
            </Button>

            {invoice.status === "payment_reported" && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(
                    "not-received",
                    () => markPaymentNotReceivedAction(invoice.id),
                    "Marked as not received — the invoice is back to Viewed.",
                    "Couldn't reverse the reported payment.",
                  )
                }
              >
                {busy("not-received") ? "Updating…" : "Payment not received"}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                setConfirming(confirming === "void" ? null : "void")
              }
            >
              {busy("void") ? "Voiding…" : "Void invoice"}
            </Button>
          </>
        )}

        {!isDraft && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setNotice(null);
              setConfirming(null);
              setActiveAction("duplicate");
              startTransition(async () => {
                const result = await duplicateInvoiceAction(invoice.id);
                if (result.success && result.newInvoiceId) {
                  setNotice({
                    kind: "success",
                    text: "Duplicated — opening the new draft…",
                  });
                  router.push(`/invoices/${result.newInvoiceId}`);
                } else {
                  setNotice({
                    kind: "error",
                    text:
                      result.error?.message ??
                      "Couldn't duplicate this invoice.",
                  });
                }
                setActiveAction(null);
              });
            }}
          >
            {busy("duplicate") ? "Duplicating…" : "Duplicate as new draft"}
          </Button>
        )}
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <p className="text-sm">
            {confirming === "paid"
              ? "Mark this invoice as paid? A paid invoice can't be voided or deleted."
              : "Void this invoice? It stays on record, but the customer's link will show it as cancelled."}
          </p>
          <Button
            type="button"
            variant={confirming === "void" ? "destructive" : "default"}
            disabled={isPending}
            onClick={() =>
              confirming === "paid"
                ? run(
                    "paid",
                    () => markInvoicePaidAction(invoice.id),
                    "Marked as paid.",
                    "Couldn't mark this as paid.",
                  )
                : run(
                    "void",
                    () => voidInvoiceAction(invoice.id),
                    "Invoice voided.",
                    "Couldn't void this invoice.",
                  )
            }
          >
            {confirming === "paid" ? "Yes, mark as paid" : "Yes, void it"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirming(null)}
          >
            Cancel
          </Button>
        </div>
      )}

      {isDraft && !linkCopied && (
        <p className="text-sm text-muted-foreground">
          Copy the public link first, share it with the customer, then mark this
          invoice as sent. The link only works once the invoice is marked as
          sent, and it needs at least one payment option ticked and saved.
        </p>
      )}

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={
            notice.kind === "error"
              ? "text-sm text-destructive"
              : "text-sm text-green-600"
          }
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
