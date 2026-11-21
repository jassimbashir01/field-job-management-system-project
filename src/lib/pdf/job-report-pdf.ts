import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { parseHexColor } from "@/lib/branding-utils";
import { Text, type PdfBranding } from "./document-pdf";
import { fetchLogo } from "./logo";

export interface JobReportModel {
  jobNumber: number;
  title: string;
  completedOn: string | null;
  customerName: string;
  customerCompany: string | null;
  locationLine: string | null;
  technician: string | null;
  scheduledFor: string | null;
  reference: string | null;
  jobType: string | null;
  description: string | null;
  notes: string | null;
  checklist: Array<{ label: string; completed: boolean }>;
  equipment: Array<{ name: string; notes: string | null }>;
  files: Array<{ fileName: string; caption: string | null }>;
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
const LEADING = 14;

export async function renderJobReportPdf(
  model: JobReportModel,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Job report ${model.jobNumber}`);
  pdf.setProducer(model.branding.companyName);
  pdf.setCreator(model.branding.companyName);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const text = new Text(regular, bold);

  const parts = parseHexColor(model.branding.primaryColor) ?? [
    0.17, 0.24, 0.35,
  ];
  const accent = rgb(parts[0], parts[1], parts[2]);

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

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const right = PAGE_W - MARGIN;

  type Draw = {
    font?: PDFFont;
    size?: number;
    color?: ReturnType<typeof rgb>;
    align?: "left" | "right";
  };
  const draw = (value: string, x: number, baseline: number, o: Draw = {}) => {
    const font = o.font ?? regular;
    const size = o.size ?? 10;
    const cleaned = text.clean(value).replace(/\n/g, " ");
    const drawX =
      o.align === "right" ? x - font.widthOfTextAtSize(cleaned, size) : x;
    page.drawText(cleaned, {
      x: drawX,
      y: baseline,
      font,
      size,
      color: o.color ?? INK,
    });
  };
  const label = (value: string, x: number, baseline: number) =>
    draw(value.toUpperCase(), x, baseline, {
      font: bold,
      size: 7.5,
      color: GREY,
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
  const ensure = (needed: number) => {
    if (y - needed < BOTTOM_LIMIT) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      topBar();
      y = PAGE_H - MARGIN;
    }
  };
  const section = (title: string) => {
    ensure(50);
    draw(title.toUpperCase(), MARGIN, y, {
      font: bold,
      size: 8.5,
      color: accent,
    });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: right, y },
      thickness: 0.5,
      color: LIGHT,
    });
    y -= 16;
  };
  const paragraph = (value: string) => {
    for (const line of text.wrap(value, regular, 10, CONTENT_W)) {
      ensure(LEADING + 2);
      draw(line, MARGIN, y, { size: 10, color: GREY });
      y -= LEADING;
    }
    y -= 14;
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
  draw("JOB REPORT", right, headerTop - 18, {
    font: bold,
    size: 24,
    color: accent,
    align: "right",
  });
  draw(`Job ${model.jobNumber}`, right, headerTop - 38, {
    size: 11,
    color: GREY,
    align: "right",
  });
  const note = text
    .clean(model.completedOn ? `Completed ${model.completedOn}` : "Completed")
    .toUpperCase();
  const boxW = bold.widthOfTextAtSize(note, 8.5) + 18;
  page.drawRectangle({
    x: right - boxW,
    y: headerTop - 68,
    width: boxW,
    height: 20,
    borderColor: accent,
    borderWidth: 1,
  });
  draw(note, right - boxW + 9, headerTop - 61.5, {
    font: bold,
    size: 8.5,
    color: accent,
  });

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
  y = Math.min(y, headerTop - 72) - 14;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: right, y },
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
        230,
      )) {
        customerLines.push({
          text: wrapped,
          font: index === 0 ? bold : regular,
        });
      }
    },
  );
  const facts: Array<[string, string]> = [];
  if (model.technician) facts.push(["Technician", model.technician]);
  if (model.scheduledFor) facts.push(["Scheduled", model.scheduledFor]);
  if (model.completedOn) facts.push(["Completed", model.completedOn]);
  if (model.jobType) facts.push(["Job type", model.jobType]);
  if (model.reference) facts.push(["Reference", model.reference]);

  const leftH = 12 + customerLines.length * 14;
  const rightH = 12 + Math.max(facts.length, 1) * 16;
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
  label("Customer", MARGIN + PAD + 3, py);
  py -= 16;
  for (const line of customerLines) {
    draw(line.text, MARGIN + PAD + 3, py, { font: line.font, size: 10.5 });
    py -= 14;
  }
  let fy = y - PAD - 7;
  for (const [name, value] of facts) {
    label(name, right - PAD - 190, fy);
    const shown = text.wrap(value, regular, 10.5, 120)[0] ?? "";
    draw(shown, right - PAD, fy, { size: 10.5, align: "right" });
    fy -= 16;
  }
  y -= panelH + 26;

  for (const wrapped of text.wrap(model.title, bold, 14, CONTENT_W)) {
    ensure(24);
    draw(wrapped, MARGIN, y, { font: bold, size: 14 });
    y -= 20;
  }
  y -= 8;
  if (model.description?.trim()) {
    section("Work requested");
    paragraph(model.description);
  }

  if (model.checklist.length > 0) {
    const done = model.checklist.filter((c) => c.completed).length;
    section(`Checklist — ${done} of ${model.checklist.length} completed`);
    model.checklist.forEach((item, index) => {
      const lines = text.wrap(item.label, regular, 10, CONTENT_W - 96);
      const rowH = Math.max(lines.length, 1) * LEADING + 12;
      ensure(rowH);
      if (index % 2 === 1) {
        page.drawRectangle({
          x: MARGIN,
          y: y - rowH,
          width: CONTENT_W,
          height: rowH,
          color: ZEBRA,
        });
      }
      lines.forEach((line, i) =>
        draw(line, MARGIN + 10, y - 15 - i * LEADING, { size: 10 }),
      );
      draw(item.completed ? "Done" : "Not done", right - 10, y - 15, {
        font: bold,
        size: 9,
        color: item.completed ? accent : GREY,
        align: "right",
      });
      y -= rowH;
    });
    y -= 18;
  }

  if (model.equipment.length > 0) {
    section("Equipment worked on");
    for (const item of model.equipment) {
      const noteLines = item.notes
        ? text.wrap(item.notes, regular, 9.5, CONTENT_W - 20)
        : [];
      ensure(20 + noteLines.length * 13);
      draw(item.name, MARGIN + 10, y, { font: bold, size: 10 });
      y -= 14;
      for (const line of noteLines) {
        ensure(14);
        draw(line, MARGIN + 10, y, { size: 9.5, color: GREY });
        y -= 13;
      }
      y -= 6;
    }
    y -= 10;
  }

  if (model.notes?.trim()) {
    section("Notes");
    paragraph(model.notes);
  }

  if (model.files.length > 0) {
    section(`Attached files (${model.files.length})`);
    for (const file of model.files) {
      const line = file.caption
        ? `${file.fileName} — ${file.caption}`
        : file.fileName;
      for (const wrapped of text.wrap(line, regular, 9.5, CONTENT_W - 20)) {
        ensure(14);
        draw(wrapped, MARGIN + 10, y, { size: 9.5, color: GREY });
        y -= 13;
      }
    }
    y -= 10;
  }

  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    page = p;
    page.drawLine({
      start: { x: MARGIN, y: FOOTER_Y + 16 },
      end: { x: right, y: FOOTER_Y + 16 },
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
    draw(`Page ${index + 1} of ${pages.length}`, right, FOOTER_Y, {
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
