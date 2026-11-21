import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { NotFoundError } from "@/lib/errors";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { loadInvoicePdf } from "@/lib/pdf/load-document";
import { pdfErrorResponse, pdfResponse } from "@/lib/pdf/response";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(PERMISSIONS.INVOICES_READ);
    const { id } = await params;
    if (!isUuid(id)) throw new NotFoundError("That invoice couldn't be found.");

    const loaded = await loadInvoicePdf(id);
    if (!loaded) throw new NotFoundError("That invoice couldn't be found.");

    return pdfResponse(await renderDocumentPdf(loaded.model), loaded.fileName);
  } catch (error) {
    return pdfErrorResponse(error);
  }
}
