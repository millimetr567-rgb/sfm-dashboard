const TelegramBot = require('node-telegram-bot-api')
const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')

class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN
    this.bot = this.token ? new TelegramBot(this.token, { polling: true }) : null
    if (this.bot) {
      this.initHandlers()
      const stopBot = () => this.bot.stopPolling().catch(() => {});
      process.on('SIGINT', stopBot);
      process.on('SIGTERM', stopBot);
    }
  }

  setFastify(fastify) { this.fastify = fastify }

  initHandlers() {
    this.bot.onText(/\/start/, (msg) => {
      this.bot.sendMessage(msg.chat.id, `ID: \`${msg.chat.id}\``, { parse_mode: 'Markdown' });
    });

    this.bot.on('callback_query', async (q) => {
      const { data, message, from } = q
      const cid = message.chat.id
      const mid = message.message_id
      if (data.startsWith('confirm_order_')) {
          // Deprecated
      } else if (data.startsWith('admin_approve_order_')) {
          await this.handleOrderDecision(data.replace('admin_approve_order_', ''), cid, mid, from, 'approve')
      } else if (data.startsWith('admin_reject_order_')) {
          await this.handleOrderDecision(data.replace('admin_reject_order_', ''), cid, mid, from, 'reject')
      } else if (data.startsWith('approve_pay_')) {
          await this.handlePaymentDecision(data.replace('approve_pay_', ''), cid, mid, from, 'approve')
      } else if (data.startsWith('reject_pay_')) {
          await this.handlePaymentDecision(data.replace('reject_pay_', ''), cid, mid, from, 'reject')
      }
    })
  }

  async handlePaymentDecision(id, cid, mid, user, type) {
      if (!this.fastify) return;
      const adminName = user.username || user.first_name || 'Admin';
      try {
          if (type === 'approve') {
              await this.fastify.inject({
                  method: 'POST',
                  url: `/api/payments/${id}/approve`,
                  headers: { 'id': user.id, 'role': 'ADMIN', 'username': adminName } // Simulation of auth if needed or use direct prisma
              });
              // Better: use direct service logic or internal call
              const p = await this.fastify.prisma.payment.findUnique({ where: { id }, include: { client: true } });
              if (!p || p.status !== 'WAITING_APPROVAL') return;
              
              await this.fastify.prisma.$transaction(async (tx) => {
                  await tx.payment.update({ where: { id }, data: { status: 'CONFIRMED', approvedBy: adminName, approvedAt: new Date() } });
                  await tx.client.update({ where: { id: p.clientId }, data: { currentDebt: { decrement: p.amount } } });
                  if (p.orderId) await tx.order.update({ where: { id: p.orderId }, data: { status: 'PAID', paymentMethod: p.paymentMethod } });
              });
              
              await this.bot.editMessageText(`✅ To'lov tasdiqlandi!\nMijoz: ${p.client.name}\nSumma: ${p.amount} $`, { chat_id: cid, message_id: mid });
          } else {
              await this.fastify.prisma.payment.update({ where: { id }, data: { status: 'REJECTED' } });
              await this.bot.editMessageText(`❌ To'lov rad etildi.`, { chat_id: cid, message_id: mid });
          }
      } catch (e) { console.error('Payment Decision Error:', e.message) }
  }

  async sendPaymentNotification(p, c, u) {
    const tid = c.telegramGroupId || process.env.DEFAULT_TELEGRAM_GROUP_ID;
    if (!this.bot || !tid) return;
    const msg = `💸 *To'lov muvaffaqiyatli qabul qilindi!*\n\n👤 Mijoz: ${c.name}\n💰 Summa: ${p.amount} $\n💳 Usul: ${p.paymentMethod}\n✅ Holat: TASDIQLANDI`;
    await this.bot.sendMessage(tid, msg, { parse_mode: 'Markdown' });
  }

  // ... (Other methods: generateOrderPDF, formatTime, etc. kept as they are needed)
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`
  }

  async generateOrderPDF(order) {
    const qrUrl = `https://sfm-mobile.uz/orders/view/${order.id}`;
    const qrBuffer = await QRCode.toBuffer(qrUrl, { margin: 1, width: 80 });
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.image(qrBuffer, 460, 50, { width: 80 });
      doc.fontSize(20).text('SFM MOBILE: BUYURTMA VARAQASI', 50, 70);
      doc.fontSize(12).moveDown()
         .text(`Zakas raqami: #${order.orderNumber || order.id.substring(0,8)}`)
         .text(`Sana: ${this.formatDate(order.createdAt)}`)
         .text(`Mijoz: ${order.client.name}`)
         .text(`Tel: ${order.driverPhone || '-'}`)
         .text(`To'lov: ${order.paymentMethod || 'USD'}`);
      doc.moveDown();
      const tableTop = 230;
      doc.font('Helvetica-Bold').text('№', 50, tableTop).text('Mahsulot', 80, tableTop).text('Soni', 350, tableTop).text('Narxi', 410, tableTop).text('Jami', 490, tableTop);
      doc.moveTo(50, tableTop + 15).lineTo(560, tableTop + 15).stroke();
      let y = tableTop + 25;
      order.items.forEach((it, i) => {
        doc.font('Helvetica').text(i+1, 50, y).text(it.product.name, 80, y, { width: 260 }).text(it.quantity, 350, y).text(`${it.price} $`, 410, y).text(`${it.quantity*it.price} $`, 490, y);
        y += 20;
      });
      doc.font('Helvetica-Bold').text(`JAMI: ${order.amount.toFixed(2)} $`, 400, y + 20, { align: 'right', width: 150 });
      doc.end();
    });
  }

  async sendOrderNotification(order) {
    const tid = order.client.telegramGroupId || process.env.DEFAULT_TELEGRAM_GROUP_ID || '-1002444535352'; // Use env or default
    if (!this.bot || !tid) return;
    try {
      // 1. Generate PDF
      const pdf = await this.generateOrderPDF(order);
      
      // 2. Send PDF first
      await this.bot.sendDocument(tid, pdf, { 
        caption: `📄 Buyurtma feli: #${order.orderNumber || order.id.substring(0,8)}`,
        filename: `Order_${order.id.substring(0,6)}.pdf` 
      });

      // 3. Send Message with Approval Buttons
      let text = `📦 *YANGI BUYURTMA YARATILDI*\n\n` +
                 `🆔 Raqam: \`#${order.orderNumber || order.id.substring(0,8)}\`\n` +
                 `👤 Mijoz: *${order.client.name}*\n` +
                 `💵 Jami: *${order.amount.toFixed(2)} $*\n` +
                 `👤 Agent: ${order.agent?.username || '—'}\n` +
                 `📊 Holat: *TASDIQ KUTILMOQDA*`;

      const opts = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Tasdiqlash', callback_query_id: 'approve', callback_data: `admin_approve_order_${order.id}` },
              { text: '❌ Bekor qilish', callback_query_id: 'reject', callback_data: `admin_reject_order_${order.id}` }
            ]
          ]
        }
      };

      await this.bot.sendMessage(tid, text, opts);
    } catch (e) { console.error('Notify Error:', e.message) }
  }

  async handleOrderDecision(id, cid, mid, from, type) {
    if (!this.fastify) return;
    const adminName = from.username || from.first_name || 'Admin';
    try {
      if (type === 'approve') {
        // Find order
        const order = await this.fastify.prisma.order.findUnique({ 
            where: { id },
            include: { items: true, client: true }
        });
        
        if (!order || order.status === 'CONFIRMED') return;

        // Transactional update
        await this.fastify.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id },
                data: { status: 'CONFIRMED', approvedBy: adminName, approvedAt: new Date() }
            });
            await tx.client.update({
                where: { id: order.clientId },
                data: { currentDebt: { increment: order.amount } }
            });
        });

        await this.bot.editMessageText(`✅ *TASDIQLANDI*\nBuyurtma: #${order.orderNumber || order.id.substring(0,8)}\nMijoz: ${order.client.name}\nAdmin: ${adminName}`, { 
          chat_id: cid, 
          message_id: mid,
          parse_mode: 'Markdown'
        });
      } else {
        const order = await this.fastify.prisma.order.update({
          where: { id },
          data: { status: 'CANCELLED' },
          include: { items: true, client: true }
        });
        
        // Return stock
        for (const i of order.items) {
          await this.fastify.prisma.product.update({
            where: { id: i.productId },
            data: { stock: { increment: i.quantity } }
          });
        }

        await this.bot.editMessageText(`❌ *BEKOR QILINDI*\nBy: ${adminName}`, { chat_id: cid, message_id: mid, parse_mode: 'Markdown' });
      }
    } catch (e) { console.error('Order Decision Error:', e.message) }
  }
}

module.exports = new TelegramService()
