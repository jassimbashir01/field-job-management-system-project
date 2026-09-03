"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QuickActionConfig } from "@/lib/quick-actions-config";

export function QuickActions({ actions }: { actions: QuickActionConfig[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="fixed right-6 bottom-6 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              className="size-12 rounded-full shadow-lg"
              aria-label="Quick actions"
            >
              <Plus className="size-5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuGroup>
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.href}
                nativeButton={false}
                render={<Link href={action.href}>{action.label}</Link>}
              />
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
