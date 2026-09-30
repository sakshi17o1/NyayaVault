import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { headers } from "next/headers";
import { redact } from "@/lib/redact";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { formatClassification } from "@/lib/utils/format";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const shareToken = await prisma.shareToken.findUnique({
    where: { token },
    include: {
      document: {
        include: { case: true, ocrExtractions: { take: 1, orderBy: { version: "desc" } } }
      }
    }
  });

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] || "unknown-ip";
  const userAgent = headersList.get("user-agent") || "unknown-browser";

  if (!shareToken || shareToken.revoked || shareToken.expiresAt < new Date()) {
    return new NextResponse(
      `<html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: red;">Access Denied</h1>
        <p>This secure link is invalid, revoked, or has expired.</p>
       </body></html>`,
      { status: 403, headers: { "Content-Type": "text/html" } }
    );
  }

  // Unauthenticated external access must still be appended to the immutable ledger for oversight.
  await writeAudit({
    actorId: null, // Public view
    role: "EXTERNAL_GUEST",
    action: "VIEW",
    result: "SUCCESS",
    caseId: shareToken.document.caseId,
    documentId: shareToken.documentId,
    ip,
    userAgent,
    reason: `Public token view by ${shareToken.recipient} (${shareToken.purpose})`,
  });

  const latestOcr = shareToken.document.ocrExtractions?.[0];

  // Mask sensitive PII in the text buffer before rendering so it cannot be extracted from the final PDF.
  let displayText = latestOcr?.rawText || "No text content available.";
  let redactedFieldsList: string[] = [];
  if (shareToken.redactedFields) {
    try {
      redactedFieldsList = JSON.parse(shareToken.redactedFields);
    } catch (e) {
    }
  }

  let redactionCount = 0;
  if (latestOcr?.extractedData) {
    try {
      const extracted = JSON.parse(latestOcr.extractedData);
      const result = redact(displayText, extracted, redactedFieldsList);
      displayText = result.text;
      redactionCount = result.count;
    } catch (e) {
    }
  }

  // Construct a flat PDF to ensure external parties cannot strip watermarks or easily scrape layered text.
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const boldFont = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const { height, width } = page.getSize();
  let y = height - 50;

  const drawText = (text: string, fontType = font, size = 11, color = rgb(0, 0, 0)) => {
    if (y < 80) {
      page = pdfDoc.addPage([600, 800]);
      y = 750;
    }
    const cleanText = Array.from(text).map(c => c.charCodeAt(0) > 255 ? '?' : c).join('');
    page.drawText(cleanText, { x: 50, y, size, font: fontType, color });
    y -= size + 6;
  };

  drawText(`Document: ${shareToken.document.title}`, boldFont, 14);
  if (redactedFieldsList.includes("caseNumber") || redactedFieldsList.includes("case_number")) {
    drawText(`Case Number: [REDACTED]`, boldFont, 12);
  } else {
    drawText(`Case Number: ${shareToken.document.case.caseNumber}`, boldFont, 12);
  }
  
  if (redactedFieldsList.includes("classification")) {
    drawText(`Classification: [REDACTED]`, boldFont, 12);
  } else {
    drawText(`Classification: ${formatClassification(shareToken.document.classification)}`, boldFont, 12);
  }
  y -= 10;
  drawText(`Authorized exclusively for ${shareToken.recipient} (${shareToken.purpose})`, font, 10, rgb(0.8, 0, 0));
  if (redactionCount > 0) {
    drawText(`${redactionCount} occurrence(s) of sensitive data redacted.`, font, 10, rgb(0.8, 0, 0));
  }
  y -= 20;

  // Standard pdf-lib doesn't auto-wrap text, so we enforce a hard wrap to prevent clipping off the right edge.
  const lines = displayText.split("\n");
  for (const line of lines) {
    const words = line.split(" ");
    let currentLine = "";
    for (const word of words) {
      if (currentLine.length + word.length > 70) {
        drawText(currentLine, font, 10);
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    }
    if (currentLine) drawText(currentLine, font, 10);
  }

  // Burn the recipient identity and IP into the background to deter unauthorized screen capturing or leaking.
  const pages = pdfDoc.getPages();
  const rawWatermarkText = `CONFIDENTIAL - VIEWED BY: ${shareToken.recipient} - IP: ${ip}`;
  const watermarkText = Array.from(rawWatermarkText).map(c => c.charCodeAt(0) > 255 ? '?' : c).join('');
  
  for (const p of pages) {
    p.drawText(watermarkText, {
      x: 50,
      y: 200,
      size: 24,
      font: boldFont,
      color: rgb(0.8, 0.8, 0.8),
      rotate: degrees(45),
      opacity: 0.3,
    });
    p.drawText(watermarkText, {
      x: 50,
      y: 500,
      size: 24,
      font: boldFont,
      color: rgb(0.8, 0.8, 0.8),
      rotate: degrees(45),
      opacity: 0.3,
    });
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"shared_document.pdf\"",
    },
  });
}
