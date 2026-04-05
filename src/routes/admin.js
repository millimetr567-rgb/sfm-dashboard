const bcrypt = require('bcryptjs')

module.exports = async function (fastify, opts) {
  fastify.addHook('preHandler', async (request, reply) => {
    await fastify.authenticate(request, reply)
    if (request.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Faqat admin ruxsatiga ega!' })
    }
  })

  // 1. Get all agents
  fastify.get('/agents', async (request, reply) => {
    return fastify.prisma.agent.findMany({
      select: { id: true, username: true, role: true, permissions: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    })
  })

  // Create Agent
  fastify.post('/agents', async (request, reply) => {
      const { username, password, role, permissions } = request.body
      const existing = await fastify.prisma.agent.findUnique({ where: { username } })
      if (existing) return reply.code(400).send({ error: 'Ushbu login band!' })
      const passwordHash = await bcrypt.hash(password, 10)
      const agent = await fastify.prisma.agent.create({
          data: { 
              username, 
              passwordHash, 
              role: role || 'AGENT', 
              permissions: permissions || 'all' 
          }
      })
      return { id: agent.id, username: agent.username, role: agent.role, permissions: agent.permissions }
  })

  // Update Agent
  fastify.put('/agents/:id', async (request, reply) => {
      const { id } = request.params
      const { password, role, permissions } = request.body
      let data = { role, permissions }
      if (password) {
          data.passwordHash = await bcrypt.hash(password, 10)
      }
      return await fastify.prisma.agent.update({
          where: { id },
          data,
          select: { id: true, username: true, role: true, permissions: true }
      })
  })

  // Delete Agent
  fastify.delete('/agents/:id', async (request, reply) => {
      const { id } = request.params
      await fastify.prisma.agent.delete({ where: { id } })
      return { success: true }
  })

  // 2. Get logs
  fastify.get('/logs', async (request, reply) => {
    const { agentId } = request.query
    const whereClause = agentId ? { actorId: agentId } : {}
    return fastify.prisma.log.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: 100 // Last 100 logs
    })
  })

  // 3. Generate Reports (Jami qarz, Jami pul)
  fastify.get('/reports', async (request, reply) => {
    // Total debt
    const clients = await fastify.prisma.client.findMany({
       select: { currentDebt: true }
    })
    const totalDebt = clients.reduce((sum, c) => sum + c.currentDebt, 0)

    // Total orders confirmed/paid
    const orders = await fastify.prisma.order.findMany({
       where: { status: { in: ['CONFIRMED', 'FULFILLED', 'PAID'] } },
       select: { amount: true }
    })
    const totalOrderAmount = orders.reduce((sum, o) => sum + o.amount, 0)

    // Total payments
    const payments = await fastify.prisma.payment.findMany({
       select: { amount: true }
    })
    const totalPaymentsAmount = payments.reduce((sum, p) => sum + p.amount, 0)

    return {
      totalDebt,
      totalOrderAmount,
      totalPaymentsAmount,
      timestamp: new Date()
    }
  })
}
