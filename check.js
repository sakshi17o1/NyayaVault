const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const logs = await prisma.auditLog.findMany({
    where: { action: 'UPLOAD', result: 'DENIED' }
  });
  console.log("LOGS:", JSON.stringify(logs, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
