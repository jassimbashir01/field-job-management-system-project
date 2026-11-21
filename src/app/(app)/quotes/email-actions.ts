"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { logActivity } from "@/lib/activity-log";
import {
  ConflictError,
  NotFoundError,
  toSafeError,
  type SafeError,
} from "@/lib/errors";
import { isEmailConfigured } from "@/lib/email";
import {
  parseEmailMode,
  requireRecipient,
  sendDocumentEmail,
} from "@/lib/document-email";
import { loadQuotePdf } from "@/lib/pdf/load-document";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/uuid";
import { markQuoteSentAction } from "./actions";

export interface EmailResult {
  success: boolean;
  error: SafeError | null;
}

export async function emailQuoteAction(
  quoteId: string,
  modeInput: string,
): Promise<EmailResult> {
  let markedSentHere = false;
  try {
    const actor = await requirePermission(PERMISSIONS.QUOTES_WRITE);
    if (!isUuid(quoteId))
      throw new NotFoundError("That quote couldn't be found.");
    const mode = parseEmailMode(modeInput);
    if (!isEmailConfigured()) {
      throw new ConflictError(
        "Email isn't set up on this server yet. Copy the link or download the PDF instead.",
      );
    }

    const first = await loadQuotePdf(quoteId);
    if (!first) throw new NotFoundError("That quote couldn't be found.");
    const to = requireRecipient(first.customerEmail);
    if (!["draft", "sent", "viewed"].includes(first.status)) {
      throw new ConflictError("Only a draft or sent quote can be emailed.");
    }

    if (first.status === "draft") {
      const marked = await markQuoteSentAction(quoteId);
      if (!marked.success) {
        return {
          success: false,
          error: marked.error ?? {
            code: "INTERNAL_ERROR",
            message:
              "Couldn't mark this quote as sent, so nothing was emailed.",
          },
        };
      }
      markedSentHere = true;
    }

    const loaded = await loadQuotePdf(quoteId);
    if (!loaded) throw new NotFoundError("That quote couldn't be found.");
    await sendDocumentEmail(loaded, mode, to);

    try {
      await logActivity({
        entityType: "quote",
        entityId: quoteId,
        action: "emailed",
        actor,
        summary: `emailed this quote to ${to} (${mode === "pdf" ? "PDF attached" : "link"})`,
        metadata: { mode },
      });
    } catch (logError) {
      logger.error("Couldn't log quote email", { error: logError });
    }

    revalidatePath(`/quotes/${quoteId}`);
    return { success: true, error: null };
  } catch (error) {
    const safe = toSafeError(error);
    if (markedSentHere) {
      revalidatePath(`/quotes/${quoteId}`);
      return {
        success: false,
        error: {
          code: safe.code,
          message: `${safe.message} The quote is now marked as sent — use "Email again" to retry.`,
        },
      };
    }
    return { success: false, error: safe };
  }
}
