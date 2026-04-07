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

  // Create Client
  fastify.post('/', async (request, reply) => {
    const isAllowed = request.user.role === 'ADMIN' || 
                      (request.user.permissions && (request.user.permissions.includes('crm') || request.user.permissions === 'all'));
    if (!isAllowed) return reply.code(403).send({ error: 'Ruxsat yo\'q!' })
    const { name, phone, address, creditLimit, telegramGroupId, customId, telegramUsername } = request.body
    
    let generatedId = (customId && customId.trim()) ? customId.trim() : null;
    
    if (!generatedId) {
      // More robust ID generation: prefix + year-month-day-hour-minute + 4 digit random
      const now = new Date();
      const timestamp = now.toISOString().slice(2, 10).replace(/-/g, '') + now.toISOString().slice(11, 16).replace(/:/g, ''); // YYMMDDHHmm
      const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit random
      generatedId = 'M-' + timestamp + '-' + randomSuffix;
    }
    
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Mijoz ismini kiritish shart' });
    }

    const parsedLimit = parseFloat(creditLimit);
    const finalLimit = isNaN(parsedLimit) ? 0 : parsedLimit;

    try {
        const client = await fastify.prisma.client.create({
          data: {
            customId: generatedId || null,
            name,
            phone: phone || null,
            address: address || null,
            creditLimit: finalLimit,
            telegramGroupId: telegramGroupId || null,
            telegramUsername: telegramUsername || null
          }
        })
        return client
    } catch (e) {
        if (e.code === 'P2002') return reply.code(400).send({ error: "Xatolik: Ushbu ID'lik mijoz allaqachon mavjud yoki tizimda duplikat bor." })
        console.error("Create Client Error:", e);
        return reply.code(500).send({ error: "Mijozni saqlashda kutilmagan xato: " + e.message })
    }
  })

  // Update Client
  fastify.put('/:id', async (request, reply) => {
    const isAllowed = request.user.role === 'ADMIN' || 
                      (request.user.permissions && (request.user.permissions.includes('crm') || request.user.permissions === 'all'));
    if (!isAllowed) return reply.code(403).send({ error: 'Ruxsat yo\'q!' })
    const { id } = request.params
    const { name, phone, address, creditLimit, status, telegramGroupId, telegramUserId, customId, telegramUsername } = request.body
    
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
        telegramUserId,
        telegramUsername
      }
    })
  })

  // Delete Client
  fastify.delete('/:id', async (request, reply) => {
    const isAllowed = request.user.role === 'ADMIN' || 
                      (request.user.permissions && (request.user.permissions.includes('crm') || request.user.permissions === 'all'));
    if (!isAllowed) return reply.code(403).send({ error: 'Ruxsat yo\'q!' })
    const { id } = request.params
    return fastify.prisma.client.delete({
      where: { id }
    })
  })
}
