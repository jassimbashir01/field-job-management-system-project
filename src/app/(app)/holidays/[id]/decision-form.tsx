"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HolidayStatus } from "@/lib/holidays";
import { markLiveSaved } from "@/components/shared/live-provider";
import { decideHolidayAction, deleteHolidayAction } from "../actions";

export function DecisionForm({
  id,
  status,
  initialNote,
}: {
  id: string;
  status: HolidayStatus;
  initialNote: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const noteChanged = note.trim() !== (initialNote ?? "").trim();
  const canAccept = status !== "accepted" || noteChanged;
  const canReject = status !== "rejected" || noteChanged;

  const decide = (decision: "accepted" | "rejected") =>
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const result = await decideHolidayAction({
        id,
        decision,
        managerNote: note,
      });
      if (result.success) {
        setMessage(result.message);
        markLiveSaved();
      } else {
        setError(result.error?.message ?? "Couldn't save the decision.");
      }
    });

  const remove = () =>
    startTransition(async () => {
      setError(null);
      const result = await deleteHolidayAction(id);
      if (result.success) router.push("/holidays");
      else {
        setConfirmingDelete(false);
        setError(result.error?.message ?? "Couldn't delete the request.");
      }
    });

  return (
    <div className="max-w-md space-y-3">
      <div className="space-y-2">
        <Label htmlFor="managerNote">Note to the team member (optional)</Label>
        <Textarea
          id="managerNote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isPending || !canAccept}
          onClick={() => decide("accepted")}
        >
          {status === "accepted" ? "Update note and email again" : "Accept"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending || !canReject}
          onClick={() => decide("rejected")}
        >
          {status === "rejected" ? "Update note and email again" : "Reject"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Deciding emails the team member with your note.
        {status === "accepted" &&
          " It's accepted: you can reject it, or edit the note and email the update."}
        {status === "rejected" &&
          " It's rejected: you can accept it, or edit the note and email the update."}
      </p>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="border-t pt-3">
        {!confirmingDelete ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline hover:text-foreground"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete this request
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            Delete it for good
            {status === "accepted"
              ? " (the dates will no longer be blocked)"
              : ""}
            ?
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={remove}
            >
              Delete
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
            >
              Keep
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}
