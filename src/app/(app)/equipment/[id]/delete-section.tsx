"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { equipment } from "@/db/schema";
import { deleteEquipmentAction } from "../actions";

type Equipment = typeof equipment.$inferSelect;

export function EquipmentDeleteSection({
  equipment: equipmentItem,
  canDelete,
}: {
  equipment: Equipment;
  canDelete: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) return null;

  if (!confirming) {
    return (
      <div>
        <h2 className="text-sm font-semibold">Delete equipment</h2>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Permanent — cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete {equipmentItem.name}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Delete equipment</h2>
      <p className="text-xs text-muted-foreground">
        Type <strong>{equipmentItem.name}</strong> to confirm — this is
        permanent.
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
          disabled={confirmText !== equipmentItem.name || isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteEquipmentAction(equipmentItem.id);
              if (!result.success && result.error) {
                setError(result.error.message);
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
