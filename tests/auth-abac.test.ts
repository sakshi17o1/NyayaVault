import { describe, expect, it } from "vitest";
import { evaluateAccess } from "@/lib/auth/abac";

describe("RBAC + case ABAC", () => {
  it("allows an assigned IO to view the protected women-safety case", () => {
    const decision = evaluateAccess({
      role: "IO",
      assigned: true,
      caseClassification: "PROTECTED_VICTIM_WITNESS",
      action: "view_case",
    });
    expect(decision.allowed).toBe(true);
  });

  it("denies an IO who is not assigned to the case", () => {
    const decision = evaluateAccess({
      role: "IO",
      assigned: false,
      caseClassification: "PROTECTED_VICTIM_WITNESS",
      action: "view_case",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/Not assigned/i);
  });

  it("denies Admin case view without assignment (no silent bypass)", () => {
    const decision = evaluateAccess({
      role: "ADMIN",
      assigned: false,
      caseClassification: "PROTECTED_VICTIM_WITNESS",
      action: "view_case",
    });
    expect(decision.allowed).toBe(false);
  });

  it("denies Admin view_case even if assigned, because the role cannot perform view_case", () => {
    const decision = evaluateAccess({
      role: "ADMIN",
      assigned: true,
      caseClassification: "PROTECTED_VICTIM_WITNESS",
      action: "view_case",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/cannot perform view_case/);
  });

  it("allows Judge/Auditor to view assigned case", () => {
    const decision = evaluateAccess({
      role: "JUDGE_AUDITOR",
      assigned: true,
      caseClassification: "PROTECTED_VICTIM_WITNESS",
      action: "view_case",
    });
    expect(decision.allowed).toBe(true);
  });
});
