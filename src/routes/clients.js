module.exports = async function (fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (request, reply) => {
    return fastify.prisma.client.findMany({
      orderBy: { createdAt: 'desc' }
    })
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params
    return fastify.prisma.client.findUnique({
      where: { id }
    })
  })

  // New: Get Client History for Debt Analysis (AKT Sverka)
  fastify.get('/:id/history', async (request, reply) => {
    const { id } = request.params
    const orders = await fastify.prisma.order.findMany({
      where: { clientId: id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    })
    const payments = await fastify.prisma.payment.findMany({
      where: { clientId: id },
      orderBy: { date: 'desc' }
    })
    return { orders, payments }
  })

  fastify.post('/', async (request, reply) => {
    const { name, phone, address, creditLimit, telegramGroupId, customId } = request.body
    
    let generatedId = customId;
    if (!generatedId) {
      for (let i = 0; i < 5; i++) {
        const temp = 'MID-' + Math.floor(1000 + Math.random() * 9000);
        const existing = await fastify.prisma.client.findUnique({ where: { customId: temp } })
        if (!existing) {
          generatedId = temp;
          break;
        }
      }
    }

    return fastify.prisma.client.create({
      data: {
        customId: generatedId || null,
        name,
        phone: phone || null,
        address: address || null,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : 10000.0,
        telegramGroupId: telegramGroupId || null
      }
    })
  })

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params
    const { name, phone, address, creditLimit, status, telegramGroupId, telegramUserId, customId } = request.body
    
    return fastify.prisma.client.update({
      where: { id },
      data: {
        customId,
        name,
        phone,
        address,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined,
        status,
        telegramGroupId,
        telegramUserId
      }
    })
  })

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params
    return fastify.prisma.client.delete({
      where: { id }
    })
  })
}
