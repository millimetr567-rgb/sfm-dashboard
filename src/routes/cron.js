const cronService = require('../services/cron')

module.exports = async function (fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.post('/trigger-overdue', async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Faqat admin ruxsatiga ega!' })
    }
    const res = await cronService.processOverdueOrders()
    return res
  })

  fastify.post('/trigger-limits', async (request, reply) => {
    if (request.user.role !== 'ADMIN') return reply.code(403).send({ error: 'Faqat admin ruxsatiga ega!' })
    return await cronService.checkCreditLimits()
  })

  fastify.post('/trigger-reports', async (request, reply) => {
    if (request.user.role !== 'ADMIN') return reply.code(403).send({ error: 'Faqat admin ruxsatiga ega!' })
    return await cronService.sendDailyReports()
  })
}
