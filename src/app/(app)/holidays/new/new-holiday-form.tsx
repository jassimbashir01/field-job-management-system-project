"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createHolidayAction } from "../actions";

export function NewHolidayForm({
  people,
}: {
  people: Array<{ id: string; displayName: string }>;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await createHolidayAction({
        userId,
        startDate,
        endDate,
        note,
      });
      if (result.success && result.id) {
        router.push(`/holidays/${result.id}`);
      } else {
        setError(result.error?.message ?? "Couldn't record the request.");
      }
    });

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="userId">Team member</Label>
        <select
          id="userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full rounded-md border px-2 py-2 text-sm"
        >
          <option value="">Choose…</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="startDate">First day</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Last day</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Leave the last day blank for a single day.
      </p>
      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="button" disabled={isPending} onClick={submit}>
        {isPending ? "Saving…" : "Record request"}
      </Button>
    </div>
  );
}
