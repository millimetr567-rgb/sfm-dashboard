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

  esc(text) {
    if (!text) return "";
    return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  async getChatIds(extraId = null) {
    if (!this.fastify) return [];
    try {
        const settings = await this.fastify.prisma.settings.findUnique({ where: { id: 'singleton' } });
        let ids = [settings?.chatId1, settings?.chatId2, settings?.chatId3].filter(id => id && String(id).trim() !== '');
        
        if (ids.length === 0) {
            ids.push('-5180118070');
        }

        if (extraId) ids.push(extraId);
        
        // Ensure all are strings and unique
        return [...new Set(ids.map(id => String(id).trim()))];
    } catch (e) {
        console.error("[Telegram] getChatIds Error:", e.message);
        return ['-5180118070'];
    }
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
        const chatIds = await this.getChatIds(c.telegramGroupId);
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

        const chatIds = await this.getChatIds(payment.client.telegramGroupId);
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
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      doc.rect(0, 0, 600, 100).fill('#6366f1');
      doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('SFM MOBILE', 40, 35);
      doc.fontSize(10).font('Helvetica').text('TIZIM ORQALI GENERATSIYA QILINGAN CHEK', 40, 65);
      
      doc.fillColor('#000000').fontSize(18).font('Helvetica-Bold').text('BUYURTMA VARAQASI', 40, 120);
      doc.fontSize(10).font('Helvetica').text(`ID: #${order.orderNumber || order.id.substring(0,8)}`, 40, 145);
      
      // Client Info
      doc.rect(40, 165, 515, 60).stroke('#eeeeee');
      doc.fontSize(9).fillColor('#666666').text('MIJOZ MA\'LUMOTLARI', 50, 175);
      doc.fontSize(12).fillColor('#000000').font('Helvetica-Bold').text(order.client.name, 50, 190);
      doc.fontSize(10).font('Helvetica').text(`Tel: ${order.client.phone || '-'}`, 50, 205);
      
      doc.fontSize(9).fillColor('#666666').text('SANA', 400, 175);
      doc.fontSize(10).fillColor('#000000').text(this.formatDate(order.createdAt), 400, 190);
      doc.fontSize(9).fillColor('#666666').text('TO\'LOV USULI', 400, 205);
      doc.fontSize(10).fillColor('#000000').text(order.paymentMethod || 'USD', 480, 205);

      // Table Header
      const tableTop = 250;
      doc.rect(40, tableTop, 515, 25).fill('#f9fafb');
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10);
      doc.text('№', 50, tableTop + 8);
      doc.text('Mahsulot nomi', 80, tableTop + 8);
      doc.text('Soni', 350, tableTop + 8, { width: 40, align: 'center' });
      doc.text('Narxi', 410, tableTop + 8, { width: 60, align: 'right' });
      doc.text('Jami', 490, tableTop + 8, { width: 60, align: 'right' });

      let y = tableTop + 35;
      doc.font('Helvetica').fontSize(10).fillColor('#000000');
      
      order.items.forEach((it, i) => {
        // Stripe rows
        if (i % 2 === 0) doc.rect(40, y-5, 515, 20).fill('#ffffff');
        else doc.rect(40, y-5, 515, 20).fill('#fdfdfd');
        
        doc.fillColor('#000000');
        doc.text(i+1, 50, y);
        doc.text(it.product.name, 80, y, { width: 260 });
        doc.text(it.quantity, 350, y, { width: 40, align: 'center' });
        doc.text(`$${it.price.toLocaleString()}`, 410, y, { width: 60, align: 'right' });
        doc.text(`$${(it.quantity * it.price).toLocaleString()}`, 490, y, { width: 60, align: 'right' });
        y += 20;

        if (y > 700) { doc.addPage(); y = 50; }
      });

      // Footer / Total
      doc.moveTo(40, y + 10).lineTo(555, y + 10).stroke('#eeeeee');
      y += 25;
      doc.fontSize(14).font('Helvetica-Bold').text('UMUMIY JAMI:', 300, y);
      doc.fontSize(16).fillColor('#6366f1').text(`$${order.amount.toLocaleString()}`, 450, y, { width: 100, align: 'right' });
      
      y += 40;
      doc.fontSize(8).fillColor('#999999').font('Helvetica').text('Ushbu hujjat elektron shaklda yaratilgan. Tasdiqlash bot orqali amalga oshiriladi.', 40, y, { align: 'center', width: 515 });

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
