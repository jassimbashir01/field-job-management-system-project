import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobFiles } from "@/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { AppError, toSafeError } from "@/lib/errors";
import { getStorageDriver } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    await requirePermission(PERMISSIONS.JOBS_READ);

    const { id: jobId, fileId } = await params;

    const db = getDb();
    const [file] = await db
      .select({
        jobId: jobFiles.jobId,
        storageKey: jobFiles.storageKey,
        fileName: jobFiles.fileName,
        contentType: jobFiles.contentType,
      })
      .from(jobFiles)
      .where(eq(jobFiles.id, fileId))
      .limit(1);

    if (!file || file.jobId !== jobId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const object = await getStorageDriver().get(file.storageKey);
    if (!object) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(object.data as BodyInit, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.userMessage },
        { status: error.httpStatus },
      );
    }
    const safe = toSafeError(error);
    return NextResponse.json({ error: safe.message }, { status: 500 });
  }
}
