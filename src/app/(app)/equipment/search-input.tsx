"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export function EquipmentSearchInput({
  defaultQuery,
}: {
  defaultQuery: string;
}) {
  const [query, setQuery] = useState(defaultQuery);

  return (
    <Input
      name="q"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search by name, manufacturer, model, serial number, or site…"
      className="max-w-sm"
    />
  );
}
