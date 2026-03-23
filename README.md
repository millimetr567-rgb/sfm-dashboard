# SFM Mobile Dashboard & CRM System

Professional management system for agents, products, orders, and payments. Features automated Telegram notifications, PDF generation, and multi-language support.

## 🚀 Features
- **📊 Real-time Dashboard**: Track sales, active clients, and inventory.
- **📦 Smart Product Management**: Grouping by Brands (Samsung, Honor, Redmi, etc.), bulk Excel import, and easy editing.
- **💸 Order & Payment Logic**: Order-centric workflow with "Pay Now" or "Write to Debt" options.
- **🏦 Cash Register**: Statistics by payment method (USD, UZS, Card, Bank) with live currency conversion.
- **📄 PDF Generation**: Automatic order invoices in PDF format.
- **🤖 Telegram Integration**: Instant group notifications for new orders with PDF attachment and Admin Approval buttons.
- **🌍 Multi-language & Themes**: Uzbek, Russian, English support with dark/light mode toggle.
- **📱 Mobile Responsive**: Fully optimized for phones and tablets.

## 🛠 Tech Stack
- **Frontend**: React (Vite), Axios, Lucide Icons, Recharts, XLSX.
- **Backend**: Fastify (Node.js), Prisma (SQLite), PDFKit, Node-Telegram-Bot-API.

## 📦 Getting Started
1. `npm install` in root and `web_panel` directories.
2. Setup `.env` with `TELEGRAM_BOT_TOKEN`, `DEFAULT_TELEGRAM_GROUP_ID`.
3. `npx prisma db push` to initialize database.
4. `npm start` (Backend) and `npm run dev` (Frontend).

---
Developed by Antigravity (Advanced Agentic AI) for millimetr567-rgb.
