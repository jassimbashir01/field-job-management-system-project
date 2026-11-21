import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  companies,
  customers,
  invoiceLineItems,
  invoicePaymentOptions,
  invoices,
  paymentOptions,
  quoteLineItems,
  quotes,
  sites,
} from "@/db/schema";
import { safeHttpsUrl } from "@/lib/branding-utils";
import type { PdfBranding, PdfDocumentModel } from "./document-pdf";

const isoDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

export async function loadBranding(): Promise<{
  branding: PdfBranding;
  currency: string;
}> {
  const [company] = await getDb().select().from(companies).limit(1);
  const addressLines = [
    company?.addressLine1,
    company?.addressLine2,
    [company?.city, company?.region, company?.postalCode]
      .filter(Boolean)
      .join(", "),
    company?.country,
  ].filter((line): line is string => Boolean(line && line.trim()));
  return {
    currency: company?.currency ?? "USD",
    branding: {
      companyName: company?.name ?? "Company",
      logoUrl: company?.logoUrl ?? null,
      primaryColor: company?.primaryColor ?? null,
      contactEmail: company?.contactEmail ?? null,
      contactPhone: company?.contactPhone ?? null,
      addressLines,
      developerCreditText: company?.developerCreditText ?? null,
      developerCreditUrl: company?.developerCreditUrl ?? null,
    },
  };
}

async function loadParty(
  customerId: string,
  siteId: string | null,
  oneOff: string | null,
) {
  const db = getDb();
  const [customerRows, siteRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, customerId)).limit(1),
    siteId
      ? db.select().from(sites).where(eq(sites.id, siteId)).limit(1)
      : Promise.resolve([]),
  ]);
  const customer = customerRows[0];
  return {
    customerName: customer?.name ?? "",
    customerCompany: customer?.companyName ?? null,
    customerEmail: customer?.email ?? null,
    locationLine: siteRows[0]?.name ?? (oneOff?.trim() ? oneOff.trim() : null),
  };
}

export interface LoadedPdf {
  model: PdfDocumentModel;
  fileName: string;
  status: string;
  publicToken: string;
  customerEmail: string | null;
}

export async function loadQuotePdf(quoteId: string): Promise<LoadedPdf | null> {
  const db = getDb();
  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);
  if (!quote) return null;

  const [lines, party, { branding, currency }] = await Promise.all([
    db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quoteId))
      .orderBy(asc(quoteLineItems.sortOrder)),
    loadParty(quote.customerId, quote.siteId, quote.oneOffLocation),
    loadBranding(),
  ]);

  const statusNote =
    quote.status === "draft"
      ? "DRAFT"
      : quote.status === "accepted"
        ? "Accepted"
        : quote.status === "declined"
          ? "Declined"
          : null;

  return {
    fileName: `Quote-${quote.quoteNumber}.pdf`,
    status: quote.status,
    publicToken: quote.publicToken,
    customerEmail: party.customerEmail,
    model: {
      kind: "quote",
      number: quote.quoteNumber,
      title: quote.title,
      statusNote,
      issuedOn: isoDate(quote.sentAt ?? quote.createdAt) ?? "",
      secondaryDateLabel: "Valid until",
      secondaryDate: quote.expiresAt,
      currency,
      customerName: party.customerName,
      customerCompany: party.customerCompany,
      locationLine: party.locationLine,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
      })),
      notes: quote.notes,
      paymentOptions: [],
      branding,
    },
  };
}

export async function loadInvoicePdf(
  invoiceId: string,
): Promise<LoadedPdf | null> {
  const db = getDb();
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!invoice) return null;
  return buildInvoicePdf(invoice);
}

export async function loadPaidInvoicePdfByToken(
  token: string,
): Promise<LoadedPdf | null> {
  const [invoice] = await getDb()
    .select()
    .from(invoices)
    .where(eq(invoices.publicToken, token))
    .limit(1);
  if (!invoice || invoice.status !== "paid") return null;
  return buildInvoicePdf(invoice);
}

async function buildInvoicePdf(
  invoice: typeof invoices.$inferSelect,
): Promise<LoadedPdf> {
  const db = getDb();
  const [lines, options, party, { branding, currency }] = await Promise.all([
    db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoice.id))
      .orderBy(asc(invoiceLineItems.sortOrder)),
    db
      .select({
        label: paymentOptions.label,
        details: paymentOptions.details,
        url: paymentOptions.url,
      })
      .from(invoicePaymentOptions)
      .innerJoin(
        paymentOptions,
        eq(invoicePaymentOptions.paymentOptionId, paymentOptions.id),
      )
      .where(eq(invoicePaymentOptions.invoiceId, invoice.id))
      .orderBy(asc(paymentOptions.sortOrder), asc(paymentOptions.createdAt)),
    loadParty(invoice.customerId, invoice.siteId, invoice.oneOffLocation),
    loadBranding(),
  ]);

  const statusNote =
    invoice.status === "draft"
      ? "DRAFT"
      : invoice.status === "void"
        ? "VOID"
        : invoice.status === "paid"
          ? `Paid${isoDate(invoice.paidAt) ? ` on ${isoDate(invoice.paidAt)}` : ""}`
          : null;

  return {
    fileName: `Invoice-${invoice.invoiceNumber}.pdf`,
    status: invoice.status,
    publicToken: invoice.publicToken,
    customerEmail: party.customerEmail,
    model: {
      kind: "invoice",
      number: invoice.invoiceNumber,
      title: invoice.title,
      statusNote,
      issuedOn: isoDate(invoice.sentAt ?? invoice.createdAt) ?? "",
      secondaryDateLabel: "Due",
      secondaryDate: invoice.dueDate,
      currency,
      customerName: party.customerName,
      customerCompany: party.customerCompany,
      locationLine: party.locationLine,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
      })),
      notes: invoice.notes,
      paymentOptions: options.map((o) => ({
        label: o.label,
        details: o.details,
        url: safeHttpsUrl(o.url),
      })),
      branding,
    },
  };
}
