import { PrismaClient, Role, Classification, CaseStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234!";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.auditLog.deleteMany();
  await prisma.shareToken.deleteMany();
  await prisma.ledgerEvent.deleteMany();
  await prisma.ocrRevision.deleteMany();
  await prisma.ocrExtraction.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.documentChunk.deleteMany();
  await prisma.custodyEvent.deleteMany();
  await prisma.document.deleteMany();
  await prisma.aiSummary.deleteMany();
  await prisma.physicalExhibit.deleteMany();
  await prisma.caseAssignment.deleteMany();
  await prisma.accessPolicy.deleteMany();
  await prisma.caseRecord.deleteMany();
  await prisma.session.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.user.deleteMany();

  const io = await prisma.user.create({
    data: {
      email: "io.mehra@nyayavault.demo",
      name: "IO Kavya Mehra (Fictional)",
      passwordHash,
      role: Role.IO,
      station: "PS Fictional Nagar",
      department: "Women Safety Cell (Demo)",
    },
  });

  const sho = await prisma.user.create({
    data: {
      email: "sho.kapoor@nyayavault.demo",
      name: "SHO Rohan Kapoor (Fictional)",
      passwordHash,
      role: Role.SHO,
      station: "PS Fictional Nagar",
      department: "Station House (Demo)",
    },
  });

  const forensic = await prisma.user.create({
    data: {
      email: "forensic.nair@nyayavault.demo",
      name: "Forensic Expert Leela Nair (Fictional)",
      passwordHash,
      role: Role.FORENSIC_EXPERT,
      station: "Fictional Regional FSL",
      department: "e-Forensics Mock Lab",
    },
  });

  const prosecutor = await prisma.user.create({
    data: {
      email: "pp.sharma@nyayavault.demo",
      name: "Prosecutor Arjun Sharma (Fictional)",
      passwordHash,
      role: Role.PROSECUTOR,
      station: "Fictional District Court Complex",
      department: "e-Prosecution Mock Cell",
    },
  });

  const auditor = await prisma.user.create({
    data: {
      email: "auditor.iyer@nyayavault.demo",
      name: "Judge/Auditor N. Iyer (Fictional)",
      passwordHash,
      role: Role.JUDGE_AUDITOR,
      station: "Fictional District Court",
      department: "Oversight / Court Record (Demo)",
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@nyayavault.demo",
      name: "System Admin Divyansh Rajat",
      passwordHash,
      role: Role.ADMIN,
      station: "NyayaVault Demo Control",
      department: "Platform",
    },
  });

  const outsider = await prisma.user.create({
    data: {
      email: "io.unassigned@nyayavault.demo",
      name: "IO Vikram Dutt (Fictional, other station)",
      passwordHash,
      role: Role.IO,
      station: "PS Other Line",
      department: "Cyber Cell (Demo)",
    },
  });

  const womenSafety = await prisma.caseRecord.create({
    data: {
      caseNumber: "WS-2026-0001",
      cctnsRef: "CCTNS-MOCK-WS-4418",
      firNumber: "FIR-FN-2026-4418",
      title: "Fictional Riverbank Women Safety Enquiry",
      station: "PS Fictional Nagar",
      status: CaseStatus.UNDER_INVESTIGATION,
      classification: Classification.PROTECTED_VICTIM_WITNESS,
      summary:
        "Case summary pending. Please upload evidence documents and click 'Generate AI Summary' to populate this field.",
    },
  });

  const otherCase = await prisma.caseRecord.create({
    data: {
      caseNumber: "CY-2026-0099",
      cctnsRef: "CCTNS-MOCK-CY-0099",
      firNumber: "FIR-OL-2026-1102",
      title: "Fictional Cyber Cafe Theft Enquiry",
      station: "PS Other Line",
      status: CaseStatus.OPEN,
      classification: Classification.INTERNAL,
      summary:
        "Case summary pending. Please upload evidence documents and click 'Generate AI Summary' to populate this field.",
    },
  });

  const assigned = [
    { userId: io.id, caseId: womenSafety.id, purpose: "investigation" },
    { userId: sho.id, caseId: womenSafety.id, purpose: "supervision" },
    { userId: forensic.id, caseId: womenSafety.id, purpose: "forensic_examination" },
    { userId: prosecutor.id, caseId: womenSafety.id, purpose: "prosecution_review" },
    { userId: auditor.id, caseId: womenSafety.id, purpose: "integrity_audit" },
    { userId: outsider.id, caseId: otherCase.id, purpose: "investigation" },
  ];

  await prisma.caseAssignment.createMany({ data: assigned });

  await prisma.accessPolicy.createMany({
    data: [
      {
        role: Role.IO,
        requiresAssignment: true,
        readOnly: false,
        purposeRequired: true,
        maxClassification: Classification.PROTECTED_VICTIM_WITNESS,
        notes: "Assigned cases only. Upload and manage investigation documents.",
      },
      {
        role: Role.SHO,
        requiresAssignment: true,
        readOnly: false,
        purposeRequired: true,
        maxClassification: Classification.PROTECTED_VICTIM_WITNESS,
        notes: "Station cases. Review, approve, transfer.",
      },
      {
        role: Role.FORENSIC_EXPERT,
        requiresAssignment: true,
        readOnly: false,
        purposeRequired: true,
        maxClassification: Classification.PROTECTED_VICTIM_WITNESS,
        notes: "Assigned evidence and forensic reports.",
      },
      {
        role: Role.PROSECUTOR,
        requiresAssignment: true,
        readOnly: true,
        purposeRequired: true,
        maxClassification: Classification.PROTECTED_VICTIM_WITNESS,
        notes: "Assigned cases. Protected victim/witness fields must be redacted before external share or LLM (Phase 5–6).",
      },
      {
        role: Role.JUDGE_AUDITOR,
        requiresAssignment: true,
        readOnly: true,
        purposeRequired: true,
        maxClassification: Classification.PROTECTED_VICTIM_WITNESS,
        notes: "Read-only integrity verification and audit export.",
      },
      {
        role: Role.ADMIN,
        requiresAssignment: true,
        readOnly: true,
        purposeRequired: true,
        maxClassification: Classification.INTERNAL,
        notes: "Manages demo configuration. Does not silently bypass case ABAC or the audit trail.",
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      role: Role.ADMIN,
      action: "LOGIN",
      result: "SUCCESS",
      reason: "Seed complete — fictional dataset initialized",
      metadata: JSON.stringify({ seed: true, womenSafetyCase: womenSafety.caseNumber }),
    },
  });

  console.log("Seeded NyayaVault demo users and cases.");
  console.log("Women-safety case:", womenSafety.caseNumber, womenSafety.id);
  console.log("Unauthorized IO:", outsider.email, "assigned only to", otherCase.caseNumber);
  console.log("Password for all demo accounts:", DEMO_PASSWORD);
  console.log("MFA OTP:", process.env.DEMO_OTP ?? "000000");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
