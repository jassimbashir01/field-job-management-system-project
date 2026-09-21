"use client";

import { useState, useTransition } from "react";
import { toggleChecklistItemAction } from "@/app/(app)/jobs/actions";

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export function JobChecklist({
  jobId,
  items,
  disabled,
}: {
  jobId: string;
  items: ChecklistItem[];
  disabled?: boolean;
}) {
  const [localItems, setLocalItems] = useState(items);
  const [, startTransition] = useTransition();

  if (localItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Checklist</h2>
      <div className="space-y-1">
        {localItems.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.completed}
              disabled={disabled}
              onChange={(e) => {
                const completed = e.target.checked;
                setLocalItems((prev) =>
                  prev.map((i) => (i.id === item.id ? { ...i, completed } : i)),
                );
                startTransition(async () => {
                  const result = await toggleChecklistItemAction(
                    item.id,
                    jobId,
                    completed,
                  );
                  if (!result.success) {
                    setLocalItems((prev) =>
                      prev.map((i) =>
                        i.id === item.id ? { ...i, completed: !completed } : i,
                      ),
                    );
                  }
                });
              }}
              className="size-4"
            />
            <span
              className={
                item.completed ? "text-muted-foreground line-through" : ""
              }
            >
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
