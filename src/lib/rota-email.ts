import { safeHexColor, safeHttpsUrl } from "@/lib/branding-utils";
import { escapeHtml, type EmailBranding } from "@/lib/email-templates";

export interface RotaEmailShift {
  dayLabel: string;
  timeRange: string;
  note: string | null;
}

export interface RotaEmailInput {
  displayName: string;
  weekLabel: string;
  shifts: RotaEmailShift[];
  cancelled: RotaEmailShift[];
  branding: EmailBranding;
}

export function renderRotaEmail(input: RotaEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const b = input.branding;
  const accent = safeHexColor(b.primaryColor) ?? "#2b3d59";
  const creditUrl = safeHttpsUrl(b.developerCreditUrl);
  const subject = `Your rota: ${input.weekLabel}`;

  const rows = (items: RotaEmailShift[], strike: boolean) =>
    items
      .map(
        (s) =>
          `<tr><td style="padding:6px 0;border-bottom:1px solid #e4e4e7;${strike ? "text-decoration:line-through;color:#71717a;" : ""}"><strong>${escapeHtml(s.dayLabel)}</strong> &nbsp; ${escapeHtml(s.timeRange)}${s.note ? ` &nbsp; <span style="color:#52525b;">${escapeHtml(s.note)}</span>` : ""}</td></tr>`,
      )
      .join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<tr><td style="padding:18px 24px;border-bottom:3px solid ${accent};font-size:16px;font-weight:bold;color:${accent};">${escapeHtml(b.companyName)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.5;">
<p style="margin:0 0 8px;font-size:17px;font-weight:bold;">Your rota: ${escapeHtml(input.weekLabel)}</p>
<p style="margin:0 0 16px;">Hi ${escapeHtml(input.displayName)}, your shifts for this week have been ${input.shifts.length > 0 ? "published or updated" : "updated"}.</p>
${
  input.shifts.length > 0
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px;">${rows(input.shifts, false)}</table>`
    : `<p style="margin:0 0 16px;color:#52525b;">You have no shifts this week.</p>`
}
${
  input.cancelled.length > 0
    ? `<p style="margin:0 0 6px;font-weight:bold;">Cancelled</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px;">${rows(input.cancelled, true)}</table>`
    : ""
}
<p style="margin:0;color:#52525b;">Questions about a shift? ${b.contactEmail ? `Contact ${escapeHtml(b.contactEmail)}.` : "Speak to your manager."}</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;line-height:1.5;">
This is an automated message about your working hours.
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

  const line = (s: RotaEmailShift) =>
    `${s.dayLabel}  ${s.timeRange}${s.note ? `  (${s.note})` : ""}`;
  const text = [
    `Hi ${input.displayName},`,
    "",
    `Your rota for ${input.weekLabel}:`,
    ...(input.shifts.length > 0
      ? input.shifts.map(line)
      : ["No shifts this week."]),
    ...(input.cancelled.length > 0
      ? ["", "Cancelled:", ...input.cancelled.map(line)]
      : []),
    "",
    b.contactEmail
      ? `Questions? Contact ${b.contactEmail}.`
      : "Questions? Speak to your manager.",
  ].join("\n");

  return { subject, html, text };
}
