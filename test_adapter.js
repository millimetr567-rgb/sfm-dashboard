const { PrismaClient } = require('@prisma/client')
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const sqlite = require('better-sqlite3')

try {
  const adapter = new PrismaBetterSqlite3({ url: 'file:prisma/dev.db' })
  console.log('Adapter created:', !!adapter)
  
  const prisma = new PrismaClient({ adapter })
  console.log('Prisma Client created')
  
  prisma.$connect().then(() => {
    console.log('Connected!')
    process.exit(0)
  }).catch(err => {
    console.error('Connect failed:', err)
    process.exit(1)
  })
} catch (e) {
  console.error('Error during init:', e)
  process.exit(1)
}
