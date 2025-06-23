// Complete Telegram Bot Service with Chat Room Integration
const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch'); // Make sure this is installed

class TelegramBotService {
  constructor(token, pool, io) {
    this.bot = new TelegramBot(token, { polling: true });
    this.pool = pool;
    this.io = io;
  }

  start() {
    this.bot.on('message', async (msg) => {
      if (!msg.text) return;
      const caRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
      const matches = msg.text.match(caRegex);
      if (matches) {
        const ca = matches[0];
        this.bot.sendMessage(msg.chat.id, `Detected contract address: ${ca}`);

        // Fetch token info from Solscan
        try {
          const solscanToken = process.env.SOLSCAN_API_TOKEN;
          const resp = await fetch(`https://api.solscan.io/token/meta?tokenAddress=${ca}`, {
            headers: solscanToken ? { 'Authorization': `Bearer ${solscanToken}` } : {}
          });
          const data = await resp.json();
          if (data && data.symbol) {
            const infoMsg = `Token Info:\nName: ${data.name}\nSymbol: ${data.symbol}\nDecimals: ${data.decimals}\n\n[View on Solscan](https://solscan.io/token/${ca})`;
            this.bot.sendMessage(msg.chat.id, infoMsg, { parse_mode: 'Markdown' });
          } else {
            this.bot.sendMessage(msg.chat.id, `No token info found on Solscan for: ${ca}`);
          }
        } catch (e) {
          this.bot.sendMessage(msg.chat.id, `Error fetching info from Solscan.`);
        }

        if (this.io) {
          this.io.emit('contract-address-detected', { address: ca, user: msg.from });
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