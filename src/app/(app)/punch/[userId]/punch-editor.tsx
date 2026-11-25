"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPunchAction, deletePunchAction, editPunchAction } from "../actions";

export function AddPunch({
  userId,
  defaultDay,
}: {
  userId: string;
  defaultDay: string;
}) {
  const [open, setOpen] = useState(false);
  const [punchedIn, setPunchedIn] = useState(`${defaultDay}T09:00`);
  const [punchedOut, setPunchedOut] = useState(`${defaultDay}T17:00`);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        Add a missed punch
      </Button>
    );
  }

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await addPunchAction({
        userId,
        punchedIn,
        punchedOut,
        reason,
      });
      if (result.success) {
        setOpen(false);
        setReason("");
      } else {
        setError(result.error?.message ?? "Couldn't add the punch.");
      }
    });

  return (
    <div className="max-w-md space-y-2 rounded-md border p-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Punched in</span>
          <Input
            type="datetime-local"
            value={punchedIn}
            onChange={(e) => setPunchedIn(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Punched out</span>
          <Input
            type="datetime-local"
            value={punchedOut}
            onChange={(e) => setPunchedOut(e.target.value)}
          />
        </label>
      </div>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        aria-label="Reason"
        maxLength={300}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={save}>
          {isPending ? "Saving…" : "Add punch"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PunchActions({
  id,
  inInput,
  outInput,
}: {
  id: string;
  inInput: string;
  outInput: string | null;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [punchedIn, setPunchedIn] = useState(inInput);
  const [punchedOut, setPunchedOut] = useState(outInput ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setMode("view");
    setError(null);
    setReason("");
  };

  const run = (
    task: () => Promise<{
      success: boolean;
      error: { message: string } | null;
    }>,
  ) =>
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (result.success) close();
      else setError(result.error?.message ?? "Something went wrong.");
    });

  if (mode === "view") {
    return (
      <span className="flex gap-3 text-xs">
        <button
          type="button"
          className="underline"
          onClick={() => {
            setPunchedIn(inInput);
            setPunchedOut(outInput ?? "");
            setMode("edit");
          }}
        >
          Edit
        </button>
        <button
          type="button"
          className="underline"
          onClick={() => setMode("delete")}
        >
          Delete
        </button>
      </span>
    );
  }

  return (
    <div className="mt-2 max-w-md space-y-2 rounded-md border p-3 text-sm">
      {mode === "edit" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Punched in</span>
            <Input
              type="datetime-local"
              value={punchedIn}
              onChange={(e) => setPunchedIn(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">
              Punched out (blank = still in)
            </span>
            <Input
              type="datetime-local"
              value={punchedOut}
              onChange={(e) => setPunchedOut(e.target.value)}
            />
          </label>
        </div>
      )}
      {mode === "delete" && (
        <p>Delete this punch? The record of it stays in the history.</p>
      )}
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        aria-label="Reason"
        maxLength={300}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {mode === "edit" ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(() => editPunchAction({ id, punchedIn, punchedOut, reason }))
            }
          >
            {isPending ? "Saving…" : "Save change"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => deletePunchAction({ id, reason }))}
          >
            {isPending ? "Deleting…" : "Delete punch"}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={close}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
