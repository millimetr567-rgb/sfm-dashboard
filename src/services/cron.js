const cron = require('node-cron')

class CronService {
  setFastify(fastify) {
    this.fastify = fastify
  }

  init() {
    // Run daily at midnight 0 0 * * *
    // For demo purposes, we will just set up the schedule but let it be manually triggerable
    cron.schedule('0 0 * * *', async () => {
      console.log('Running daily cron jobs...')
      await this.processOverdueOrders()
      await this.checkCreditLimits()
      await this.sendDailyReports()
    })
  }

  async processOverdueOrders() {
    if (!this.fastify) return
    const { prisma, telegram } = this.fastify

    try {
      const overdueOrders = await prisma.order.findMany({
        where: {
          due_date: { lt: new Date() },
          isLateProcessed: false,
          status: { notIn: ['PAID', 'CANCELLED'] }
        },
        include: { client: true }
      })

      for (const order of overdueOrders) {
        const newLateCount = order.client.lateCount + 1
        const shouldBlacklist = newLateCount >= 3

        await prisma.$transaction(async (tx) => {
          // Update Order
          await tx.order.update({
            where: { id: order.id },
            data: { isLateProcessed: true }
          })

          // Update Client
          await tx.client.update({
            where: { id: order.client.id },
            data: { 
              lateCount: newLateCount,
              status: shouldBlacklist ? 'BLACKLIST' : order.client.status
            }
          })

          // Log Action
          await tx.log.create({
            data: {
              action: 'LATE_ORDER_PROCESSED',
              actorRole: 'SYSTEM_CRON',
              metadata: JSON.stringify({ orderId: order.id, clientId: order.client.id, newLateCount })
            }
          })

          if (shouldBlacklist) {
            await tx.log.create({
              data: {
                action: 'AUTO_BLACKLIST',
                actorRole: 'SYSTEM_CRON',
                metadata: JSON.stringify({ clientId: order.client.id, reason: 'Late > 3 times' })
              }
            })
          }
        })

        if (telegram && telegram.bot && order.client.telegramGroupId) {
          const msg = `⚠️ *Ogohlantirish!*\n\n` +
                      `Sizning ${order.id} raqamli zakazingiz to'lov muddati o'tdi.\n` +
                      `Kechikishlar soni: ${newLateCount}\n` +
                      (shouldBlacklist ? `🔴 Sizning hisobingiz *BLACKLIST*ga kiritildi. Yangi zakaz bera olmaysiz.` : '');
          try {
            await telegram.bot.sendMessage(order.client.telegramGroupId, msg, { parse_mode: 'Markdown' })
          } catch(e) { console.error('Telegram err on cron limit alert:', e) }
        }
      }
      
      console.log(`Processed ${overdueOrders.length} overdue orders.`)
      return { msg: `Processed ${overdueOrders.length} overdue orders.` }
    } catch (err) {
      console.error('Error in processOverdueOrders:', err)
      throw err;
    }
  }

  async checkCreditLimits() {
    if (!this.fastify) return
    const { prisma, telegram } = this.fastify

    try {
      const activeClients = await prisma.client.findMany({
        where: { status: 'ACTIVE', currentDebt: { gt: 0 } }
      })

      let notifiedCount = 0;
      for (const client of activeClients) {
        if (client.currentDebt >= client.creditLimit * 0.8) {
          notifiedCount++;
          if (telegram && telegram.bot && client.telegramGroupId) {
             const msg = `⚠️ *Kredit Limit Ogohlantirishi*\n\n` +
                         `Hurmatli ${client.name}, siz ishlatgan qarz ${client.currentDebt.toLocaleString()} / ${client.creditLimit.toLocaleString()} so'mga yetdi.\n` +
                         `Qarzingizni tezroq qoplashingizni so'raymiz.`;
             try {
                await telegram.bot.sendMessage(client.telegramGroupId, msg, { parse_mode: 'Markdown' })
             } catch(e) {}
          }
        }
      }
      console.log(`Checked credit limits. Notified ${notifiedCount} clients.`)
      return { msg: `Checked credit limits. Notified ${notifiedCount} clients.` }
    } catch (err) {
      console.error('Error in checkCreditLimits:', err)
      throw err;
    }
  }

  async sendDailyReports() {
    if (!this.fastify) return
    const { prisma, telegram } = this.fastify

    try {
      // 1. Daily Debtors Report to Admin
      const debtors = await prisma.client.findMany({
         where: { currentDebt: { gt: 0 } },
         orderBy: { currentDebt: 'desc' }
      })
      if (debtors.length > 0) {
         let msg = `🔴 *Kunlik Qarzdorlar Ro'yxati*\n\n`
         debtors.forEach(c => {
            msg += `👤 ${c.name}: ${c.currentDebt.toLocaleString()} $\n`
         })
         await telegram.broadcastToAdmins(msg)
      }

      // 2. Daily Agent Report
      const start = new Date()
      start.setHours(0,0,0,0)

      const orders = await prisma.order.findMany({
         where: { createdAt: { gte: start } },
         include: { agent: true }
      })
      let agentSales = {}
      for(const o of orders) {
         const agName = o.agent ? o.agent.username : 'Noma`lum'
         if(!agentSales[agName]) agentSales[agName] = 0
         agentSales[agName] += o.amount
      }

      const dString = `${start.getDate().toString().padStart(2, '0')}.${(start.getMonth() + 1).toString().padStart(2, '0')}.${start.getFullYear()}`
      let msg2 = `📊 *Kunlik Agent Hisoboti*\nSana: ${dString}\n\n`
      if (Object.keys(agentSales).length > 0) {
          for(const [ag, sum] of Object.entries(agentSales)) {
             msg2 += `👨‍💼 Sotuvchi: ${ag} ➜ Savdo: ${sum.toLocaleString()} $\n`
          }
      } else {
          msg2 += "Bugun savdo qilinmadi."
      }
      
      await telegram.broadcastToAdmins(msg2)
      console.log('Sent daily admin reports')
      return { msg: "Reports sent successfully" }

    } catch (err) {
      console.error('Error in sendDailyReports:', err)
      throw err;
    }
  }
}

module.exports = new CronService()
