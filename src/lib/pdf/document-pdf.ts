import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import {
  computeLineTotalCents,
  computeTotalCents,
  formatCents,
} from "@/lib/money";
import { parseHexColor } from "@/lib/branding-utils";
import { fetchLogo } from "./logo";

export interface PdfBranding {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLines: string[];
  developerCreditText: string | null;
  developerCreditUrl: string | null;
}

export interface PdfLine {
  description: string;
  quantity: string;
  unitPriceCents: number;
}

export interface PdfPaymentOption {
  label: string;
  details: string | null;
  url: string | null;
}

export interface PdfDocumentModel {
  kind: "quote" | "invoice";
  number: number;
  title: string;
  statusNote: string | null;
  issuedOn: string;
  secondaryDateLabel: string;
  secondaryDate: string | null;
  currency: string;
  customerName: string;
  customerCompany: string | null;
  locationLine: string | null;
  lines: PdfLine[];
  notes: string | null;
  paymentOptions: PdfPaymentOption[];
  branding: PdfBranding;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 36;
const BOTTOM_LIMIT = 78;

const GREY = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.88, 0.88, 0.89);
const ZEBRA = rgb(0.972, 0.972, 0.976);
const INK = rgb(0.1, 0.1, 0.1);

export class Text {
  private readonly supported: Set<number>;
  constructor(
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.supported = new Set(regular.getCharacterSet());
  }
  clean(value: string): string {
    let out = "";
    for (const ch of value.replace(/\t/g, " ").replace(/\r/g, "")) {
      const cp = ch.codePointAt(0)!;
      out += ch === "\n" || this.supported.has(cp) ? ch : "?";
    }
    return out;
  }
  hasUnsupported(value: string): boolean {
    for (const ch of value) {
      if (ch !== "\n" && !this.supported.has(ch.codePointAt(0)!)) return true;
    }
    return false;
  }
  width(value: string, font: PDFFont, size: number): number {
    return font.widthOfTextAtSize(this.clean(value).replace(/\n/g, " "), size);
  }
  wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const paragraph of this.clean(value).split("\n")) {
      const words = paragraph.split(" ").filter((w) => w.length > 0);
      if (words.length === 0) {
        lines.push("");
        continue;
      }
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          current = candidate;
          continue;
        }
        if (current) lines.push(current);
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > maxWidth) {
          let cut = rest.length - 1;
          while (
            cut > 1 &&
            font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth
          ) {
            cut -= 1;
          }
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        current = rest;
      }
      if (current) lines.push(current);
    }
    return lines;
  }
}

export async function renderDocumentPdf(
  model: PdfDocumentModel,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    `${model.kind === "quote" ? "Quote" : "Invoice"} ${model.number}`,
  );
  pdf.setProducer(model.branding.companyName);
  pdf.setCreator(model.branding.companyName);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const text = new Text(regular, bold);

  const accentParts = parseHexColor(model.branding.primaryColor) ?? [
    0.17, 0.24, 0.35,
  ];
  const accent = rgb(accentParts[0], accentParts[1], accentParts[2]);

  const money = (cents: number): string => {
    const formatted = formatCents(cents, model.currency);
    return text.hasUnsupported(formatted)
      ? `${(cents / 100).toFixed(2)} ${model.currency}`
      : formatted;
  };

  let logo: PDFImage | null = null;
  if (model.branding.logoUrl) {
    const fetched = await fetchLogo(model.branding.logoUrl);
    if (fetched) {
      try {
        logo =
          fetched.kind === "png"
            ? await pdf.embedPng(fetched.bytes)
            : await pdf.embedJpg(fetched.bytes);
      } catch {
        logo = null;
      }
    }
  }

  const tint = rgb(
    accentParts[0] + (1 - accentParts[0]) * 0.9,
    accentParts[1] + (1 - accentParts[1]) * 0.9,
    accentParts[2] + (1 - accentParts[2]) * 0.9,
  );

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  type Draw = {
    font?: PDFFont;
    size?: number;
    color?: ReturnType<typeof rgb>;
    align?: "left" | "right";
  };
  const draw = (
    value: string,
    x: number,
    baseline: number,
    opts: Draw = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const cleaned = text.clean(value).replace(/\n/g, " ");
    const drawX =
      opts.align === "right" ? x - font.widthOfTextAtSize(cleaned, size) : x;
    page.drawText(cleaned, {
      x: drawX,
      y: baseline,
      font,
      size,
      color: opts.color ?? INK,
    });
  };
  const label = (
    value: string,
    x: number,
    baseline: number,
    align: "left" | "right" = "left",
  ) =>
    draw(value.toUpperCase(), x, baseline, {
      font: bold,
      size: 7.5,
      color: GREY,
      align,
    });

  const topBar = () =>
    page.drawRectangle({
      x: 0,
      y: PAGE_H - 7,
      width: PAGE_W,
      height: 7,
      color: accent,
    });
  topBar();

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    topBar();
    y = PAGE_H - MARGIN;
  };
  const ensure = (needed: number, onNewPage?: () => void) => {
    if (y - needed < BOTTOM_LIMIT) {
      newPage();
      onNewPage?.();
    }
  };

  const headerTop = y;
  let leftBottom: number;
  if (logo) {
    const scale = Math.min(150 / logo.width, 54 / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, { x: MARGIN, y: headerTop - h, width: w, height: h });
    leftBottom = headerTop - h;
  } else {
    draw(model.branding.companyName, MARGIN, headerTop - 15, {
      font: bold,
      size: 17,
      color: accent,
    });
    leftBottom = headerTop - 22;
  }

  const kindLabel = model.kind === "quote" ? "QUOTE" : "INVOICE";
  draw(kindLabel, PAGE_W - MARGIN, headerTop - 18, {
    font: bold,
    size: 24,
    color: accent,
    align: "right",
  });
  draw(`No. ${model.number}`, PAGE_W - MARGIN, headerTop - 38, {
    size: 11,
    color: GREY,
    align: "right",
  });
  let rightBottom = headerTop - 44;
  if (model.statusNote) {
    const note = text.clean(model.statusNote).toUpperCase();
    const noteW = bold.widthOfTextAtSize(note, 8.5);
    const boxW = noteW + 18;
    page.drawRectangle({
      x: PAGE_W - MARGIN - boxW,
      y: headerTop - 68,
      width: boxW,
      height: 20,
      borderColor: accent,
      borderWidth: 1,
    });
    draw(note, PAGE_W - MARGIN - boxW + 9, headerTop - 61.5, {
      font: bold,
      size: 8.5,
      color: accent,
    });
    rightBottom = headerTop - 72;
  }

  y = leftBottom - 14;
  const contact = [
    ...(logo ? [model.branding.companyName] : []),
    ...model.branding.addressLines,
    ...(model.branding.contactPhone ? [model.branding.contactPhone] : []),
    ...(model.branding.contactEmail ? [model.branding.contactEmail] : []),
  ];
  contact.forEach((line, index) => {
    const isName = logo && index === 0;
    draw(line, MARGIN, y, {
      font: isName ? bold : regular,
      size: 9,
      color: isName ? INK : GREY,
    });
    y -= 13;
  });
  y = Math.min(y, rightBottom) - 14;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.75,
    color: LIGHT,
  });
  y -= 22;

  const PAD = 14;
  const customerLines: Array<{ text: string; font: PDFFont }> = [];
  [model.customerName, model.customerCompany, model.locationLine].forEach(
    (value, index) => {
      if (!value) return;
      for (const wrapped of text.wrap(
        value,
        index === 0 ? bold : regular,
        10.5,
        250,
      )) {
        customerLines.push({
          text: wrapped,
          font: index === 0 ? bold : regular,
        });
      }
    },
  );
  const dateRows: Array<[string, string]> = [["Issued", model.issuedOn]];
  if (model.secondaryDate)
    dateRows.push([model.secondaryDateLabel, model.secondaryDate]);

  const leftH = 12 + customerLines.length * 14;
  const rightH = 12 + dateRows.length * 16;
  const panelH = Math.max(leftH, rightH) + PAD * 2 - 4;
  ensure(panelH + 40);
  page.drawRectangle({
    x: MARGIN,
    y: y - panelH,
    width: CONTENT_W,
    height: panelH,
    color: ZEBRA,
  });
  page.drawRectangle({
    x: MARGIN,
    y: y - panelH,
    width: 3,
    height: panelH,
    color: accent,
  });

  let py = y - PAD - 7;
  label(
    model.kind === "quote" ? "Prepared for" : "Bill to",
    MARGIN + PAD + 3,
    py,
  );
  py -= 16;
  for (const line of customerLines) {
    draw(line.text, MARGIN + PAD + 3, py, { font: line.font, size: 10.5 });
    py -= 14;
  }
  let dy = y - PAD - 7;
  for (const [name, value] of dateRows) {
    label(name, PAGE_W - MARGIN - PAD - 120, dy);
    draw(value, PAGE_W - MARGIN - PAD, dy, { size: 10.5, align: "right" });
    dy -= 16;
  }
  y -= panelH + 26;

  for (const wrapped of text.wrap(model.title, bold, 14, CONTENT_W)) {
    ensure(24);
    draw(wrapped, MARGIN, y, { font: bold, size: 14 });
    y -= 20;
  }
  y -= 8;

  const right = MARGIN + CONTENT_W;
  const amountEdge = right - 10;
  const unitEdge = right - 112;
  const qtyEdge = right - 214;
  const descX = MARGIN + 10;
  const descW = qtyEdge - 56 - descX;
  const LEADING = 13.5;

  const tableHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 24,
      width: CONTENT_W,
      height: 24,
      color: accent,
    });
    const white = rgb(1, 1, 1);
    const h = { font: bold, size: 8, color: white } as const;
    draw("DESCRIPTION", descX, y - 15, h);
    draw("QTY", qtyEdge, y - 15, { ...h, align: "right" });
    draw("UNIT PRICE", unitEdge, y - 15, { ...h, align: "right" });
    draw("AMOUNT", amountEdge, y - 15, { ...h, align: "right" });
    y -= 24;
  };
  ensure(90);
  tableHeader();

  model.lines.forEach((item, index) => {
    const wrapped = text.wrap(item.description, regular, 10, descW);
    const rows = Math.max(wrapped.length, 1);
    const rowH = rows * LEADING + 16;
    ensure(rowH, tableHeader);
    if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowH,
        width: CONTENT_W,
        height: rowH,
        color: ZEBRA,
      });
    }
    const first = y - 8 - 9;
    wrapped.forEach((line, i) =>
      draw(line, descX, first - i * LEADING, { size: 10 }),
    );
    draw(Number(item.quantity).toString(), qtyEdge, first, {
      size: 10,
      align: "right",
    });
    draw(money(item.unitPriceCents), unitEdge, first, {
      size: 10,
      align: "right",
    });
    draw(money(computeLineTotalCents(item)), amountEdge, first, {
      size: 10,
      align: "right",
      font: bold,
    });
    y -= rowH;
  });
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: right, y },
    thickness: 1,
    color: accent,
  });
  y -= 16;

  const settled =
    model.statusNote === "VOID" || (model.statusNote ?? "").startsWith("Paid");
  const totalLabel =
    model.kind === "invoice" && !settled ? "Total due" : "Total";
  ensure(60);
  const boxW = 230;
  const boxH = 38;
  page.drawRectangle({
    x: right - boxW,
    y: y - boxH,
    width: boxW,
    height: boxH,
    color: tint,
  });
  label(totalLabel, right - boxW + 14, y - 23);
  draw(money(computeTotalCents(model.lines)), right - 14, y - 25, {
    font: bold,
    size: 15,
    color: accent,
    align: "right",
  });
  y -= boxH + 30;

  if (model.notes && model.notes.trim()) {
    ensure(50);
    draw("NOTES", MARGIN, y, { font: bold, size: 8.5, color: accent });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: right, y },
      thickness: 0.5,
      color: LIGHT,
    });
    y -= 16;
    for (const line of text.wrap(model.notes, regular, 10, CONTENT_W)) {
      ensure(16);
      draw(line, MARGIN, y, { size: 10, color: GREY });
      y -= 14;
    }
    y -= 18;
  }

  if (model.kind === "invoice" && model.paymentOptions.length > 0) {
    ensure(70);
    draw("HOW TO PAY", MARGIN, y, { font: bold, size: 8.5, color: accent });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: right, y },
      thickness: 0.5,
      color: LIGHT,
    });
    y -= 14;
    for (const option of model.paymentOptions) {
      const detail = [option.details, option.url].filter(Boolean).join("\n");
      const detailLines = detail
        ? text.wrap(detail, regular, 9.5, CONTENT_W - 28)
        : [];
      const cardH = 14 + 14 + detailLines.length * 13 + 8;
      ensure(cardH + 10);
      page.drawRectangle({
        x: MARGIN,
        y: y - cardH,
        width: CONTENT_W,
        height: cardH,
        borderColor: LIGHT,
        borderWidth: 0.75,
      });
      draw(option.label, MARGIN + 14, y - 20, { font: bold, size: 10.5 });
      detailLines.forEach((line, i) =>
        draw(line, MARGIN + 14, y - 36 - i * 13, { size: 9.5, color: GREY }),
      );
      y -= cardH + 10;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    page = p;
    page.drawLine({
      start: { x: MARGIN, y: FOOTER_Y + 16 },
      end: { x: PAGE_W - MARGIN, y: FOOTER_Y + 16 },
      thickness: 0.5,
      color: LIGHT,
    });
    const footerParts = [model.branding.companyName];
    if (model.branding.contactEmail)
      footerParts.push(model.branding.contactEmail);
    if (model.branding.contactPhone)
      footerParts.push(model.branding.contactPhone);
    draw(footerParts.join("   |   "), MARGIN, FOOTER_Y, {
      size: 8,
      color: GREY,
    });
    draw(`Page ${index + 1} of ${pages.length}`, PAGE_W - MARGIN, FOOTER_Y, {
      size: 8,
      color: GREY,
      align: "right",
    });
    if (model.branding.developerCreditText) {
      draw(model.branding.developerCreditText, MARGIN, FOOTER_Y - 12, {
        size: 7.5,
        color: GREY,
      });
    }
  });

  return pdf.save();
}
