require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const sqlite = require('better-sqlite3');
const bcrypt = require('bcryptjs');

async function check() {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  const prisma = new PrismaClient({ adapter });
  
  const agents = await prisma.agent.findMany();
  console.log('Current agents in DB:');
  agents.forEach(a => console.log(`- ${a.username} (role: ${a.role})`));
  
  // Also reset admin specifically to be sure
  const username = 'admin';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);
  
  await prisma.agent.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash, role: 'ADMIN' }
  });
  console.log('Admin password reset to: admin123');
  
  await prisma.$disconnect();
}

check().catch(console.error);
