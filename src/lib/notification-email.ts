import { safeHexColor, safeHttpsUrl } from "@/lib/branding-utils";
import { escapeHtml, type EmailBranding } from "@/lib/email-templates";

export interface NotificationEmailInput {
  title: string;
  body: string | null;
  /** Full URL of the page to open, or null. */
  link: string | null;
  branding: EmailBranding;
}

export function renderNotificationEmail(input: NotificationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const b = input.branding;
  const accent = safeHexColor(b.primaryColor) ?? "#2b3d59";
  const link =
    input.link && /^https?:\/\//i.test(input.link) ? input.link : null;
  const creditUrl = safeHttpsUrl(b.developerCreditUrl);

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<tr><td style="padding:18px 24px;border-bottom:3px solid ${accent};font-size:16px;font-weight:bold;color:${accent};">${escapeHtml(b.companyName)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.5;">
<p style="margin:0 0 8px;font-size:17px;font-weight:bold;">${escapeHtml(input.title)}</p>
${input.body ? `<p style="margin:0 0 16px;">${escapeHtml(input.body)}</p>` : ""}
${
  link
    ? `<p style="margin:0 0 8px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;">Open in the app</a></p>`
    : ""
}
</td></tr>
<tr><td style="padding:14px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;line-height:1.5;">
You're receiving this because you turned on email for this kind of notification. You can change that under Notifications → Preferences.
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
    input.title,
    ...(input.body ? ["", input.body] : []),
    ...(link ? ["", `Open in the app: ${link}`] : []),
    "",
    "You're receiving this because you turned on email for this kind of notification. Change it under Notifications → Preferences.",
  ].join("\n");

  return { subject: input.title, html, text };
}
