import { logger } from "../logger";
import { AppError } from "./app-error";

export interface SafeError {
  code: string;
  message: string;
}

export function toSafeError(error: unknown): SafeError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.userMessage };
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
