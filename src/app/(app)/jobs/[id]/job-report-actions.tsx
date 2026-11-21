"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { emailJobReportAction } from "../report-actions";

type Notice = { kind: "success" | "error"; text: string };

export function JobReportActions({
  jobId,
  canEmail,
  customerEmail,
  emailEnabled,
}: {
  jobId: string;
  canEmail: boolean;
  customerEmail: string | null;
  emailEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const emailReady = emailEnabled && Boolean(customerEmail);

  return (
    <div className="space-y-2 rounded-md border p-4">
      <h2 className="text-sm font-semibold">Job report</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a href={`/api/jobs/${jobId}/report`} download>
              Download report (PDF)
            </a>
          }
        />
        {canEmail && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !emailReady}
            onClick={() => setConfirming((open) => !open)}
          >
            {isPending ? "Sending…" : "Email report to customer…"}
          </Button>
        )}
      </div>

      {confirming && canEmail && customerEmail && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <p className="text-sm">
            Email the job report to <strong>{customerEmail}</strong>?
          </p>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              setNotice(null);
              setConfirming(false);
              startTransition(async () => {
                const result = await emailJobReportAction(jobId);
                if (result.success) {
                  setNotice({
                    kind: "success",
                    text: `Emailed to ${customerEmail}.`,
                  });
                  router.refresh();
                } else {
                  setNotice({
                    kind: "error",
                    text: result.error?.message ?? "Couldn't send the email.",
                  });
                }
              });
            }}
          >
            Yes, send it
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {canEmail && !emailEnabled && (
        <p className="text-sm text-muted-foreground">
          Emailing isn&apos;t set up on this server yet. You can still download
          the report and send it yourself.
        </p>
      )}
      {canEmail && emailEnabled && !customerEmail && (
        <p className="text-sm text-muted-foreground">
          Add an email address to this customer to enable emailing the report.
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
