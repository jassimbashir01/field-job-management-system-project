import { env } from "@/lib/env";

/**
 * Called once at server boot (instrumentation.ts). If STORAGE_DRIVER
 * is "s3" but any of the S3_* variables are missing, fail loudly right
 * now — before the first request, let alone the first upload attempt —
 * rather than let s3-driver.ts's `!` assertions (Section 16.2) throw a
 * confusing runtime error deep inside the first real upload. Same
 * "fail fast at startup" reasoning Phase 2 established for env.ts
 * itself, applied to a cross-field requirement Zod's flat schema can't
 * express on its own.
 */
export function assertStorageConfigured(): void {
  if (env.STORAGE_DRIVER !== "s3") return;

  const missing = (
    [
      ["S3_ENDPOINT", env.S3_ENDPOINT],
      ["S3_BUCKET", env.S3_BUCKET],
      ["S3_ACCESS_KEY_ID", env.S3_ACCESS_KEY_ID],
      ["S3_SECRET_ACCESS_KEY", env.S3_SECRET_ACCESS_KEY],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `STORAGE_DRIVER is "s3" but ${missing.join(", ")} ${
        missing.length === 1 ? "is" : "are"
      } not set. Set every S3_* variable in .env.local, or set STORAGE_DRIVER=db to use the zero-config local driver instead.`,
    );
  }
}
