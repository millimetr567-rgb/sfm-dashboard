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
    
    let generatedId = (customId && customId.trim()) ? customId.trim() : null;
    
    if (!generatedId) {
      // More robust ID generation avoiding collisions
      generatedId = 'MID-' + Date.now().toString().slice(-4) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
    }
    
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Mijoz ismini kiritish shart' });
    }

    const parsedLimit = parseFloat(creditLimit);
    const finalLimit = isNaN(parsedLimit) ? 0 : parsedLimit;

    return fastify.prisma.client.create({
      data: {
        customId: generatedId || null,
        name,
        phone: phone || null,
        address: address || null,
        creditLimit: finalLimit,
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
