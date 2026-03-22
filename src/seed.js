require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const sqlite = require('better-sqlite3')
const bcrypt = require('bcryptjs')

const url = process.env.DATABASE_URL || "file:./dev.db"
const adapter = new PrismaBetterSqlite3({ url })
const prisma = new PrismaClient({ adapter })

async function main() {
  const username = 'admin'
  const password = 'admin123'
  const passwordHash = await bcrypt.hash(password, 10)

  const admin = await prisma.agent.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash,
      role: 'ADMIN'
    }
  })

  console.log('Seeded admin agent:', admin.username)
  
  // Create a test client
  const client = await prisma.client.create({
    data: {
      name: 'Test Client 1',
      creditLimit: 5000000,
      currentDebt: 0
    }
  })
  
  console.log('Seeded test client:', client.name)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
