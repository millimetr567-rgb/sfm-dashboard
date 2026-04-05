const bcrypt = require('bcryptjs')

module.exports = async function (fastify, opts) {
  fastify.post('/register', async (request, reply) => {
    const { username, password, role, permissions } = request.body
    
    // Check if agent already exists
    const existing = await fastify.prisma.agent.findUnique({
      where: { username }
    })
    
    if (existing) {
      return reply.code(400).send({ error: 'Username already taken' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    
    const agent = await fastify.prisma.agent.create({
      data: { 
          username, 
          passwordHash, 
          role: role || 'AGENT',
          permissions: permissions || 'all'
      }
    })

    return { id: agent.id, username: agent.username, role: agent.role, permissions: agent.permissions }
  })

  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body
    
    const agent = await fastify.prisma.agent.findUnique({
      where: { username }
    })
    
    if (!agent || !(await bcrypt.compare(password, agent.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = await reply.jwtSign({ 
        id: agent.id, 
        username: agent.username, 
        role: agent.role,
        permissions: agent.permissions || 'all'
    })
    
    return { token, agent: { 
        id: agent.id, 
        username: agent.username, 
        role: agent.role,
        permissions: agent.permissions || 'all'
    } }
  })

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return request.user
  })
}
