const cron = require('node-cron')

class CronService {
  setFastify(fastify) {
    this.fastify = fastify
  }

  init() {
    // Run daily at 23:55 Tashkent time
    cron.schedule('55 23 * * *', async () => {
      console.log('Running daily cron jobs...')
      await this.processOverdueOrders()
      await this.checkCreditLimits()
      await this.sendDailyReports()
    }, { timezone: 'Asia/Tashkent' })
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

        if (telegram && telegram.bot) {
          const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
          const template = settings?.templateQarz || "Assalomu alaykum, hurmatli mijoz @name. Sizning eski qarzingiz mavjud: @cur_sum$. O‘tib ketgan muddati @days kun.";
          
          // Calculate days overdue
          const diff = Math.abs(new Date() - new Date(order.due_date));
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));

          const msg = telegram.parseTemplate(template, {
            name: order.client.name,
            cur_sum: order.client.currentDebt,
            days: days
          });

          const chatIds = [settings?.chatId1, settings?.chatId2, settings?.chatId3].filter(id => id);
          if (chatIds.length === 0 && order.client.telegramGroupId) chatIds.push(order.client.telegramGroupId);

          for (const tid of chatIds) {
            try {
              await telegram.bot.sendMessage(tid, msg, { parse_mode: 'Markdown' });
            } catch(e) { console.error(`Telegram err on cron limit alert for ${tid}:`, e.message); }
          }
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
      const start = new Date()
      start.setHours(0,0,0,0)
      const end = new Date()
      end.setHours(23,59,59,999)

      // 1. Fetch Today's Data
      const [todayOrders, todayPayments, allClients] = await Promise.all([
        prisma.order.findMany({ where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } }, include: { agent: true } }),
        prisma.payment.findMany({ where: { date: { gte: start, lte: end }, status: 'CONFIRMED' } }),
        prisma.client.findMany({ where: { currentDebt: { gt: 0 } }, orderBy: { currentDebt: 'desc' } })
      ])

      const totalSales = todayOrders.reduce((s, o) => s + o.amount, 0)
      const totalPayments = todayPayments.reduce((s, p) => s + p.amount, 0)
      const totalDebtOverall = allClients.reduce((s, c) => s + c.currentDebt, 0)

      const dString = `${start.getDate().toString().padStart(2, '0')}.${(start.getMonth() + 1).toString().padStart(2, '0')}.${start.getFullYear()}`

      // 2. Build Report Message
      let msg = `📈 *KUNLIK HISOBOT* (${dString})\n\n` +
                `💰 *Savdo (USD):* $${totalSales.toLocaleString()}\n` +
                `💸 *To'lovlar (USD):* $${totalPayments.toLocaleString()}\n` +
                `📉 *Jami Qarzlar:* $${totalDebtOverall.toLocaleString()}\n\n` +
                `--- 👤 *TOP QARZDORLAR* ---\n`

      allClients.slice(0, 5).forEach((c, i) => {
         msg += `${i+1}. ${c.name}: *$${c.currentDebt.toLocaleString()}*\n`
      })

      if (todayOrders.length > 0) {
        msg += `\n--- 👨‍💼 *AGENTLAR SAVDOSI* ---\n`
        let agentSales = {}
        todayOrders.forEach(o => {
          const name = o.agent?.username || 'Noma\'lum'
          agentSales[name] = (agentSales[name] || 0) + o.amount
        })
        Object.entries(agentSales).forEach(([name, sum]) => {
          msg += `• ${name}: $${sum.toLocaleString()}\n`
        })
      }

      await telegram.broadcastToAdmins(msg)
      console.log('Detailed daily report sent successfully.')
      return { msg: "Reports sent successfully" }

    } catch (err) {
      console.error('Error in sendDailyReports:', err)
      throw err;
    }
  }
}

module.exports = new CronService()
