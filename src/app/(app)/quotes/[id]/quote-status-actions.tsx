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
import { emailQuoteAction } from "../email-actions";

type Notice = { kind: "success" | "error"; text: string };

const SELECT_CLASS =
  "border-input bg-background h-9 rounded-md border px-3 text-sm";

export function QuoteStatusActions({
  quote,
  canWrite,
  customerEmail,
  emailEnabled,
}: {
  quote: typeof quotes.$inferSelect;
  canWrite: boolean;
  customerEmail: string | null;
  emailEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [emailMode, setEmailMode] = useState<"link" | "pdf">("link");
  const [shared, setShared] = useState(false);
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

  const downloadButton = (
    <Button
      variant="outline"
      nativeButton={false}
      render={
        <a
          href={`/api/quotes/${quote.id}/pdf`}
          download
          onClick={() => setShared(true)}
        >
          Download PDF
        </a>
      }
    />
  );

  if (!canWrite) return <div>{downloadButton}</div>;

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
    setConfirmingEmail(false);
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
      setShared(true);
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
  const canEmail = isDraft || canRespond;
  const emailReady = emailEnabled && Boolean(customerEmail);
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

        {downloadButton}

        {canEmail && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !emailReady}
            onClick={() => setConfirmingEmail((open) => !open)}
          >
            {busy("email")
              ? "Sending…"
              : isDraft
                ? "Email to customer…"
                : "Email again…"}
          </Button>
        )}

        {isDraft && (
          <Button
            type="button"
            disabled={isPending || !shared}
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
              setConfirmingEmail(false);
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

      {confirmingEmail && canEmail && customerEmail && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <p className="text-sm">
            Email this quote to <strong>{customerEmail}</strong>
            {isDraft && " and mark it as sent"}?
          </p>
          <select
            aria-label="What to email"
            className={SELECT_CLASS}
            value={emailMode}
            disabled={isPending}
            onChange={(e) =>
              setEmailMode(e.target.value === "pdf" ? "pdf" : "link")
            }
          >
            <option value="link">A link to the quote page</option>
            <option value="pdf">The PDF attached (no link)</option>
          </select>
          <Button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                "email",
                () => emailQuoteAction(quote.id, emailMode),
                `Emailed to ${customerEmail}.`,
                "Couldn't send the email.",
              )
            }
          >
            Yes, send it
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmingEmail(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {canEmail && !emailEnabled && (
        <p className="text-sm text-muted-foreground">
          Emailing isn&apos;t set up on this server yet. You can still copy the
          link or download the PDF and send it yourself.
        </p>
      )}
      {canEmail && emailEnabled && !customerEmail && (
        <p className="text-sm text-muted-foreground">
          Add an email address to this customer to enable &ldquo;Email to
          customer&rdquo;.
        </p>
      )}
      {isDraft && !shared && (
        <p className="text-sm text-muted-foreground">
          Copy the public link or download the PDF first, send it to the
          customer, then mark this quote as sent. (Emailing does both for you.)
          The link only works once the quote is marked as sent.
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
