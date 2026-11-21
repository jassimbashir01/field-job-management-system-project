import { safeHexColor, safeHttpsUrl } from "@/lib/branding-utils";

export interface EmailBranding {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  developerCreditText: string | null;
  developerCreditUrl: string | null;
}

export interface DocumentEmailInput {
  kind: "quote" | "invoice";
  number: number;
  title: string;
  customerName: string;
  totalFormatted: string;
  dateLine: string | null;
  link: string | null;
  hasAttachment: boolean;
  branding: EmailBranding;
}

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderDocumentEmail(input: DocumentEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const b = input.branding;
  const noun = input.kind === "quote" ? "quote" : "invoice";
  const Noun = input.kind === "quote" ? "Quote" : "Invoice";
  const accent = safeHexColor(b.primaryColor) ?? "#2b3d59";
  const logo = safeHttpsUrl(b.logoUrl);
  const creditUrl = safeHttpsUrl(b.developerCreditUrl);
  const link =
    input.link && /^https?:\/\//i.test(input.link) ? input.link : null;

  const subject = `${Noun} #${input.number} from ${b.companyName}`;

  const intro =
    input.kind === "quote"
      ? `${b.companyName} has prepared a quote for you.`
      : `${b.companyName} has sent you an invoice.`;
  const deliveryLine = link
    ? input.hasAttachment
      ? `The ${noun} is attached as a PDF, and you can also view it online.`
      : `You can view the ${noun} online using the button below.`
    : `The ${noun} is attached to this email as a PDF.`;
  const buttonLabel =
    input.kind === "quote" ? "View your quote" : "View and pay your invoice";

  const contactLines = [b.contactPhone, b.contactEmail].filter(
    Boolean,
  ) as string[];

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<tr><td style="padding:20px 24px;border-bottom:3px solid ${accent};">
${
  logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(b.companyName)}" height="40" style="display:block;height:40px;width:auto;border:0;">`
    : `<span style="font-size:18px;font-weight:bold;color:${accent};">${escapeHtml(b.companyName)}</span>`
}
</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.5;">
<p style="margin:0 0 12px;">Hello ${escapeHtml(input.customerName)},</p>
<p style="margin:0 0 12px;">${escapeHtml(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e4e4e7;border-radius:6px;">
<tr><td style="padding:12px 16px;">
<div style="font-size:12px;color:#71717a;">${Noun} #${input.number}</div>
<div style="font-size:16px;font-weight:bold;margin:2px 0;">${escapeHtml(input.title)}</div>
<div style="font-size:15px;">Total: <strong style="color:${accent};">${escapeHtml(input.totalFormatted)}</strong></div>
${input.dateLine ? `<div style="font-size:13px;color:#52525b;margin-top:2px;">${escapeHtml(input.dateLine)}</div>` : ""}
</td></tr></table>
<p style="margin:0 0 16px;">${escapeHtml(deliveryLine)}</p>
${
  link
    ? `<p style="margin:0 0 20px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;">${escapeHtml(buttonLabel)}</a></p>`
    : ""
}
<p style="margin:0;">Thank you,<br>${escapeHtml(b.companyName)}</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;line-height:1.5;">
${contactLines.map((l) => escapeHtml(l)).join(" &middot; ")}
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
    `Hello ${input.customerName},`,
    "",
    intro,
    "",
    `${Noun} #${input.number}: ${input.title}`,
    `Total: ${input.totalFormatted}`,
    ...(input.dateLine ? [input.dateLine] : []),
    "",
    deliveryLine,
    ...(link ? ["", `${buttonLabel}: ${link}`] : []),
    "",
    `Thank you,`,
    b.companyName,
    ...(contactLines.length ? ["", contactLines.join(" · ")] : []),
    ...(b.developerCreditText ? [b.developerCreditText] : []),
  ].join("\n");

  return { subject, html, text };
}
