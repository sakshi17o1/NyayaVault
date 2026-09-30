import type { Classification, Role } from "@prisma/client";

export const CLASSIFICATION_RANK: Record<Classification, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
  PROTECTED_VICTIM_WITNESS: 4,
};

export type AccessAction =
  | "view_case"
  | "view_document"
  | "upload"
  | "approve"
  | "transfer_custody"
  | "share"
  | "export"
  | "view_audit"
  | "manage_demo"
  | "ask_assistant"
  | "accept_custody"
  | "review_ocr"
  | "create_case"
  | "edit_case"
  | "archive";

export type Policy = {
  requiresAssignment: boolean;
  readOnly: boolean;
  maxClassification: Classification;
  allowed: AccessAction[];
};

export const ROLE_POLICY: Record<Role, Policy> = {
  IO: {
    requiresAssignment: true,
    readOnly: false,
    maxClassification: "PROTECTED_VICTIM_WITNESS",
    allowed: ["view_case", "view_document", "upload", "transfer_custody", "share", "ask_assistant", "accept_custody", "review_ocr", "create_case", "edit_case"],
  },
  SHO: {
    requiresAssignment: true,
    readOnly: false,
    maxClassification: "PROTECTED_VICTIM_WITNESS",
    allowed: [
      "view_case",
      "view_document",
      "upload",
      "approve",
      "transfer_custody",
      "share",
      "view_audit",
      "ask_assistant",
      "accept_custody",
      "review_ocr",
      "create_case",
      "edit_case",
      "archive"
    ],
  },
  FORENSIC_EXPERT: {
    requiresAssignment: true,
    readOnly: false,
    maxClassification: "PROTECTED_VICTIM_WITNESS",
    allowed: ["view_case", "view_document", "upload", "ask_assistant", "accept_custody", "review_ocr"],
  },
  PROSECUTOR: {
    requiresAssignment: true,
    readOnly: true,
    maxClassification: "PROTECTED_VICTIM_WITNESS",
    allowed: ["view_case", "view_document", "export", "ask_assistant", "accept_custody"],
  },
  JUDGE_AUDITOR: {
    requiresAssignment: true,
    readOnly: true,
    maxClassification: "PROTECTED_VICTIM_WITNESS",
    allowed: ["view_case", "view_document", "view_audit", "export", "ask_assistant", "archive"],
  },
  ADMIN: {
    requiresAssignment: true,
    readOnly: true,
    maxClassification: "INTERNAL",
    allowed: ["view_audit", "manage_demo"],
  },
};

export type AccessInput = {
  role: Role;
  assigned: boolean;
  caseClassification: Classification;
  action: AccessAction;
  purpose?: string;
};

export type AccessDecision = {
  allowed: boolean;
  reason: string;
};

export function evaluateAccess(input: AccessInput): AccessDecision {
  const policy = ROLE_POLICY[input.role];

  if (!policy.allowed.includes(input.action)) {
    return { allowed: false, reason: `Role ${input.role} cannot perform ${input.action}` };
  }

  if (policy.requiresAssignment && !input.assigned) {
    return {
      allowed: false,
      reason: "Not assigned to this case",
    };
  }

  if (
    CLASSIFICATION_RANK[input.caseClassification] >
    CLASSIFICATION_RANK[policy.maxClassification]
  ) {
    return {
      allowed: false,
      reason: `Classification ${input.caseClassification} exceeds clearance for ${input.role}`,
    };
  }

  // Strict purpose check for high classification (B6 Fix)
  if (
    (input.action === "view_document" || input.action === "export") &&
    CLASSIFICATION_RANK[input.caseClassification] >= CLASSIFICATION_RANK["RESTRICTED"]
  ) {
    if (!input.purpose || input.purpose.trim() === "") {
      return {
        allowed: false,
        reason: `A mandatory purpose statement is required to access ${input.caseClassification} documents.`,
      };
    }
  }

  return { allowed: true, reason: "Authorized" };
}
