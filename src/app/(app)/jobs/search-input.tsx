"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export function JobSearchInput({ defaultQuery }: { defaultQuery: string }) {
  const [query, setQuery] = useState(defaultQuery);

  return (
    <Input
      name="q"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search by job #, customer, site, technician, type, or reference…"
      className="max-w-sm"
    />
  );
}
