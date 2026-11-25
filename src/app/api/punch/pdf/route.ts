import { requirePermission, requireUserOrThrow } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { renderAttendancePdf } from "@/lib/pdf/attendance-pdf";
import { loadAttendance } from "@/lib/pdf/load-attendance";
import { pdfErrorResponse, pdfResponse } from "@/lib/pdf/response";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewer = await requireUserOrThrow();
    const params = new URL(request.url).searchParams;
    const userId = params.get("userId") ?? "";
    if (!isUuid(userId))
      throw new NotFoundError("That team member couldn't be found.");

    if (viewer.id === userId) {
      if (viewer.role !== "team_member") throw new ForbiddenError();
    } else {
      await requirePermission(PERMISSIONS.PUNCH_READ);
    }

    const loaded = await loadAttendance(
      userId,
      params.get("from") ?? "",
      params.get("to") ?? "",
    );
    return pdfResponse(
      await renderAttendancePdf(loaded.model),
      loaded.fileName,
    );
  } catch (error) {
    return pdfErrorResponse(error);
  }
}
