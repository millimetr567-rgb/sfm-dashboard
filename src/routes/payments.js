module.exports = async function (fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (request, reply) => {
    return fastify.prisma.payment.findMany({
      include: { client: true },
      orderBy: { date: 'desc' }
    })
  })

  fastify.post('/', async (request, reply) => {
    const { clientId, amount, notes, orderId, paymentMethod, originalAmount, exchangeRate, receiptUrl } = request.body
    const userId = request.user.id

    const client = await fastify.prisma.client.findUnique({ where: { id: clientId } })
    if (!client) return reply.code(404).send({ error: 'Mijoz topilmadi' })

    const payment = await fastify.prisma.payment.create({
      data: {
        clientId, orderId, amount, notes,
        paymentMethod: paymentMethod || 'USD',
        originalAmount: originalAmount || null,
        exchangeRate: exchangeRate || null,
        receiptUrl: receiptUrl || null,
        status: 'WAITING_APPROVAL'
      }
    })

    // Log action
    await fastify.prisma.log.create({
      data: {
        action: 'PAYMENT_SUBMITTED',
        actorId: userId,
        actorRole: request.user.role,
        metadata: JSON.stringify({ paymentId: payment.id, amount, clientId, orderId, paymentMethod })
      }
    })

    // Notify Admin via Telegram
    if (fastify.telegram) {
        // Send approval request for payment
        const msg = `🧾 *YANGI TO'LOV (TASDIQLASH KUTILMOQDA)*\n\n` +
                    `👤 Mijoz: *${client.name}*\n` +
                    `💰 Summa: *${amount} $*\n` +
                    `💳 Usul: ${paymentMethod}\n` +
                    `📝 Izoh: ${notes || '-'}`;
        
        const opts = {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Tasdiqlash', callback_data: `approve_pay_${payment.id}` },
                { text: '❌ Rad etish', callback_data: `reject_pay_${payment.id}` }
              ]
            ]
          }
        };
        // Use a default admin group or specific one
        const adminId = process.env.ADMIN_GROUP_ID || process.env.DEFAULT_TELEGRAM_GROUP_ID;
        if (adminId) fastify.telegram.bot.sendMessage(adminId, msg, opts);
    }

    return payment
  })

  // Approve Payment
  fastify.post('/:id/approve', async (request, reply) => {
    if (request.user.role !== 'ADMIN') return reply.code(403).send({ error: 'Ruxsat yo\'q' })
    const { id } = request.params
    const adminName = request.user.username

    const payment = await fastify.prisma.payment.findUnique({ 
        where: { id },
        include: { client: true }
    })
    if (!payment || payment.status !== 'WAITING_APPROVAL') return reply.code(400).send({ error: 'Tasdiqlash kutilmayapti' })

    const result = await fastify.prisma.$transaction(async (tx) => {
        // 1. Update Payment Status
        const updated = await tx.payment.update({
            where: { id },
            data: { status: 'CONFIRMED', approvedBy: adminName, approvedAt: new Date() }
        })

        // 2. Update Client Debt
        await tx.client.update({
            where: { id: payment.clientId },
            data: { currentDebt: { decrement: payment.amount } }
        })

        // 3. Update Order if linked
        if (payment.orderId) {
            await tx.order.update({
                where: { id: payment.orderId },
                data: { status: 'PAID', paymentMethod: payment.paymentMethod }
            })
        }

        return updated
    })

    // Notify via Telegram
    if (fastify.telegram) {
        await fastify.telegram.sendPaymentNotification(result, payment.client, request.user)
    }

    return result
  })
}
