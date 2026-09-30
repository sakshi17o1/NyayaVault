const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  await prisma.auditLog.create({
    data: {
      actorId: "cmugynx9s0001tpro7kfuft22",
      role: "SHO",
      caseId: "cmugynxba0007tpronqw6xp2n",
      action: "UPLOAD",
      result: "DENIED",
      reason: "Malware detected in file: test_virus.pdf"
    }
  });
  console.log("Inserted test malware log");
}

run().catch(console.error).finally(() => prisma.$disconnect());
