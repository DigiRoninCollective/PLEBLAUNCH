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
      // Solana addresses are base58, usually 32-44 chars, e.g. 9xQeWvG816bUx9EPa2aKk7rQyGz5pA6tGk9r8rD1wGkF
      const caRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
      const matches = msg.text.match(caRegex);
      if (matches) {
        this.bot.sendMessage(msg.chat.id, `Detected contract address: ${matches[0]}`);
        // Optionally: emit to socket.io or log to DB
        if (this.io) {
          this.io.emit('contract-address-detected', { address: matches[0], user: msg.from });
        }
      }
    });
    console.log('TelegramBotService started and listening for messages');
  }
}

module.exports = TelegramBotService;

// Example usage and startup
if (require.main === module) {
  const bot = new TelegramBotService();
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