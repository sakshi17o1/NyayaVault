import type { AuditAction, AuditResult, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { evaluateAccess, type AccessAction } from "@/lib/auth/abac";
import type { SessionUser } from "@/lib/auth/session";

type WriteAuditInput = {
  actorId?: string | null;
  role: string;
  action: AuditAction;
  result: AuditResult;
  caseId?: string | null;
  documentId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: WriteAuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      role: input.role,
      action: input.action,
      result: input.result,
      caseId: input.caseId ?? null,
      documentId: input.documentId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      reason: input.reason ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  });
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

export async function authorizeCase(options: {
  user: SessionUser;
  caseId: string;
  action: AccessAction;
  ip?: string | null;
  userAgent?: string | null;
  purpose?: string;
}) {
  const record = await prisma.caseRecord.findUnique({
    where: { id: options.caseId },
    include: { assignments: true },
  });

  if (!record) {
    await writeAudit({
      actorId: options.user.id,
      role: options.user.role,
      action: "ACCESS_DENIED",
      result: "DENIED",
      caseId: options.caseId,
      ip: options.ip,
      userAgent: options.userAgent,
      reason: "Case not found",
    });
    return { ok: false as const, status: 404 as const, reason: "Case not found", case: null };
  }

  const assigned = record.assignments.some((row) => row.userId === options.user.id);
  const decision = evaluateAccess({
    role: options.user.role as Role,
    assigned,
    caseClassification: record.classification,
    action: options.action,
    purpose: options.purpose,
  });

  await writeAudit({
    actorId: options.user.id,
    role: options.user.role,
    action: decision.allowed ? "ACCESS_ALLOWED" : "ACCESS_DENIED",
    result: decision.allowed ? "SUCCESS" : "DENIED",
    caseId: record.id,
    ip: options.ip,
    userAgent: options.userAgent,
    reason: decision.reason,
    metadata: { action: options.action, caseNumber: record.caseNumber },
  });

  if (!decision.allowed) {
    return { ok: false as const, status: 403 as const, reason: decision.reason, case: record };
  }

  return { ok: true as const, status: 200 as const, reason: decision.reason, case: record };
}

export async function authorizeDocument(options: {
  user: SessionUser;
  docId: string;
  action: AccessAction;
  ip?: string | null;
  userAgent?: string | null;
  purpose?: string;
}) {
  const document = await prisma.document.findUnique({
    where: { id: options.docId },
    include: {
      case: {
        include: { assignments: true },
      },
    },
  });

  if (!document) {
    await writeAudit({
      actorId: options.user.id,
      role: options.user.role,
      action: "ACCESS_DENIED",
      result: "DENIED",
      documentId: options.docId,
      ip: options.ip,
      userAgent: options.userAgent,
      reason: "Document not found",
    });
    return { ok: false as const, status: 404 as const, reason: "Document not found", document: null };
  }

  const assigned = document.case.assignments.some((row) => row.userId === options.user.id);
  const decision = evaluateAccess({
    role: options.user.role as Role,
    assigned,
    caseClassification: document.case.classification,
    action: options.action,
    purpose: options.purpose,
  });

  await writeAudit({
    actorId: options.user.id,
    role: options.user.role,
    action: decision.allowed ? "ACCESS_ALLOWED" : "ACCESS_DENIED",
    result: decision.allowed ? "SUCCESS" : "DENIED",
    caseId: document.case.id,
    documentId: document.id,
    ip: options.ip,
    userAgent: options.userAgent,
    reason: decision.reason,
    metadata: { action: options.action, documentType: document.type },
  });

  if (!decision.allowed) {
    return { ok: false as const, status: 403 as const, reason: decision.reason, document };
  }

  return { ok: true as const, status: 200 as const, reason: decision.reason, document };
}
