const fp = require('fastify-plugin')
const { PrismaClient } = require('@prisma/client')
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const sqlite = require('better-sqlite3')

module.exports = fp(async (fastify, opts) => {
  const url = process.env.DATABASE_URL || "file:./dev.db"
  const adapter = new PrismaBetterSqlite3({ url })
  const prisma = new PrismaClient({ adapter })

  await prisma.$connect()

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async (fastify) => {
    await fastify.prisma.$disconnect()
  })
})
