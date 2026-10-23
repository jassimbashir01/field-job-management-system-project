"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface LineItemRow {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function toCents(unitPrice: string): number {
  const value = Number.parseFloat(unitPrice);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function LineItemsInput({
  initialRows,
  disabled = false,
}: {
  initialRows: LineItemRow[];
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<LineItemRow[]>(
    initialRows.length > 0
      ? initialRows
      : [
          {
            key: crypto.randomUUID(),
            description: "",
            quantity: "1",
            unitPrice: "",
          },
        ],
  );
  const reactId = useId();

  function updateRow(key: string, patch: Partial<LineItemRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        description: "",
        quantity: "1",
        unitPrice: "",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.key !== key) : current,
    );
  }

  const totalCents = rows.reduce(
    (sum, row) =>
      sum +
      Math.round(
        Number.parseFloat(row.quantity || "0") * toCents(row.unitPrice),
      ) /
        100,
    0,
  );

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="lineItems"
        value={JSON.stringify(
          rows.map((row) => ({
            description: row.description,
            quantity: row.quantity,
            unitPriceCents: toCents(row.unitPrice),
          })),
        )}
      />

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.key} className="flex items-start gap-2">
            <Input
              aria-label={`Line ${index + 1} description`}
              placeholder="Description"
              value={row.description}
              disabled={disabled}
              onChange={(e) =>
                updateRow(row.key, { description: e.target.value })
              }
              className="flex-1"
            />
            <Input
              aria-label={`Line ${index + 1} quantity`}
              placeholder="Qty"
              inputMode="decimal"
              value={row.quantity}
              disabled={disabled}
              onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
              className="w-20"
            />
            <Input
              aria-label={`Line ${index + 1} unit price`}
              placeholder="Unit price"
              inputMode="decimal"
              value={row.unitPrice}
              disabled={disabled}
              onChange={(e) =>
                updateRow(row.key, { unitPrice: e.target.value })
              }
              className="w-28"
            />
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove line ${index + 1}`}
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" /> Add line
        </Button>
      )}

      <p className="text-sm text-muted-foreground" id={`${reactId}-total`}>
        Running total: {totalCents.toFixed(2)} (formatted properly once saved —
        this preview is plain arithmetic, not locale-aware)
      </p>
    </div>
  );
}
