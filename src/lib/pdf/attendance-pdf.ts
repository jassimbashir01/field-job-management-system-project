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

export interface AttendanceModel {
  personName: string;
  fromDate: string;
  toDate: string;
  timeZone: string;
  days: Array<{
    label: string;
    punches: Array<{ time: string; duration: string; notes: string }>;
  }>;
  totalLabel: string;
  jobs: Array<{ jobNumber: number; title: string; completedOn: string }>;
  generatedOn: string;
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

export async function renderAttendancePdf(
  model: AttendanceModel,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    `Attendance ${model.personName} ${model.fromDate} to ${model.toDate}`,
  );
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

  const headerTop = y;
  let leftBottom: number;
  if (logo) {
    const scale = Math.min(150 / logo.width, 54 / logo.height, 1);
    page.drawImage(logo, {
      x: MARGIN,
      y: headerTop - logo.height * scale,
      width: logo.width * scale,
      height: logo.height * scale,
    });
    leftBottom = headerTop - logo.height * scale;
  } else {
    draw(model.branding.companyName, MARGIN, headerTop - 15, {
      font: bold,
      size: 17,
      color: accent,
    });
    leftBottom = headerTop - 22;
  }
  draw("ATTENDANCE RECORD", right, headerTop - 18, {
    font: bold,
    size: 20,
    color: accent,
    align: "right",
  });
  draw(model.personName, right, headerTop - 38, {
    font: bold,
    size: 12,
    align: "right",
  });
  draw(`${model.fromDate} to ${model.toDate}`, right, headerTop - 54, {
    size: 10,
    color: GREY,
    align: "right",
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
  y = Math.min(y, headerTop - 66) - 14;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: right, y },
    thickness: 0.75,
    color: LIGHT,
  });
  y -= 22;

  section("Punches");
  if (model.days.length === 0) {
    draw("No punches in this period.", MARGIN, y, { color: GREY });
    y -= 20;
  }
  let stripe = 0;
  for (const day of model.days) {
    for (const [index, punch] of day.punches.entries()) {
      const noteLines = punch.notes
        ? text.wrap(punch.notes, regular, 8.5, 150)
        : [];
      const rowH = Math.max(noteLines.length, 1) * 11 + 10;
      ensure(rowH);
      if (stripe % 2 === 1) {
        page.drawRectangle({
          x: MARGIN,
          y: y - rowH,
          width: CONTENT_W,
          height: rowH,
          color: ZEBRA,
        });
      }
      if (index === 0)
        draw(day.label, MARGIN + 8, y - 14, { font: bold, size: 10 });
      draw(punch.time, MARGIN + 100, y - 14, { size: 10 });
      draw(punch.duration, MARGIN + 250, y - 14, { size: 10 });
      noteLines.forEach((line, i) =>
        draw(line, MARGIN + 340, y - 14 - i * 11, { size: 8.5, color: GREY }),
      );
      y -= rowH;
      stripe++;
    }
  }
  ensure(30);
  y -= 4;
  draw("Total time at work", MARGIN + 8, y, { font: bold, size: 10 });
  draw(model.totalLabel, MARGIN + 250, y, { font: bold, size: 10 });
  y -= 28;

  if (model.jobs.length > 0) {
    section(`Jobs completed (${model.jobs.length})`);
    for (const job of model.jobs) {
      const line = `Job ${job.jobNumber} — ${job.title}`;
      const wrapped = text.wrap(line, regular, 10, CONTENT_W - 110);
      ensure(wrapped.length * 14 + 4);
      wrapped.forEach((l, i) => draw(l, MARGIN + 8, y - i * 14, { size: 10 }));
      draw(job.completedOn, right - 8, y, {
        size: 10,
        color: GREY,
        align: "right",
      });
      y -= wrapped.length * 14 + 4;
    }
    y -= 14;
  }

  ensure(40);
  for (const line of text.wrap(
    "This record shows when work started and finished. It is not a pay calculation. Times are shown in " +
      `${model.timeZone}. Entries marked "edited" or "added" were changed by a manager.`,
    regular,
    8.5,
    CONTENT_W,
  )) {
    draw(line, MARGIN, y, { size: 8.5, color: GREY });
    y -= 12;
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
    draw(
      `Generated ${model.generatedOn}   |   Page ${index + 1} of ${pages.length}`,
      right,
      FOOTER_Y,
      {
        size: 8,
        color: GREY,
        align: "right",
      },
    );
    if (model.branding.developerCreditText) {
      draw(model.branding.developerCreditText, MARGIN, FOOTER_Y - 12, {
        size: 7.5,
        color: GREY,
      });
    }
  });

  return pdf.save();
}
