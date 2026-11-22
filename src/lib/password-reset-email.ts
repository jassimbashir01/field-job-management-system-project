import { safeHexColor, safeHttpsUrl } from "@/lib/branding-utils";
import { escapeHtml, type EmailBranding } from "@/lib/email-templates";

export interface PasswordResetEmailInput {
  displayName: string;
  link: string;
  validMinutes: number;
  branding: EmailBranding;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const b = input.branding;
  const accent = safeHexColor(b.primaryColor) ?? "#2b3d59";
  const creditUrl = safeHttpsUrl(b.developerCreditUrl);
  const link = /^https?:\/\//i.test(input.link) ? input.link : null;
  const minutes = Math.max(1, Math.round(input.validMinutes));
  const validFor =
    minutes >= 60 ? `${Math.round(minutes / 60)} hour` : `${minutes} minutes`;
  const subject = `Reset your ${b.companyName} password`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<tr><td style="padding:18px 24px;border-bottom:3px solid ${accent};font-size:16px;font-weight:bold;color:${accent};">${escapeHtml(b.companyName)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.5;">
<p style="margin:0 0 8px;font-size:17px;font-weight:bold;">Reset your password</p>
<p style="margin:0 0 16px;">Hi ${escapeHtml(input.displayName)}, we received a request to reset the password for your account. Use the button below to choose a new one. The link works once and expires in ${validFor}.</p>
${
  link
    ? `<p style="margin:0 0 16px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;">Choose a new password</a></p>`
    : ""
}
<p style="margin:0;color:#52525b;">If you didn't ask for this, you can ignore this email — your password won't change.</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;line-height:1.5;">
${b.contactEmail ? `Questions? ${escapeHtml(b.contactEmail)}` : "This is an automated message."}
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
    `We received a request to reset the password for your ${b.companyName} account. The link works once and expires in ${validFor}.`,
    ...(link ? ["", `Choose a new password: ${link}`] : []),
    "",
    "If you didn't ask for this, you can ignore this email — your password won't change.",
  ].join("\n");

  return { subject, html, text };
}
