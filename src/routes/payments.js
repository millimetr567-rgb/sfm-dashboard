module.exports = async function (fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (request, reply) => {
    return fastify.prisma.payment.findMany({
      include: { client: true },
      orderBy: { date: 'desc' }
    })
  })

  fastify.post('/', async (request, reply) => {
    const { 
        clientId, amount, notes, orderId, paymentMethod, originalAmount, exchangeRate, receiptUrl,
        cashAmount, terminalAmount, clickAmount, bankAmount, usdAmount, changeAmount, discountAmount, isConverted
    } = request.body
    const userId = request.user.id

    const client = await fastify.prisma.client.findUnique({ where: { id: clientId } })
    if (!client) return reply.code(404).send({ error: 'Mijoz topilmadi' })

    try {
        const payment = await fastify.prisma.payment.create({
          data: {
            clientId, orderId, 
            amount: parseFloat(amount) || 0, 
            notes: notes || null,
            paymentMethod: paymentMethod || 'Kalkulyator',
            originalAmount: originalAmount ? parseFloat(originalAmount) : null,
            exchangeRate: exchangeRate ? parseFloat(exchangeRate) : null,
            receiptUrl: receiptUrl || null,
            status: 'WAITING_APPROVAL',
            cashAmount: parseFloat(cashAmount) || 0,
            terminalAmount: parseFloat(terminalAmount) || 0,
            clickAmount: parseFloat(clickAmount) || 0,
            bankAmount: parseFloat(bankAmount) || 0,
            usdAmount: parseFloat(usdAmount) || 0,
            changeAmount: parseFloat(changeAmount) || 0,
            discountAmount: parseFloat(discountAmount) || 0,
            isConverted: isConverted !== undefined ? isConverted : true
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
          try {
            let breakDown = "";
            const fmt = (v) => parseFloat(v || 0).toLocaleString();
            if (parseFloat(cashAmount) > 0) breakDown += `🔹 Naqd (Sum): *${fmt(cashAmount)}*\n`;
            if (parseFloat(terminalAmount) > 0) breakDown += `🔹 Terminal: *${fmt(terminalAmount)}*\n`;
            if (parseFloat(clickAmount) > 0) breakDown += `🔹 Click/Payme: *${fmt(clickAmount)}*\n`;
            if (parseFloat(bankAmount) > 0) breakDown += `🔹 Pul ko'chirish: *${fmt(bankAmount)}*\n`;
            if (parseFloat(usdAmount) > 0) breakDown += `🔹 Valyuta ($): *${fmt(usdAmount)}*\n`;
            if (parseFloat(discountAmount) > 0) breakDown += `🔸 Bank Chegirma: *-${fmt(discountAmount)}*\n`;
            if (parseFloat(changeAmount) > 0) breakDown += `🔸 Qaytarish: *-${fmt(changeAmount)}*\n`;
    
            const msg = `🧾 *YANGI TO'LOV (TASDIQLASH KUTILMOQDA)*\n\n` +
                        `👤 Mijoz: *${client.name}*\n` +
                        `💰 Jami JORIY qilinadi: *${parseFloat(amount).toFixed(2)} $*\n` +
                        `💳 Usul: ${paymentMethod || 'Kalkulyator'}\n` +
                        (breakDown ? `\n*Tarkibi:*\n${breakDown}` : '') +
                        `📝 Izoh: ${notes || '-'}`;
            
            await fastify.telegram.sendConfirmationWithPDF(payment.id, msg);
          } catch (te) {
            console.error("[Payments] Telegram Error:", te.message);
          }
        }
    
        return payment
    } catch (err) {
        console.error("[Payments] Create Error:", err);
        return reply.code(500).send({ error: "To'lovni saqlashda xato: " + err.message });
    }
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

      // 2. Update Order if linked - and handle Debt safely
      if (payment.orderId) {
        const relatedOrder = await tx.order.findUnique({ where: { id: payment.orderId } })
        if (relatedOrder) {
          // If it was never added to debt (still pending), add it now
          if (['WAITING_APPROVAL', 'PENDING_PAYMENT', 'PENDING_APPROVAL'].includes(relatedOrder.status)) {
            await tx.client.update({
              where: { id: payment.clientId },
              data: { currentDebt: { increment: relatedOrder.amount } }
            })
          }

          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: 'PAID', paymentMethod: payment.paymentMethod }
          })
        }
      }

      // 3. Update Client Debt (always apply payment credit)
      await tx.client.update({
        where: { id: payment.clientId },
        data: { currentDebt: { decrement: payment.amount } }
      })

      return updated
    })

    // Notify via Telegram
    if (fastify.telegram) {
      await fastify.telegram.sendPaymentNotification(result, payment.client, request.user)
    }

    return result
  })
}
