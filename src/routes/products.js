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
    let successCount = 0;
    let failCount = 0;

    // OPTIMIZATION: Fetch all existing codes to avoid $N$ findUnique calls
    const allProducts = await fastify.prisma.product.findMany({ select: { id: true, code: true } });
    const codeMap = new Map();
    allProducts.forEach(p => { if (p.code) codeMap.set(p.code, p.id); });
    
    for (const p of products) {
      if (!p.name) continue

      // A truly empty row or a header row (only category name)
      const hasStock = (p.stock !== undefined && p.stock !== null && String(p.stock).trim() !== '');
      const hasPrice = (p.sellPrice !== undefined && p.sellPrice !== null && String(p.sellPrice).trim() !== '');
      const hasCode = (p.code !== undefined && p.code !== null && String(p.code).trim() !== '');
      const hasCost = (p.costPrice !== undefined && p.costPrice !== null && String(p.costPrice).trim() !== '');

      // If it only has a name and no other data, it's a category header
      if (!hasStock && !hasPrice && !hasCode && !hasCost) {
          const catName = String(p.name).trim();
          if (catName && catName.length > 1) {
              currentGroupName = catName;
          }
          continue;
      }

      const productName = String(p.name || '').trim();
      if (productName.toLowerCase() === 'nomi' || productName.toLowerCase() === 'наименование') continue;
      
      const productCode = (p.code !== undefined && p.code !== null && String(p.code).trim() !== '') ? String(p.code).trim() : null;
      const groupName = p.group ? String(p.group).trim() : currentGroupName;
      const guarantee = p.guarantee || null;
      
      // Better numeric cleanup: Handle spaces in numbers like "12 000"
      const cleanNum = (v) => parseFloat(String(v || '0').replace(/\s/g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '')) || 0;
      const cost = cleanNum(p.costPrice);
      const sell = cleanNum(p.sellPrice);
      const stock = cleanNum(p.stock);
      const minStock = cleanNum(p.minStock);

      try {
          if (productCode && codeMap.has(productCode)) {
              const existingId = codeMap.get(productCode);
              await fastify.prisma.product.update({
                  where: { id: existingId },
                  data: { 
                      name: productName,
                      group: groupName, 
                      guarantee, 
                      costPrice: cost, 
                      sellPrice: sell, 
                      stock: stock, 
                      minStock: minStock 
                  }
              });
          } else {
              // CREATE a NEW record (either NEW code or no code at all)
              await fastify.prisma.product.create({
                  data: { 
                      code: productCode, 
                      name: productName,
                      group: groupName, 
                      guarantee, 
                      costPrice: cost, 
                      sellPrice: sell, 
                      stock: stock, 
                      minStock: minStock 
                  }
              });
          }
          successCount++;
      } catch (err) {
          failCount++;
          console.error(`[Bulk Import] Error at row "${productName}":`, err.message);
      }
    }

    // Log the action
    await fastify.prisma.log.create({
        data: {
          action: 'BULK_UPLOAD_PRODUCTS',
          actorId: request.user.id,
          actorRole: request.user.role,
          metadata: JSON.stringify({ total: products.length, success: successCount, fail: failCount })
        }
    })
    
    return { success: true, count: successCount, failed: failCount };
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
