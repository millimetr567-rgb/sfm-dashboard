const fp = require('fastify-plugin')
const { PrismaClient } = require('@prisma/client')

module.exports = fp(async (fastify, opts) => {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL
  })



  await prisma.$connect()

  fastify.decorate('prisma', prisma)
  
  fastify.addHook('onClose', async (fastify) => {
    await fastify.prisma.$disconnect()
  })
})
