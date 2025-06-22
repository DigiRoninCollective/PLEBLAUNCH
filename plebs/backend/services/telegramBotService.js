// Complete Telegram Bot Service with Chat Room Integration
const TelegramBot = require('node-telegram-bot-api');

class TelegramBotService {
  constructor(token, pool, io) {
    this.bot = new TelegramBot(token, { polling: true });
    this.pool = pool;
    this.io = io;
  }

  start() {
    this.bot.on('message', (msg) => {
      if (!msg.text) return;
      const caRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
      const matches = msg.text.match(caRegex);
      if (matches) {
        this.bot.sendMessage(msg.chat.id, `Detected contract address: ${matches[0]}`);
        if (this.io) {
          this.io.emit('contract-address-detected', { address: matches[0], user: msg.from });
        }
      }
    });
    console.log('TelegramBotService started and listening for messages');
  }

  async cleanup() {
    try {
      await this.bot.stopPolling();
      console.log('TelegramBotService stopped polling.');
    } catch (err) {
      console.error('Error during TelegramBotService cleanup:', err);
    }
  }
}

module.exports = TelegramBotService;

// Example usage and startup
if (require.main === module) {
  const bot = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN);
  bot.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down bot service...');
    await bot.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down bot service...');
    await bot.cleanup();
    process.exit(0);
  });
}