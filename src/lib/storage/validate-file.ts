import { ValidationError } from "@/lib/errors";

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

function matchesAsciiAt(
  bytes: Uint8Array,
  offset: number,
  ascii: string,
): boolean {
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

function sniffContentType(bytes: Uint8Array): AllowedContentType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (matchesAsciiAt(bytes, 0, "RIFF") && matchesAsciiAt(bytes, 8, "WEBP")) {
    return "image/webp";
  }
  if (matchesAsciiAt(bytes, 0, "%PDF-")) {
    return "application/pdf";
  }
  return null;
}

export interface ValidatedFile {
  bytes: Buffer;
  contentType: AllowedContentType;
}

export async function validateUploadedFile(file: File): Promise<ValidatedFile> {
  if (file.size === 0) {
    throw new ValidationError("That file is empty.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `Files must be ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB or smaller.`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = sniffContentType(bytes);
  if (!contentType) {
    throw new ValidationError(
      "Unsupported file — only JPEG, PNG, WebP images and PDF files are accepted.",
    );
  }

  return { bytes, contentType };
}
