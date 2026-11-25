"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTimeRange, type ShiftState } from "@/lib/rota";
import { deleteShiftAction, saveShiftAction } from "./actions";

export interface CellShift {
  id: string;
  startTime: string;
  endTime: string;
  note: string | null;
  state: ShiftState;
}

const STATE_LABEL: Record<ShiftState, string | null> = {
  draft: "Draft",
  changed: "Changed",
  published: null,
  cancelled: "Cancelled",
};

const STATE_CLASS: Record<ShiftState, string> = {
  draft: "border-dashed",
  changed: "border-l-4",
  published: "",
  cancelled: "text-muted-foreground line-through",
};

type Mode =
  { kind: "view" } | { kind: "add" } | { kind: "edit"; shift: CellShift };

export function RotaCell({
  userId,
  personName,
  date,
  shifts,
  canWrite,
  onHoliday,
}: {
  userId: string;
  personName: string;
  date: string;
  shifts: CellShift[];
  canWrite: boolean;
  onHoliday: boolean;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [note, setNote] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = (next: Mode) => {
    setError(null);
    setInfo(null);
    setWarning(null);
    if (next.kind === "edit") {
      setStart(next.shift.startTime);
      setEnd(next.shift.endTime);
      setNote(next.shift.note ?? "");
    } else if (next.kind === "add") {
      setStart("09:00");
      setEnd("17:00");
      setNote("");
      setRepeatWeeks("1");
    }
    setMode(next);
  };

  const save = (confirmHoliday = false) =>
    startTransition(async () => {
      setError(null);
      setWarning(null);
      const result = await saveShiftAction({
        ...(mode.kind === "edit" ? { id: mode.shift.id } : {}),
        userId,
        date,
        startTime: start,
        endTime: end,
        note,
        repeatWeeks: mode.kind === "add" ? Number(repeatWeeks) : 1,
        confirmHoliday,
      });
      if (result.warning) {
        setWarning(result.warning);
      } else if (result.success) {
        setInfo(result.message);
        setMode({ kind: "view" });
      } else {
        setError(result.error?.message ?? "Couldn't save the shift.");
      }
    });

  const remove = (id: string) =>
    startTransition(async () => {
      setError(null);
      const result = await deleteShiftAction(id);
      if (result.success) {
        setInfo(result.message);
        setMode({ kind: "view" });
      } else {
        setError(result.error?.message ?? "Couldn't remove the shift.");
      }
    });

  return (
    <div className="space-y-1">
      {onHoliday && (
        <p className="rounded-md border border-dashed bg-muted px-1.5 py-1 text-xs font-medium text-muted-foreground">
          On holiday
        </p>
      )}
      {shifts.map((shift) => {
        const label = STATE_LABEL[shift.state];
        const body = (
          <>
            <span className="font-medium">
              {formatTimeRange(shift.startTime, shift.endTime)}
            </span>
            {label && (
              <span className="ml-1 text-muted-foreground">· {label}</span>
            )}
            {shift.note && (
              <span className="block text-muted-foreground">{shift.note}</span>
            )}
          </>
        );
        const className = `block w-full rounded-md border p-1.5 text-left text-xs ${STATE_CLASS[shift.state]}`;
        return canWrite && shift.state !== "cancelled" ? (
          <button
            key={shift.id}
            type="button"
            className={`${className} hover:bg-muted`}
            aria-label={`Edit ${personName}'s shift ${formatTimeRange(shift.startTime, shift.endTime)} on ${date}`}
            onClick={() => open({ kind: "edit", shift })}
          >
            {body}
          </button>
        ) : (
          <div key={shift.id} className={className}>
            {body}
          </div>
        );
      })}

      {mode.kind === "view" && canWrite && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline hover:text-foreground"
          aria-label={`Add a shift for ${personName} on ${date}`}
          onClick={() => open({ kind: "add" })}
        >
          + Add
        </button>
      )}

      {mode.kind !== "view" && (
        <div className="space-y-1 rounded-md border p-2 text-xs">
          <div className="flex items-center gap-1">
            <Input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-label="Start time"
              className="h-7 px-1 text-xs"
            />
            <span>–</span>
            <Input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-label="End time"
              className="h-7 px-1 text-xs"
            />
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Note"
            maxLength={200}
            className="h-7 px-1 text-xs"
          />
          {mode.kind === "add" && (
            <select
              value={repeatWeeks}
              onChange={(e) => setRepeatWeeks(e.target.value)}
              aria-label="Repeat"
              className="w-full rounded border px-1 py-1 text-xs"
            >
              <option value="1">Just this day</option>
              {[2, 3, 4, 6, 8, 12].map((weeks) => (
                <option key={weeks} value={weeks}>
                  Repeat weekly for {weeks} weeks
                </option>
              ))}
            </select>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {warning && (
            <p role="alert" className="font-medium">
              {warning}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {warning ? (
              <Button size="sm" disabled={isPending} onClick={() => save(true)}>
                {isPending ? "Saving…" : "Save anyway"}
              </Button>
            ) : (
              <Button size="sm" disabled={isPending} onClick={() => save()}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setMode({ kind: "view" })}
            >
              Cancel
            </Button>
            {mode.kind === "edit" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => remove(mode.shift.id)}
              >
                {mode.shift.state === "draft" ? "Remove" : "Cancel shift"}
              </Button>
            )}
          </div>
        </div>
      )}

      {info && mode.kind === "view" && (
        <p role="status" className="text-xs text-muted-foreground">
          {info}
        </p>
      )}
    </div>
  );
}
