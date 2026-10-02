import "server-only";
import { env } from "@/lib/env";
import { dbDriver } from "./db-driver";
import { s3Driver } from "./s3-driver";

export type { StorageDriver, StoredObject } from "./types";
export {
  ALLOWED_CONTENT_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateUploadedFile,
} from "./validate-file";

export function getStorageDriver() {
  return env.STORAGE_DRIVER === "s3" ? s3Driver : dbDriver;
}

export function generateStorageKey(jobId: string): string {
  return `job-files/${jobId}/${crypto.randomUUID()}`;
}
