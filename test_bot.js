
const TelegramBot = require('node-telegram-bot-api');
const token = '8758860211:AAH0P6sZrILvsCAK4lWMc5WGryygvQl1LAg';
const bot = new TelegramBot(token, { polling: false });
const chatId = '-5180118070';

bot.sendMessage(chatId, 'Test message from server')
  .then(() => {
    console.log('Message sent successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to send message:', err.message);
    process.exit(1);
  });
