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
import { requireRecipient } from "@/lib/document-email";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { renderJobReportEmail } from "@/lib/job-report-email";
import { renderJobReportPdf } from "@/lib/pdf/job-report-pdf";
import { loadJobReport } from "@/lib/pdf/load-job-report";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/uuid";

export interface EmailResult {
  success: boolean;
  error: SafeError | null;
}

export async function emailJobReportAction(
  jobId: string,
): Promise<EmailResult> {
  try {
    const actor = await requirePermission(PERMISSIONS.JOBS_WRITE);
    if (!isUuid(jobId)) throw new NotFoundError("That job couldn't be found.");
    if (!isEmailConfigured()) {
      throw new ConflictError(
        "Email isn't set up on this server yet. Download the report and send it yourself instead.",
      );
    }

    const loaded = await loadJobReport(jobId);
    if (!loaded) throw new NotFoundError("That job couldn't be found.");
    const to = requireRecipient(loaded.customerEmail);

    const { model } = loaded;
    const content = renderJobReportEmail({
      jobNumber: model.jobNumber,
      title: model.title,
      customerName: model.customerName,
      completedOn: model.completedOn,
      branding: model.branding,
    });
    await sendEmail({
      to,
      replyTo: model.branding.contactEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
      attachment: {
        fileName: loaded.fileName,
        content: await renderJobReportPdf(model),
      },
    });

    try {
      await logActivity({
        entityType: "job",
        entityId: jobId,
        action: "emailed",
        actor,
        summary: `emailed the job report to ${to}`,
      });
    } catch (logError) {
      logger.error("Couldn't log job report email", { error: logError });
    }

    revalidatePath(`/jobs/${jobId}`);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: toSafeError(error) };
  }
}
