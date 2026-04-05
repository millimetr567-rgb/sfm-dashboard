module.exports = async function (fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (request, reply) => {
    return fastify.prisma.product.findMany({
      orderBy: { name: 'asc' }
    })
  })

  // Create Single Product (Admin or Agent with 'product' or 'all' permission)
  fastify.post('/', async (request, reply) => {
    const isAllowed = request.user.role === 'ADMIN' || 
                      (request.user.permissions && (request.user.permissions.includes('product') || request.user.permissions === 'all'));
    if (!isAllowed) return reply.code(403).send({ error: 'Ruxsat yo\'q!' })
    const { code, name, group, guarantee, costPrice, sellPrice, stock, minStock } = request.body
    
    if (!name) return reply.code(400).send({ error: 'Mahsulot nomi kiritilishi shart' })

    try {
        const product = await fastify.prisma.product.create({
          data: {
            code: code ? String(code).trim() : null,
            name, group, guarantee,
            costPrice: parseFloat(costPrice) || 0,
            sellPrice: parseFloat(sellPrice) || 0,
            stock: parseFloat(stock) || 0,
            minStock: parseFloat(minStock) || 0
          }
        })
        return product
    } catch (e) {
        if (e.code === 'P2002') return reply.code(400).send({ error: "Ushbu koddagi mahsulot allaqachon mavjud." })
        throw e
    }
  })

  // Bulk upsert products (from Excel)
  fastify.post('/bulk', async (request, reply) => {
    const isAllowed = request.user.role === 'ADMIN' || 
                      (request.user.permissions && (request.user.permissions.includes('product') || request.user.permissions === 'all'));
    if (!isAllowed) {
      return reply.code(403).send({ error: 'Faqat ruxsat berilgan foydalanuvchilar uchun!' })
    }

    const { products } = request.body
    if (!Array.isArray(products)) {
        return reply.code(400).send({ error: 'Noto`g`ri format. Mahsulotlar ro`yxati (array) kerak.' })
    }

    const results = []
    let currentGroupName = 'Boshqa'
    
    for (const p of products) {
      if (!p.name) continue

      // Smarter detection: A row is a product if any field besides name is present
      const hasStock = (p.stock !== undefined && p.stock !== null && p.stock !== '');
      const hasPrice = (p.sellPrice !== undefined && p.sellPrice !== null && p.sellPrice !== '');
      const hasCode = (p.code !== undefined && p.code !== null && p.code !== '');
      const hasCost = (p.costPrice !== undefined && p.costPrice !== null && p.costPrice !== '');

      const isHeader = !hasStock && !hasPrice && !hasCode && !hasCost;

      if (isHeader) {
          currentGroupName = p.name // Probably a category title
          continue
      }

      const code = p.code || null
      const group = p.group || currentGroupName
      const guarantee = p.guarantee || null
      const cost = parseFloat(p.costPrice) || 0
      const sell = parseFloat(p.sellPrice) || 0
      const stock = parseFloat(p.stock) || 0
      const minStock = parseFloat(p.minStock) || 0
      const productName = String(p.name || '').trim();
      const productCode = (code !== undefined && code !== null && String(code).trim() !== '') ? String(code).trim() : null;
      const groupName = group ? String(group).trim() : 'Boshqa';

      // Skip Excel header rows if they ended up in data
      if (productName.toLowerCase() === 'nomi' || productName.toLowerCase() === 'наименование') continue;
      if (productName.toLowerCase() === 'tovar guruhi' || productName.toLowerCase() === 'товарная группа') continue;

      let upserted = null;
      // Match ONLY by unique code. If no code, we always CREATE to avoid losing duplicates.
      if (productCode) {
          upserted = await fastify.prisma.product.findUnique({ where: { code: productCode } })
      }
      
      // If we found it by code, update. If not, CREATE a NEW record.
      try {
          const finalCode = String(productCode || '').trim();
          const finalName = String(productName || '').trim();
          
          if (upserted) {
              await fastify.prisma.product.update({
                 where: { id: upserted.id },
                 data: { 
                     code: finalCode || null, 
                     group: groupName, 
                     guarantee, 
                     costPrice: parseFloat(cost) || 0, 
                     sellPrice: parseFloat(sell) || 0, 
                     stock: parseInt(stock) || 0, 
                     minStock: parseInt(minStock) || 0 
                 }
              })
              results.push(upserted)
          } else {
              const created = await fastify.prisma.product.create({
                 data: { 
                     code: finalCode || null, 
                     group: groupName, 
                     guarantee, 
                     name: finalName, 
                     costPrice: parseFloat(cost) || 0, 
                     sellPrice: parseFloat(sell) || 0, 
                     stock: parseInt(stock) || 0, 
                     minStock: parseInt(minStock) || 0 
                 }
              })
              results.push(created)
          }
      } catch (err) {
          console.error("Bulk sync error for row:", productName, "Code:", productCode, "Error:", err.message)
      }
    }

    // Log the action
    await fastify.prisma.log.create({
        data: {
          action: 'BULK_UPLOAD_PRODUCTS',
          actorId: request.user.id,
          actorRole: request.user.role,
          metadata: JSON.stringify({ count: results.length })
        }
    })
    
    console.log(`BULK UPLOAD STATS: Total rows=${products.length}, Final synced=${results.length}`);
    return { count: results.length, status: 'success' }
  })

  // Delete All Products (Admin only)
  fastify.delete('/', async (request, reply) => {
    if (request.user.role !== 'ADMIN') return reply.code(403).send({ error: 'Ruxsat yo\'q!' })
    try {
      // Deep clean to allow deleting products
      await fastify.prisma.payment.deleteMany({});
      await fastify.prisma.orderItem.deleteMany({});
      await fastify.prisma.order.deleteMany({});
      
      const deleted = await fastify.prisma.product.deleteMany({})
      
      // Reset client stats
      await fastify.prisma.client.updateMany({ data: { currentDebt: 0 } });
      
      return { count: deleted.count, message: "Keskin tozalash: Barcha mahsulotlar hamda eski savdo/qarz tarixi butunlay o'chirildi!" }
    } catch(err) {
      console.log(err);
      return reply.code(500).send({ error: "O'chirishning imkoni bo'lmadi." })
    }
  })

  // Update Single Product
  fastify.put('/:id', async (request, reply) => {
    const isAllowed = request.user.role === 'ADMIN' || 
                      (request.user.permissions && (request.user.permissions.includes('product') || request.user.permissions === 'all'));
    if (!isAllowed) return reply.code(403).send({ error: 'Ruxsat yo\'q!' })
    const { id } = request.params
    const { code, name, costPrice, sellPrice, stock, minStock, group, guarantee } = request.body

    const updated = await fastify.prisma.product.update({
      where: { id },
      data: {
        code: code ? String(code).trim() : null,
        name, group, guarantee,
        costPrice: parseFloat(costPrice) || 0,
        sellPrice: parseFloat(sellPrice) || 0,
        stock: parseFloat(stock) || 0,
        minStock: parseFloat(minStock) || 0
      }
    })

    return updated
  })

  // Delete Single Product
  fastify.delete('/:id', async (request, reply) => {
    const isAllowed = request.user.role === 'ADMIN' || 
                      (request.user.permissions && (request.user.permissions.includes('product') || request.user.permissions === 'all'));
    if (!isAllowed) return reply.code(403).send({ error: 'Ruxsat yo\'q!' })
    const { id } = request.params
    await fastify.prisma.product.delete({ where: { id } })
    return { success: true }
  })
}
