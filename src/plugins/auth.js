const fp = require('fastify-plugin')
const jwt = require('@fastify/jwt')

module.exports = fp(async (fastify, opts) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-key-123'
  })

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })
})
