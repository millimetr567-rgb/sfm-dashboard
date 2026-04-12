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

  // 4. Dashboard Stats
  fastify.get('/stats', async (request, reply) => {
    // totalSales
    const completedOrders = await fastify.prisma.order.findMany({
        where: { status: { in: ['CONFIRMED', 'PAID'] } }
    })
    const totalSales = completedOrders.reduce((acc, o) => acc + o.amount, 0)

    // activeClients
    const activeClients = await fastify.prisma.client.count({
        where: { status: 'ACTIVE' }
    })

    // unapproved orders / pending orders count
    const pendingOrdersCount = await fastify.prisma.order.count({
        where: { status: { in: ['WAITING_APPROVAL', 'PENDING_APPROVAL', 'PENDING_PAYMENT'] } }
    })

    // low stock products (stock < 5)
    const lowStockProducts = await fastify.prisma.product.findMany({
        where: { stock: { lt: 5 } },
        select: { id: true, name: true, stock: true }
    })

    // Recent Sales for Chart (last 30 days roughly, we mock it by grouping by date simply)
    const recent = []
    const now = new Date()
    for(let i = 14; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const dateStr = `${d.getDate()}/${d.getMonth()+1}`
        
        // Sum up orders for this day
        const daySum = completedOrders.filter(o => 
            new Date(o.createdAt).getDate() === d.getDate() && 
            new Date(o.createdAt).getMonth() === d.getMonth()
        ).reduce((acc, o) => acc + o.amount, 0)
        
        recent.push({ date: dateStr, sales: daySum })
    }

    return {
      totalSales,
      activeClients,
      orderCount: pendingOrdersCount,
      lowStock: lowStockProducts.length,
      lowStockItems: lowStockProducts,
      recentSales: recent
    }
  })
}
