require('dotenv').config()
const fastify = require('fastify')({ logger: true })
const path = require('path')

// Register Plugins
fastify.register(require('@fastify/cors'), { origin: '*' })
fastify.register(require('./plugins/prisma'))
fastify.register(require('./plugins/auth'))

// Telegram Service
const telegramService = require('./services/telegram')
telegramService.setFastify(fastify)
fastify.decorate('telegram', telegramService)

// Cron Service
const cronService = require('./services/cron')
cronService.setFastify(fastify)
cronService.init()

// Register Routes
fastify.register(require('./routes/auth'), { prefix: '/api/auth' })
fastify.register(require('./routes/clients'), { prefix: '/api/clients' })
fastify.register(require('./routes/orders'), { prefix: '/api/orders' })
fastify.register(require('./routes/payments'), { prefix: '/api/payments' })
fastify.register(require('./routes/products'), { prefix: '/api/products' })
fastify.register(require('./routes/cron'), { prefix: '/api/cron' })
fastify.register(require('./routes/settings'), { prefix: '/api/settings' })
fastify.register(require('./routes/admin'), { prefix: '/api/admin' })

// Default route
fastify.get('/', async () => {
  return { status: 'ok', msg: 'Agent Boshqaruv Tizimi API' }
})

const start = async () => {
  try {
    const port = process.env.PORT || 3000
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`Server is running at http://localhost:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
