import { logger } from "../logger";
import { AppError } from "./app-error";

export interface SafeError {
  code: string;
  message: string;
}

interface PgLikeError {
  code?: string;
  detail?: string;
}

function isPgLikeError(error: unknown): error is PgLikeError {
  return typeof error === "object" && error !== null && "code" in error;
}

const REFERENCING_TABLE_LABELS: Record<string, string> = {
  jobs: "jobs",
  sites: "sites",
  equipment: "equipment",
  customer_contacts: "contacts",
};

export function toSafeError(error: unknown): SafeError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.userMessage };
  }

  if (isPgLikeError(error) && error.code === "23503") {
    const match = error.detail?.match(/is still referenced from table "(\w+)"/);
    const table = match?.[1];
    const what = table
      ? (REFERENCING_TABLE_LABELS[table] ?? table)
      : "other records";
    return {
      code: "CONFLICT",
      message: `Can't delete this — it still has ${what} attached. Remove or reassign those first.`,
    };
  }

  logger.error("Unhandled error", {
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
  });

  return {
    code: "INTERNAL_ERROR",
    message: "Something went wrong on our end. Please try again.",
  };
}
