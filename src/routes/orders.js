module.exports = async function (fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (request, reply) => {
    return fastify.prisma.order.findMany({
      include: { client: true, agent: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    })
  })

  // Create Order
  fastify.post('/', async (request, reply) => {
    const { clientId, coordinates, due_date, driverPhone, items } = request.body
    const agentId = request.user.id
    const userRole = request.user.role

    const client = await fastify.prisma.client.findUnique({ where: { id: clientId } })
    if (!client) return reply.code(404).send({ error: 'Mijoz topilmadi' })
    if (client.status === 'BLACKLIST') return reply.code(403).send({ error: 'Mijoz qora ro\'yxatda!' })
    if (!items || !items.length) return reply.code(400).send({ error: 'Kamida bitta mahsulot tanlanishi kerak' })

    let totalAmount = 0
    const resolvedItems = []
    for (const item of items) {
      const dbProduct = await fastify.prisma.product.findUnique({ where: { id: item.productId } })
      if (!dbProduct) return reply.code(400).send({ error: `Mahsulot topilmadi: ${item.productId}` })
      
      const price = parseFloat(item.price)
      totalAmount += price * item.quantity
      resolvedItems.push({ productId: dbProduct.id, quantity: item.quantity, price: price })
    }

    const orderStatus = 'PENDING_PAYMENT'

    const result = await fastify.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          clientId, agentId, amount: totalAmount,
          driverPhone, coordinates, 
          status: orderStatus,
          isDebt: false, // will be set in Kassa
          paymentMethod: 'PENDING',
          due_date: due_date ? new Date(due_date) : null,
          items: { create: resolvedItems.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })) }
        },
        include: { client: true, agent: true, items: { include: { product: true } } }
      })

      // We do NOT update currentDebt here anymore. It happens on payment approval.
      
      for (const i of resolvedItems) {
         await tx.product.update({
            where: { id: i.productId },
            data: { stock: { decrement: i.quantity } }
         })
      }

      await tx.log.create({
        data: {
          action: 'CREATE_ORDER',
          actorId: agentId,
          actorRole: userRole,
          metadata: JSON.stringify({ orderId: order.id, amount: totalAmount, clientId, status: orderStatus })
        }
      })

      return order
    })

    await fastify.telegram.sendOrderNotification(result)
    return result
  })

  // Approve Order
  fastify.post('/:id/approve', async (request, reply) => {
    if (request.user.role !== 'ADMIN') return reply.code(403).send({ error: 'Ruxsat yo\'q' })
    const { id } = request.params
    
    const order = await fastify.prisma.order.findUnique({ 
        where: { id },
        include: { client: true, items: true }
    })
    
    // Accept WAITING_APPROVAL, PENDING_PAYMENT, or PENDING_APPROVAL status for confirmation
    const allowed = ['WAITING_APPROVAL', 'PENDING_PAYMENT', 'PENDING_APPROVAL'];
    if (!order || !allowed.includes(order.status)) {
        return reply.code(400).send({ error: 'Bu buyurtmani tasdiqlash imkoniyati yo`q (Holati: ' + (order?.status || 'noma`lum') + ')' })
    }

    return await fastify.prisma.$transaction(async (tx) => {
       const updated = await tx.order.update({
           where: { id },
           data: { status: 'CONFIRMED', approvedBy: request.user.username, approvedAt: new Date() },
           include: { client: true, agent: true, items: { include: { product: true } } }
       })
       await tx.client.update({
           where: { id: order.clientId },
           data: { currentDebt: { increment: order.amount } }
       })
       await fastify.telegram.sendOrderNotification(updated)
       return updated
    })
  })

  // Reject Order
  fastify.post('/:id/reject', async (request, reply) => {
    if (request.user.role !== 'ADMIN') return reply.code(403).send({ error: 'Ruxsat yo\'q' })
    const { id } = request.params
    
    const order = await fastify.prisma.order.findUnique({ 
        where: { id },
        include: { items: true }
    })
    if (!order || order.status !== 'WAITING_APPROVAL') return reply.code(400).send({ error: 'Tasdiqlash kutilmayapti' })

    return await fastify.prisma.$transaction(async (tx) => {
       const updated = await tx.order.update({
           where: { id },
           data: { status: 'CANCELLED' }
       })
       // Return stock
       for (const i of order.items) {
          await tx.product.update({
             where: { id: i.productId },
             data: { stock: { increment: i.quantity } }
          })
       }
       return updated
    })
  })

  fastify.put('/:id', async (request, reply) => {
    if (request.user.role !== 'ADMIN') return reply.code(403).send({ error: 'Ruxsat yo\'q' })
    const { id } = request.params
    const { amount, status, driverPhone, due_date } = request.body

    const updated = await fastify.prisma.order.update({
      where: { id },
      data: {
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        status: status || undefined,
        driverPhone: driverPhone || undefined,
        due_date: due_date ? new Date(due_date) : undefined
      }
    })
    return updated
  })

  fastify.delete('/:id', async (request, reply) => {
    if (request.user.role !== 'ADMIN') return reply.code(403).send({ error: 'Faqat admin o\'chira oladi' })
    const { id } = request.params
    await fastify.prisma.orderItem.deleteMany({ where: { orderId: id } })
    await fastify.prisma.order.delete({ where: { id } })
    return { success: true }
  })
}
