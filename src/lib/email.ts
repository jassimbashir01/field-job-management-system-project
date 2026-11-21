import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { ConflictError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

const DELIVERY_FAILED =
  "The email couldn't be sent right now. Please try again in a moment.";

export interface OutgoingEmail {
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  attachment?: { fileName: string; content: Uint8Array };
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new ConflictError(
      "Email isn't set up on this server yet. Copy the link or download the PDF instead.",
    );
  }

  const resend = new Resend(env.RESEND_API_KEY);
  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [email.to],
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.attachment
        ? {
            attachments: [
              {
                filename: email.attachment.fileName,
                content: Buffer.from(email.attachment.content),
              },
            ],
          }
        : {}),
    });
    if (error) {
      logger.error("Resend rejected an email", { error });
      throw new AppError("INTERNAL_ERROR", DELIVERY_FAILED);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Resend request failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
    throw new AppError("INTERNAL_ERROR", DELIVERY_FAILED);
  }
}
