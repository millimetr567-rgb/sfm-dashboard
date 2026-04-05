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
    try {
      const { clientId, coordinates, due_date, driverPhone, items } = request.body
      const agentId = request.user.id
      const userRole = request.user.role

      if (!clientId) return reply.code(400).send({ error: 'Mijoz tanlanmagan' })
      const client = await fastify.prisma.client.findUnique({ where: { id: clientId } })
      if (!client) return reply.code(404).send({ error: 'Mijoz topilmadi' })
      if (client.status === 'BLACKLIST') return reply.code(403).send({ error: 'Mijoz qora ro\'yxatda!' })
      if (!items || !items.length) return reply.code(400).send({ error: 'Kamida bitta mahsulot tanlanishi kerak' })

      let totalAmount = 0
      const resolvedItems = []
      for (const item of items) {
        const dbProduct = await fastify.prisma.product.findUnique({ where: { id: item.productId } })
        if (!dbProduct) return reply.code(400).send({ error: `Mahsulot topilmadi: ${item.productId}` })
        
        const q = parseFloat(item.quantity)
        if (isNaN(q) || q <= 0) return reply.code(400).send({ error: 'Noto\'g\'ri miqdor' })
        
        if (q > dbProduct.stock) {
          return reply.code(400).send({ error: `Omborda ${dbProduct.name} mahsulotidan yetarli miqdor yo'q (Skladda: ${dbProduct.stock} ta)` })
        }

        const price = parseFloat(item.price) || 0
        totalAmount += price * q
        resolvedItems.push({ productId: dbProduct.id, quantity: q, price: price })
      }

      const orderStatus = 'PENDING_PAYMENT'
      let finalDueDate = null
      if (due_date) {
        const d = new Date(due_date)
        if (!isNaN(d.getTime())) finalDueDate = d
      }

      const result = await fastify.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            clientId, agentId, amount: totalAmount,
            driverPhone, coordinates, 
            status: orderStatus,
            isDebt: false, 
            paymentMethod: 'PENDING',
            due_date: finalDueDate,
            items: { create: resolvedItems.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })) }
          },
          include: { client: true, agent: true, items: { include: { product: true } } }
        })

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

      try {
          if (fastify.telegram) {
              await fastify.telegram.sendOrderNotification(result);
          }
      } catch (e) {
          console.error('[Orders] Telegram Notification Error:', e.message);
      }
      return result
    } catch (err) {
      console.error('[Orders] Create Error:', err);
      return reply.code(500).send({ error: 'Buyurtma yaratishda xato yuz berdi: ' + err.message })
    }
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
