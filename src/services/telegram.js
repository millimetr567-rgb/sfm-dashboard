const TelegramBot = require('node-telegram-bot-api')
const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')

class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN
    this.bot = null;
    if (this.token) {
        this.initBot(this.token);
    }
  }

  async initBot(token) {
    if (this.bot) {
        try { await this.bot.stopPolling(); } catch(e) {}
    }
    this.token = token;
    this.bot = new TelegramBot(token, { polling: true });
    this.initHandlers();
    
    const stopBot = () => this.bot.stopPolling().catch(() => {});
    process.on('SIGINT', stopBot);
    process.on('SIGTERM', stopBot);
    console.log("Telegram Bot Initialized with new token.");
  }

  setFastify(fastify) { this.fastify = fastify }

  parseTemplate(text, data = {}) {
    if (!text) return "";
    let result = text;
    if (data.name) result = result.replace(/@name/g, data.name);
    if (data.cur_sum !== undefined) result = result.replace(/@cur_sum/g, data.cur_sum.toString());
    if (data.days !== undefined) result = result.replace(/@days/g, data.days.toString());
    return result;
  }

  // Utility to escape Markdown special characters
  esc(text) {
    if (!text) return "";
    return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  initHandlers() {
    this.bot.onText(/\/start/, (msg) => {
      this.bot.sendMessage(msg.chat.id, `Sizning Chat ID: \`${msg.chat.id}\`\nIltimos, ushbu ID-ni sozlamalarga kiriting.`, { parse_mode: 'Markdown' });
    });

    this.bot.on('callback_query', async (q) => {
      const { data, message, from } = q;
      if (!message) return;
      const cid = message.chat.id;
      const mid = message.message_id;
      try {
        if (data.startsWith('admin_approve_order_')) {
            await this.handleOrderDecision(data.replace('admin_approve_order_', ''), cid, mid, from, 'approve', q.id)
        } else if (data.startsWith('admin_reject_order_')) {
            await this.handleOrderDecision(data.replace('admin_reject_order_', ''), cid, mid, from, 'reject', q.id)
        } else if (data.startsWith('approve_pay_')) {
            await this.handlePaymentDecision(data.replace('approve_pay_', ''), cid, mid, from, 'approve')
        } else if (data.startsWith('reject_pay_')) {
            await this.handlePaymentDecision(data.replace('reject_pay_', ''), cid, mid, from, 'reject')
        }
      } catch (e) {
        console.error('[Telegram] Callback Error:', e.message);
      }
    });
  }

  async handlePaymentDecision(id, cid, mid, from, type) {
    if (!this.fastify) return;
    const adminName = from.username || from.first_name || 'Admin';
    try {
        const payment = await this.fastify.prisma.payment.findUnique({ 
            where: { id },
            include: { client: true }
        });
        if (!payment || payment.status !== 'WAITING_APPROVAL') {
            await this.bot.answerCallbackQuery(id, { text: "Ushbu to'lov allaqachon qayta ishlangan yoki o'chirilgan." });
            return;
        }

        if (type === 'approve') {
            await this.fastify.prisma.$transaction(async (tx) => {
                await tx.payment.update({
                    where: { id },
                    data: { status: 'CONFIRMED', approvedBy: adminName, approvedAt: new Date() }
                });

                if (payment.orderId) {
                    const order = await tx.order.findUnique({ where: { id: payment.orderId } });
                    if (order) {
                        if (['WAITING_APPROVAL', 'PENDING_PAYMENT', 'PENDING_APPROVAL'].includes(order.status)) {
                            await tx.client.update({
                                where: { id: payment.clientId },
                                data: { currentDebt: { increment: order.amount } }
                            });
                        }
                        await tx.order.update({
                            where: { id: payment.orderId },
                            data: { status: 'PAID' }
                        });
                    }
                }

                await tx.client.update({
                    where: { id: payment.clientId },
                    data: { currentDebt: { decrement: payment.amount } }
                });
            });

            await this.bot.editMessageText(`✅ *TO'LOV TASDIQLANDI*\n💰 Summa: ${payment.amount} $\n👤 Mijoz: ${this.esc(payment.client.name)}\nAdmin: ${this.esc(adminName)}`, { 
                chat_id: cid, 
                message_id: mid,
                parse_mode: 'Markdown'
            });
        } else {
            await this.fastify.prisma.payment.update({
                where: { id },
                data: { status: 'REJECTED' }
            });
            await this.bot.editMessageText(`❌ *TO'LOV RAD ETILDI*\nBy: ${this.esc(adminName)}`, { chat_id: cid, message_id: mid, parse_mode: 'Markdown' });
        }
    } catch (e) { 
        console.error('Payment Decision Error:', e.message);
        try { await this.bot.answerCallbackQuery(id, { text: "Xatolik: " + e.message }); } catch(err) {}
    }
  }

  async broadcastToAdmins(msg) {
    if (!this.fastify || !this.bot) return;
    try {
        const settings = await this.fastify.prisma.settings.findUnique({ where: { id: 'singleton' } });
        let chatIds = [settings?.chatId1, settings?.chatId2, settings?.chatId3].filter(id => id);
        
        // If settings are empty, ALWAY use environment default
        if (chatIds.length === 0) {
            const adminId = process.env.DEFAULT_TELEGRAM_GROUP_ID;
            if (adminId) chatIds.push(adminId);
        }

        for (const tid of chatIds) {
            try {
                await this.bot.sendMessage(tid, msg, { parse_mode: 'Markdown' });
            } catch (e) { console.error(`[Telegram] Broadcast Error to ${tid}:`, e.message); }
        }
    } catch (err) { console.error("[Telegram] Broadcast Fatal Error:", err.message); }
  }

  async sendPaymentNotification(p, c, u) {
    if (!this.fastify || !this.bot) return;
    try {
        const settings = await this.fastify.prisma.settings.findUnique({ where: { id: 'singleton' } });
        const chatIds = [settings?.chatId1, settings?.chatId2, settings?.chatId3].filter(id => id);
        
        if (chatIds.length === 0) {
            chatIds.push('-5180118070');
            const tid = c.telegramGroupId;
            if (tid) chatIds.push(tid);
        }

        if (chatIds.length === 0) return;

        const msg = `💸 *To'lov muvaffaqiyatli qabul qilindi!*\n\n👤 Mijoz: ${this.esc(c.name)}\n💰 Summa: ${p.amount} $\n💳 Usul: ${p.paymentMethod}\n✅ Holat: TASDIQLANDI`;
        
        for (const tid of chatIds) {
            try {
                await this.bot.sendMessage(tid, msg, { parse_mode: 'Markdown' });
            } catch(e) { console.error("Payment Notify Error:", e.message); }
        }
    } catch (err) { console.error("Payment Notification Error:", err.message); }
  }

  async sendConfirmationWithPDF(paymentId, msg) {
    if (!this.fastify || !this.bot) return;
    try {
        const payment = await this.fastify.prisma.payment.findUnique({ 
            where: { id: paymentId },
            include: { client: true }
        });
        if (!payment) return;

        const settings = await this.fastify.prisma.settings.findUnique({ where: { id: 'singleton' } });
        let chatIds = [settings?.chatId1, settings?.chatId2, settings?.chatId3].filter(id => id);
        if (chatIds.length === 0) {
            chatIds.push('-5180118070');
            if (payment.client.telegramGroupId) chatIds.push(payment.client.telegramGroupId);
        }
        
        if (chatIds.length === 0) return;

        const opts = {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Tasdiqlash', callback_data: `approve_pay_${payment.id}` },
              { text: '❌ Rad etish', callback_data: `reject_pay_${payment.id}` }
            ]]
          }
        };

        let pdf = null;
        if (payment.orderId) {
            try {
                const order = await this.fastify.prisma.order.findUnique({
                    where: { id: payment.orderId },
                    include: { items: { include: { product: true } }, client: true, agent: true }
                });
                if (order) pdf = await this.generateOrderPDF(order);
            } catch(e) { console.error(`[Telegram] PDF Error: ${e.message}`); }
        }

        for (const tid of chatIds) {
            try {
                if (pdf) {
                    await this.bot.sendDocument(tid, pdf, { 
                        caption: `📄 Buyurtma feli (To'lov uchun)`,
                        filename: `Order_Payment_${payment.id.substring(0,6)}.pdf` 
                    });
                }
                await this.bot.sendMessage(tid, msg, opts);
            } catch (e) { console.error(`[Telegram] Send Error to ${tid}:`, e.message); }
        }
    } catch (err) { console.error(`[Telegram] Fatal Notification Error: ${err.message}`); }
  }

  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`
  }

  async generateOrderPDF(order) {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
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
    if (!this.fastify || !this.bot) return;
    try {
        const settings = await this.fastify.prisma.settings.findUnique({ where: { id: 'singleton' } });
        let chatIds = [settings?.chatId1, settings?.chatId2, settings?.chatId3].filter(id => id);
        
        if (chatIds.length === 0) {
            chatIds.push('-5180118070');
            if (order.client?.telegramGroupId) chatIds.push(order.client.telegramGroupId);
        }

        if (chatIds.length === 0) return;

        const pdf = await this.generateOrderPDF(order);
        let text = `📦 *YANGI BUYURTMA YARATILDI*\n\n` +
                   `🆔 Raqam: \`#${order.orderNumber || order.id.substring(0,8)}\`\n` +
                   `👤 Mijoz: *${this.esc(order.client.name)}*\n` +
                   `💵 Jami: *${order.amount.toFixed(2)} $*\n` +
                   `👤 Agent: ${this.esc(order.agent?.username || '—')}\n` +
                   `📊 Holat: *TASDIQ KUTILMOQDA*`;

        const opts = {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Tasdiqlash', callback_data: `admin_approve_order_${order.id}` },
              { text: '❌ Bekor qilish', callback_data: `admin_reject_order_${order.id}` }
            ]]
          }
        };

        for (const tid of chatIds) {
          try {
            await this.bot.sendDocument(tid, pdf, { 
              caption: `📄 Buyurtma feli: #${order.orderNumber || order.id.substring(0,8)}`,
              filename: `Order_${order.id.substring(0,6)}.pdf` 
            });
            await this.bot.sendMessage(tid, text, opts);
          } catch(e) { console.error(`[Telegram] Order Notify Error to ${tid}:`, e.message); }
        }
    } catch (e) { console.error('Notify Error:', e.message) }
  }

  async handleOrderDecision(id, cid, mid, from, type, qId) {
    if (!this.fastify || !this.bot) return;
    const adminName = from.username || from.first_name || 'Admin';
    try {
      if (type === 'approve') {
        const order = await this.fastify.prisma.order.findUnique({ where: { id }, include: { items: true, client: true } });
        if (!order) {
            await this.bot.answerCallbackQuery(qId, { text: "Xato: Buyurtma topilmadi." });
            return;
        }
        if (order.status === 'CONFIRMED') {
            await this.bot.answerCallbackQuery(qId, { text: "Ushbu buyurtma allaqachon tasdiqlangan." });
            return;
        }

        await this.fastify.prisma.$transaction(async (tx) => {
            await tx.order.update({ where: { id }, data: { status: 'CONFIRMED', approvedBy: adminName, approvedAt: new Date() } });
            await tx.client.update({ where: { id: order.clientId }, data: { currentDebt: { increment: order.amount } } });
        });

        await this.bot.answerCallbackQuery(qId, { text: "Buyurtma tasdiqlandi!" });
        await this.bot.editMessageText(`✅ *TASDIQLANDI*\nBuyurtma: #${order.orderNumber || order.id.substring(0,8)}\nMijoz: ${this.esc(order.client.name)}\nAdmin: ${this.esc(adminName)}`, { 
          chat_id: cid, message_id: mid, parse_mode: 'Markdown'
        });
      } else {
        const order = await this.fastify.prisma.order.findUnique({ where: { id } });
        if (!order) {
            await this.bot.answerCallbackQuery(qId, { text: "Xato: Buyurtma topilmadi." });
            return;
        }
        
        await this.fastify.prisma.$transaction(async (tx) => {
            const updated = await tx.order.update({
                where: { id },
                data: { status: 'CANCELLED' },
                include: { items: true }
            });
            for (const i of updated.items) {
                await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
            }
        });

        await this.bot.answerCallbackQuery(qId, { text: "Buyurtma bekor qilindi." });
        await this.bot.editMessageText(`❌ *BEKOR QILINDI*\nBy: ${this.esc(adminName)}`, { chat_id: cid, message_id: mid, parse_mode: 'Markdown' });
      }
    } catch (e) { 
        console.error('Order Decision Error:', e.message);
        try { await this.bot.answerCallbackQuery(qId, { text: "Xatolik: " + e.message }); } catch(err) {}
    }
  }
}

module.exports = new TelegramService()
