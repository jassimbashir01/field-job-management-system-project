import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { NotFoundError } from "@/lib/errors";
import { renderJobReportPdf } from "@/lib/pdf/job-report-pdf";
import { loadJobReport } from "@/lib/pdf/load-job-report";
import { pdfErrorResponse, pdfResponse } from "@/lib/pdf/response";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(PERMISSIONS.JOBS_READ);
    const { id } = await params;
    if (!isUuid(id)) throw new NotFoundError("That job couldn't be found.");

    const loaded = await loadJobReport(id);
    if (!loaded) throw new NotFoundError("That job couldn't be found.");

    return pdfResponse(await renderJobReportPdf(loaded.model), loaded.fileName);
  } catch (error) {
    return pdfErrorResponse(error);
  }
}
