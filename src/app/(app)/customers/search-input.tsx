"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export function CustomerSearchInput({
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
      placeholder="Search by name, company, phone, or email…"
      className="max-w-sm"
    />
  );
}
