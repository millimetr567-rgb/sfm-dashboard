const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.agent.findMany();
  console.log("Users in DB:", users);
}
check().finally(() => prisma.$disconnect());
