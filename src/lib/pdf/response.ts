import { AppError } from "@/lib/errors/app-error";
import { toSafeError } from "@/lib/errors";

export function pdfResponse(bytes: Uint8Array, fileName: string): Response {
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function pdfErrorResponse(error: unknown): Response {
  const safe = toSafeError(error);
  const status = error instanceof AppError ? error.httpStatus : 500;
  return Response.json(
    { error: safe },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
