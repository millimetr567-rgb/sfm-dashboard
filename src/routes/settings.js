
module.exports = async function (fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate)

  // Singleton settings getter
  fastify.get('/', async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Ruxsat yo\'q!' });
    }
    
    let settings = await fastify.prisma.settings.findUnique({
      where: { id: 'singleton' }
    });
    
    if (!settings) {
      settings = await fastify.prisma.settings.create({
        data: { id: 'singleton' }
      });
    }
    
    return settings;
  });

  // Singleton settings updater
  fastify.post('/', async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Ruxsat yo\'q!' });
    }
    
    const data = request.body;
    // Remove ID if provided to prevent accidental new records
    delete data.id;
    
    const settings = await fastify.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { ...data, id: 'singleton' }
    });
    
    // Reload Telegram bot with new token if provided
    if (data.telegramToken && fastify.telegram) {
        await fastify.telegram.initBot(data.telegramToken);
    }
    
    return settings;
  });
}
