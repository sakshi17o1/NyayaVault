import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { evaluateAccess } from "@/lib/auth/abac";
import { writeAudit } from "@/lib/audit";
import { appendLedgerEvent } from "@/lib/integrity";
import { z } from "zod";

const createCaseSchema = z.object({
  title: z.string().min(1).max(255),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "PROTECTED_VICTIM_WITNESS"]),
  firNumber: z.string().min(1).max(100),
  jurisdiction: z.string().min(1).max(255),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request data", details: parsed.error.format() }, { status: 400 });
  }

  const { title, classification, firNumber, jurisdiction } = parsed.data;

  // ABAC Check
  const authDecision = evaluateAccess({
    role: user.role,
    assigned: true, // we assume true for creation check
    caseClassification: classification,
    action: "create_case"
  });

  if (!authDecision.allowed) {
    return NextResponse.json({ error: authDecision.reason }, { status: 403 });
  }

  try {
    const newCase = await prisma.$transaction(async (tx) => {
      // Generate a sequential Case Number
      const count = await tx.caseRecord.count();
      const caseNumber = `CR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const createdCase = await tx.caseRecord.create({
        data: {
          caseNumber,
          title,
          status: "OPEN",
          classification,
          firNumber,
          station: jurisdiction,
          summary: `Manually created case: ${title}`,
          cctnsRef: `CCTNS-${Math.floor(Math.random() * 1000000)}`,
          assignments: {
            create: {
              userId: user.id
            }
          }
        }
      });

      await appendLedgerEvent({
        actorId: user.id,
        eventType: "CASE_CREATED",
        metadata: { caseId: createdCase.id, caseNumber },
        txClient: tx,
      });

      return createdCase;
    });

    await writeAudit({
      actorId: user.id,
      role: user.role,
      action: "ACCESS_ALLOWED",
      result: "SUCCESS",
      caseId: newCase.id,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
      userAgent: request.headers.get("user-agent"),
      reason: `Created new case ${newCase.caseNumber}`,
    });

    return NextResponse.json({ success: true, case: newCase });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
  }
}
