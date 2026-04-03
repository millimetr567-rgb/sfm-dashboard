const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const pCount = await prisma.product.count();
  console.log("Products in DB:", pCount);
}
check().finally(() => prisma.$disconnect());
