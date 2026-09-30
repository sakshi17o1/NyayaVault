import { NextRequest, NextResponse } from "next/server";
import { requireRecentAuth } from "@/lib/auth/rbac";
import { evaluateAccess } from "@/lib/auth/abac";
import { authorizeCase } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { formatClassification } from "@/lib/utils/format";
import { verifyLedgerChain, computeSha256 } from "@/lib/integrity";
import { getStorage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const auth = await requireRecentAuth();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  const { docId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      case: true,
      uploadedBy: true,
      versions: { orderBy: { version: 'desc' } },
      custodyEvents: { include: { actor: true }, orderBy: { createdAt: 'asc' } },
    },
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const authResult = await authorizeCase({
    user,
    caseId: document.caseId,
    action: "export", // Use export action for certificates as it's a formal export
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.reason }, { status: authResult.status });
  }

  // Verification checks
  let fileHashValid = false;
  let ledgerValid = false;
  const latestVersion = document.versions[0];
  if (latestVersion) {
    try {
      const storage = getStorage();
      const fileBytes = await storage.get(latestVersion.storageKey);
      const recomputedHash = computeSha256(fileBytes);
      fileHashValid = (recomputedHash === latestVersion.sha256Hash);
    } catch (e) {
      console.error(e);
    }
  }
  
  const ledgerResult = await verifyLedgerChain();
  ledgerValid = ledgerResult.valid;

  // Generate PDF
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height, width } = page.getSize();
  let y = height - 50;

  const drawText = (text: string, fontType = font, size = 11, color = rgb(0, 0, 0)) => {
    if (y < 80) {
      page = pdfDoc.addPage([600, 800]);
      y = 750;
    }
    page.drawText(text, { x: 50, y, size, font: fontType, color });
    y -= size + 6;
  };

  // Add DRAFT watermark
  page.drawText('DRAFT - PENDING E-SIGNATURE', {
    x: 100,
    y: 200,
    size: 40,
    font: boldFont,
    color: rgb(0.9, 0.9, 0.9),
    rotate: degrees(45),
  });

  drawText("DRAFT CERTIFICATE UNDER SECTION 63(4)", boldFont, 14);
  drawText("BHARATIYA SAKSHYA ADHINIYAM, 2023 (SCHEDULE)", boldFont, 12);
  y -= 20;

  drawText(`Case Number: ${document.case.caseNumber}`, font, 11);
  drawText(`Document Title: ${document.title}`, font, 11);
  drawText(`Document ID: ${document.id}`, font, 11);
  drawText(`Classification: ${formatClassification(document.classification)}`, font, 11);
  y -= 15;

  drawText("PART A: DETAILS OF ELECTRONIC RECORD", boldFont, 11);
  drawText(`   1. Type of Record: ${document.type} (v${document.currentVersion})`);
  drawText(`   2. Original File Name: ${latestVersion ? latestVersion.originalName : "N/A"}`);
  drawText(`   3. Uploaded By: ${document.uploadedBy.name} (${document.uploadedBy.role})`);
  drawText(`   4. Upload Timestamp: ${document.createdAt.toISOString()}`);
  y -= 10;

  drawText("PART B: INTEGRITY & HASH DETAILS", boldFont, 11);
  if (latestVersion) {
    drawText(`   1. Hash Algorithm: SHA-256`);
    drawText(`   2. Cryptographic Hash Value:`);
    drawText(`      ${latestVersion.sha256Hash}`, font, 9);
    drawText(`   3. Ledger Proof ID: ${latestVersion.ledgerProofId || "Pending"}`);
  } else {
    drawText("   No versions found.");
  }
  y -= 10;

  drawText("PART C: SYSTEM & DEVICE DETAILS (To be filled by signee)", boldFont, 11);
  drawText("   1. Make/Model of Computer/Device: _________________________");
  drawText("   2. OS/Software Used: _________________________");
  drawText(`   3. Ledger Verification Status: ${ledgerValid ? "VERIFIED INTACT" : "BROKEN CHAIN"}`);
  drawText(`   4. File Integrity Status: ${fileHashValid ? "VERIFIED MATCH" : "TAMPERED / MISMATCH"}`);
  y -= 10;

  drawText("DECLARATION", boldFont, 11);
  const declaration = "I hereby certify that the electronic record described above was produced by a computer system which was operating properly and the data has not been tampered with. This draft certificate is generated automatically by NyayaVault in compliance with the gazetted Schedule under BSA Section 63(4).";
  
  const words = declaration.split(' ');
  let line = '';
  for (const word of words) {
    if (line.length + word.length > 80) {
      drawText(line, font, 11);
      line = word + ' ';
    } else {
      line += word + ' ';
    }
  }
  if (line) drawText(line, font, 11);
  
  y -= 40;

  // Signatory blocks
  drawText("SIGNATORIES REQUIRED (DSC / eSign)", boldFont, 11);
  y -= 40;

  drawText("___________________________", font, 11);
  drawText("Signature (Person in Charge)", font, 11);
  drawText("Name: _____________________", font, 11);
  drawText("Designation: ______________", font, 11);
  
  // To place the second signature on the same line, we manipulate `y` manually
  const signY = y + 4 * 17; // move back up 4 lines
  page.drawText("___________________________", { x: 350, y: signY, size: 11, font });
  page.drawText("Signature (Expert / Officer)", { x: 350, y: signY - 17, size: 11, font });
  page.drawText("Name: _____________________", { x: 350, y: signY - 34, size: 11, font });
  page.drawText("Designation: ______________", { x: 350, y: signY - 51, size: 11, font });

  y -= 20;

  drawText(`System Generated On: ${new Date().toISOString()}`, font, 9);
  drawText(`Requested By: ${user.name} (${user.role})`, font, 9);

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Section_63_Cert_DRAFT_${document.id}.pdf"`,
    },
  });
}
