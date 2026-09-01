"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      logger.error("Unhandled error reached the boundary", {
        message: error.message,
        stack: error.stack,
        digest: error.digest,
      });
    } else {
      logger.error("Unhandled error reached the boundary", {
        digest: error.digest,
      });
    }
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please try again. If this keeps happening, contact support
          {error.digest && ` and mention error ID ${error.digest}`}.
        </p>
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </main>
  );
}
