import { NotFoundError } from "@/lib/errors";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { loadPaidInvoicePdfByToken } from "@/lib/pdf/load-document";
import { pdfErrorResponse, pdfResponse } from "@/lib/pdf/response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
      throw new NotFoundError("That invoice couldn't be found.");
    }
    const loaded = await loadPaidInvoicePdfByToken(token);
    if (!loaded) throw new NotFoundError("That invoice couldn't be found.");

    return pdfResponse(await renderDocumentPdf(loaded.model), loaded.fileName);
  } catch (error) {
    return pdfErrorResponse(error);
  }
}
