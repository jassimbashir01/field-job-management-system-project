"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PaidPanel({
  token,
  paidOn,
  companyName,
  contactEmail,
  contactPhone,
  accent,
}: {
  token: string;
  paidOn: string | null;
  companyName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  accent: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/i/${encodeURIComponent(token)}/pdf`, {
        cache: "no-store",
      });
      if (!response.ok) {
        let message =
          "Couldn't generate the PDF. Please try again in a moment.";
        try {
          const body = (await response.json()) as {
            error?: { message?: string };
          };
          if (body.error?.message) message = body.error.message;
        } catch {}
        setError(message);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "invoice.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone(true);
    } catch {
      setError(
        "Couldn't generate the PDF. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const accentStyle = accent ? { color: accent } : undefined;
  const contact = [contactPhone, contactEmail].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3 rounded-md border p-4 text-center text-sm">
      {done ? (
        <>
          <p className="text-base font-semibold" style={accentStyle}>
            Thank you for your business
          </p>
          <p>
            Your invoice PDF has been downloaded. We appreciate you choosing{" "}
            {companyName}.
          </p>
          {contact && <p className="text-muted-foreground">{contact}</p>}
        </>
      ) : (
        <p>
          <strong>Paid — thank you.</strong>
          {paidOn && ` Payment was confirmed on ${paidOn}.`}
        </p>
      )}

      <Button
        type="button"
        variant={done ? "outline" : "default"}
        disabled={busy}
        onClick={generate}
      >
        {busy ? "Generating…" : done ? "Download again" : "Generate PDF"}
      </Button>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
