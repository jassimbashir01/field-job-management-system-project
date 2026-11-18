import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface RelatedItem {
  id: string;
  href: string;
  label: string;
  sublabel?: string;
  badge: ReactNode;
  amount?: string;
}

export function RelatedDocuments({
  title,
  items,
  emptyText,
  newHref,
  newLabel,
}: {
  title: string;
  items: RelatedItem[];
  emptyText: string;
  newHref?: string;
  newLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {newHref && newLabel && (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={newHref}>{newLabel}</Link>}
            nativeButton={false}
          />
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="divide-y rounded-md border">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-accent"
            >
              <div>
                <p className="font-medium">{item.label}</p>
                {item.sublabel && (
                  <p className="text-xs text-muted-foreground">
                    {item.sublabel}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {item.badge}
                {item.amount && <span className="text-xs">{item.amount}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
