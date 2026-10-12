"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { quotes } from "@/db/schema";
import {
  duplicateQuoteAction,
  markQuoteSentAction,
  setQuoteResponseManuallyAction,
} from "../actions";

type Notice = { kind: "success" | "error"; text: string };

export function QuoteStatusActions({
  quote,
  canWrite,
}: {
  quote: typeof quotes.$inferSelect;
  canWrite: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
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
        `${window.location.origin}/q/${quote.publicToken}`,
      );
      setLinkCopied(true);
      setJustCopied(true);
      setNotice({
        kind: "success",
        text:
          quote.status === "draft"
            ? "Link copied. It goes live once you mark this quote as sent."
            : "Link copied.",
      });
    } catch {
      setNotice({
        kind: "error",
        text: "Couldn't copy the link automatically. Check your browser's clipboard permission and try again.",
      });
    }
  }

  const isDraft = quote.status === "draft";
  const canRespond = quote.status === "sent" || quote.status === "viewed";
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
                () => markQuoteSentAction(quote.id),
                "Marked as sent — the public link is now live.",
                "Couldn't mark this as sent.",
              )
            }
          >
            {busy("send") ? "Marking as sent…" : "Mark as sent"}
          </Button>
        )}

        {canRespond && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                run(
                  "accept",
                  () => setQuoteResponseManuallyAction(quote.id, "accepted"),
                  "Marked as accepted — a Draft job was created from this quote.",
                  "Couldn't mark this as accepted.",
                )
              }
            >
              {busy("accept")
                ? "Marking as accepted…"
                : "Mark as accepted (manual)"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                run(
                  "decline",
                  () => setQuoteResponseManuallyAction(quote.id, "declined"),
                  "Marked as declined.",
                  "Couldn't mark this as declined.",
                )
              }
            >
              {busy("decline")
                ? "Marking as declined…"
                : "Mark as declined (manual)"}
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
              setActiveAction("duplicate");
              startTransition(async () => {
                const result = await duplicateQuoteAction(quote.id);
                if (result.success && result.newQuoteId) {
                  setNotice({
                    kind: "success",
                    text: "Duplicated — opening the new draft…",
                  });
                  router.push(`/quotes/${result.newQuoteId}`);
                } else {
                  setNotice({
                    kind: "error",
                    text:
                      result.error?.message ?? "Couldn't duplicate this quote.",
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

      {isDraft && !linkCopied && (
        <p className="text-sm text-muted-foreground">
          Copy the public link first, share it with the customer, then mark this
          quote as sent. The link only works once the quote is marked as sent.
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
