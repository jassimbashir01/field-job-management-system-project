import "server-only";
import * as z from "zod";
import { env } from "@/lib/env";
import { ConflictError, ValidationError } from "@/lib/errors";
import { sendEmail } from "@/lib/email";
import { renderDocumentEmail } from "@/lib/email-templates";
import { computeTotalCents, formatCents } from "@/lib/money";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import type { LoadedPdf } from "@/lib/pdf/load-document";

export type EmailMode = "link" | "pdf";

export function parseEmailMode(value: unknown): EmailMode {
  if (value === "link" || value === "pdf") return value;
  throw new ValidationError("Choose whether to email a link or the PDF.");
}

export function requireRecipient(email: string | null): string {
  const trimmed = email?.trim() ?? "";
  if (!trimmed || !z.email().safeParse(trimmed).success) {
    throw new ConflictError(
      "This customer has no valid email address. Add one on the customer, or copy the link / download the PDF instead.",
    );
  }
  return trimmed;
}

export async function sendDocumentEmail(
  loaded: LoadedPdf,
  mode: EmailMode,
  to: string,
): Promise<void> {
  const { model } = loaded;
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const path = model.kind === "quote" ? "q" : "i";
  const link = mode === "link" ? `${base}/${path}/${loaded.publicToken}` : null;

  const content = renderDocumentEmail({
    kind: model.kind,
    number: model.number,
    title: model.title,
    customerName: model.customerName,
    totalFormatted: formatCents(computeTotalCents(model.lines), model.currency),
    dateLine: model.secondaryDate
      ? `${model.secondaryDateLabel} ${model.secondaryDate}`
      : null,
    link,
    hasAttachment: mode === "pdf",
    branding: model.branding,
  });

  await sendEmail({
    to,
    replyTo: model.branding.contactEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    attachment:
      mode === "pdf"
        ? { fileName: loaded.fileName, content: await renderDocumentPdf(model) }
        : undefined,
  });
}
