import { safeHexColor, safeHttpsUrl } from "@/lib/branding-utils";
import { escapeHtml, type EmailBranding } from "@/lib/email-templates";

export interface HolidayDecisionEmailInput {
  displayName: string;
  dateRange: string;
  decision: "accepted" | "rejected";
  managerNote: string | null;
  branding: EmailBranding;
}

export function renderHolidayDecisionEmail(input: HolidayDecisionEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const b = input.branding;
  const accent = safeHexColor(b.primaryColor) ?? "#2b3d59";
  const creditUrl = safeHttpsUrl(b.developerCreditUrl);
  const word = input.decision === "accepted" ? "accepted" : "rejected";
  const subject = `Your holiday request was ${word}`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<tr><td style="padding:18px 24px;border-bottom:3px solid ${accent};font-size:16px;font-weight:bold;color:${accent};">${escapeHtml(b.companyName)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.5;">
<p style="margin:0 0 8px;font-size:17px;font-weight:bold;">Your holiday request was ${word}</p>
<p style="margin:0 0 16px;">Hi ${escapeHtml(input.displayName)}, your request for <strong>${escapeHtml(input.dateRange)}</strong> has been <strong>${word}</strong>.</p>
${
  input.managerNote
    ? `<p style="margin:0 0 6px;font-weight:bold;">Note from your manager</p><p style="margin:0 0 16px;padding:10px 12px;background:#fafafa;border-left:3px solid ${accent};white-space:pre-wrap;">${escapeHtml(input.managerNote)}</p>`
    : ""
}
<p style="margin:0;color:#52525b;">${b.contactEmail ? `Questions? Contact ${escapeHtml(b.contactEmail)}.` : "Questions? Speak to your manager."}</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;line-height:1.5;">
This is an automated message about your holiday request.
${
  b.developerCreditText
    ? `<div style="margin-top:6px;">${
        creditUrl
          ? `<a href="${escapeHtml(creditUrl)}" style="color:#71717a;">${escapeHtml(b.developerCreditText)}</a>`
          : escapeHtml(b.developerCreditText)
      }</div>`
    : ""
}
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    `Hi ${input.displayName},`,
    "",
    `Your holiday request for ${input.dateRange} has been ${word}.`,
    ...(input.managerNote
      ? ["", "Note from your manager:", input.managerNote]
      : []),
    "",
    b.contactEmail
      ? `Questions? Contact ${b.contactEmail}.`
      : "Questions? Speak to your manager.",
  ].join("\n");

  return { subject, html, text };
}
