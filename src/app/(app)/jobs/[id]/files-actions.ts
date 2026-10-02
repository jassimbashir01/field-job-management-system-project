"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobFiles } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { logActivity } from "@/lib/activity-log";
import {
  NotFoundError,
  ValidationError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";
import {
  generateStorageKey,
  getStorageDriver,
  validateUploadedFile,
} from "@/lib/storage";

export interface UploadFormState {
  success: boolean;
  error: SafeError | null;
}

export async function uploadJobFileAction(
  jobId: string,
  _prevState: UploadFormState,
  formData: FormData,
): Promise<UploadFormState> {
  try {
    const user = await requirePermission(PERMISSIONS.JOBS_WRITE);

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("Choose a file to upload.");
    }
    const captionRaw = formData.get("caption");
    const caption =
      typeof captionRaw === "string" && captionRaw.trim()
        ? captionRaw.trim()
        : null;

    const { bytes, contentType } = await validateUploadedFile(file);

    const storageKey = generateStorageKey(jobId);
    await getStorageDriver().put(storageKey, bytes, contentType);

    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.insert(jobFiles).values({
        jobId,
        storageKey,
        fileName: file.name.slice(0, 255),
        contentType,
        sizeBytes: bytes.byteLength,
        caption,
        uploadedByUserId: user.id,
        uploadedByDisplayName: user.displayName,
      });
      await logActivity({
        entityType: "job",
        entityId: jobId,
        action: "file_uploaded",
        actor: user,
        summary: `uploaded ${file.name}`,
        tx,
      });
    });

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}

export async function deleteJobFileAction(
  jobId: string,
  fileId: string,
): Promise<void> {
  const user = await requirePermission(PERMISSIONS.JOBS_WRITE);

  const db = getDb();
  const [file] = await db
    .select({
      id: jobFiles.id,
      jobId: jobFiles.jobId,
      storageKey: jobFiles.storageKey,
      fileName: jobFiles.fileName,
    })
    .from(jobFiles)
    .where(eq(jobFiles.id, fileId))
    .limit(1);

  if (!file || file.jobId !== jobId) {
    throw new NotFoundError();
  }
  await db.delete(jobFiles).where(eq(jobFiles.id, fileId));
  await getStorageDriver().delete(file.storageKey);

  await logActivity({
    entityType: "job",
    entityId: jobId,
    action: "file_deleted",
    actor: user,
    summary: `removed ${file.fileName}`,
  });

  revalidatePath(`/jobs/${jobId}`);
}
