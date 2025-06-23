const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const axios = require('axios');
const https = require('follow-redirects').https;
const request = require('request');
const express = require('express');

class TelegramBotService {
  constructor(token, pool, io, solscanApiKey, webhookUrl, app) {
    this.token = token;
    this.pool = pool;
    this.io = io;
    this.solscanApiKey = solscanApiKey || process.env.SOLSCAN_API_TOKEN;
    this.webhookUrl = webhookUrl || process.env.PUBLIC_URL;
    this.app = app;
    this.bot = new TelegramBot(token, { webHook: true });
  }

  async start() {
    // Set webhook
    await this.bot.setWebHook(`${this.webhookUrl}/bot${this.token}`);
    // Register webhook callback with Express
    this.app.use(this.bot.webHookCallback(`/bot${this.token}`));
    this.bot.on('message', async (msg) => {
      if (!msg.text) return;
      const text = msg.text.trim();
      // Command handling
      if (text.startsWith('/start')) {
        this.showMainMenu(msg.chat.id);
        return;
      }
      if (text.startsWith('/help')) {
        this.showHelp(msg.chat.id);
        return;
      }
      // Unknown command
      if (text.startsWith('/')) {
        this.handleUnknownCommand(msg.chat.id);
        return;
      }
      // Contract address detection
      const caRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
      const matches = text.match(caRegex);
      if (matches) {
        const ca = matches[0];
        this.bot.sendMessage(msg.chat.id, `Detected contract address: ${ca}`);
        // Fetch token info from Solscan
        try {
          const resp = await fetch(`https://api.solscan.io/token/meta?tokenAddress=${ca}`, {
            headers: this.solscanApiKey ? { 'Authorization': `Bearer ${this.solscanApiKey}` } : {}
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
        return;
      }
      // Fallback: show inline placeholder
      this.bot.sendMessage(msg.chat.id, this.showInlinePlaceholder());
    });

    // Inline keyboard callback handler
    this.bot.on('callback_query', async (query) => {
      const { data, message } = query;
      if (!data || !message) return;
      switch (data) {
        case 'get_price':
          this.bot.sendMessage(message.chat.id, 'Price feature coming soon!');
          break;
        case 'show_chart':
          this.bot.sendMessage(message.chat.id, 'Chart feature coming soon!');
          break;
        case 'trending':
          this.bot.sendMessage(message.chat.id, 'Trending tokens feature coming soon!');
          break;
        case 'profile':
          this.bot.sendMessage(message.chat.id, 'Token profile feature coming soon!');
          break;
        case 'dex_pairs':
          this.bot.sendMessage(message.chat.id, 'DEX pairs feature coming soon!');
          break;
        case 'help':
          this.showHelp(message.chat.id);
          break;
        default:
          this.handleUnknownCommand(message.chat.id);
      }
      this.bot.answerCallbackQuery(query.id);
    });
    console.log('TelegramBotService started in webhook mode and listening for messages');
  }

  // --- API Helper Methods ---
  async fetchSolscanTokenData(tokenAddress) {
    try {
      const response = await fetch(`https://api.solscan.io/token/meta?tokenAddress=${tokenAddress}`, {
        headers: this.solscanApiKey ? { 'Authorization': `Bearer ${this.solscanApiKey}` } : {}
      });
      if (!response.ok) throw new Error('Failed to fetch from Solscan');
      return await response.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async fetchJupiterTokenData(mintAddress) {
    try {
      const response = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${mintAddress}`);
      if (!response.ok) throw new Error('Failed to fetch from Jupiter');
      return await response.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async fetchJupiterTokenDataAxios(mintAddress) {
    try {
      const response = await axios.get(`https://lite-api.jup.ag/tokens/v1/token/${mintAddress}`, {
        headers: { 'Accept': 'application/json' }
      });
      return response.data;
    } catch (err) {
      return { error: err.message };
    }
  }

  fetchJupiterTokenDataHttps(mintAddress) {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        hostname: 'lite-api.jup.ag',
        path: `/tokens/v1/token/${mintAddress}`,
        headers: {
          'Accept': 'application/json'
        },
        maxRedirects: 20
      };
      const req = https.request(options, function (res) {
        let chunks = [];
        res.on('data', function (chunk) {
          chunks.push(chunk);
        });
        res.on('end', function () {
          const body = Buffer.concat(chunks).toString();
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ error: 'Invalid JSON response' });
          }
        });
        res.on('error', function (error) {
          reject({ error: error.message });
        });
      });
      req.end();
    });
  }

  fetchJupiterTokenDataRequest(mintAddress) {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        url: `https://lite-api.jup.ag/tokens/v1/token/${mintAddress}`,
        headers: {
          'Accept': 'application/json'
        }
      };
      request(options, function (error, response) {
        if (error) return reject({ error: error.message });
        try {
          resolve(JSON.parse(response.body));
        } catch (e) {
          resolve({ error: 'Invalid JSON response' });
        }
      });
    });
  }

  async fetchDexScreenerLatestTokenProfiles() {
    try {
      const response = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
        headers: { 'Accept': '*/*' }
      });
      if (!response.ok) throw new Error('Failed to fetch from DexScreener');
      return await response.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async fetchDexScreenerLatestDexPair(chainId, pairId) {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairId}`, {
        headers: { 'Accept': '*/*' }
      });
      if (!response.ok) throw new Error('Failed to fetch from DexScreener');
      return await response.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async fetchDexScreenerLatestDexSearch(query) {
    try {
      const url = query
        ? `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
        : 'https://api.dexscreener.com/latest/dex/search';
      const response = await fetch(url, {
        headers: { 'Accept': '*/*' }
      });
      if (!response.ok) throw new Error('Failed to fetch from DexScreener');
      return await response.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async fetchDexScreenerTokens(chainId, tokenAddresses) {
    try {
      const response = await fetch(`https://api.dexscreener.com/tokens/v1/${chainId}/${tokenAddresses}`, {
        headers: { 'Accept': '*/*' }
      });
      if (!response.ok) throw new Error('Failed to fetch from DexScreener');
      return await response.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  // --- User Interaction Methods ---
  showMainMenu(chatId) {
    this.bot.sendMessage(chatId, 'Choose an option:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Get Price', callback_data: 'get_price' },
            { text: 'Show Chart', callback_data: 'show_chart' }
          ],
          [
            { text: 'Trending Tokens', callback_data: 'trending' },
            { text: 'Token Profile', callback_data: 'profile' },
            { text: 'DEX Pairs', callback_data: 'dex_pairs' }
          ],
          [
            { text: 'Help', callback_data: 'help' }
          ]
        ]
      }
    });
  }

  handleUnknownCommand(chatId) {
    this.bot.sendMessage(chatId, "Sorry, I didn't understand that command. Type /help to see what I can do!");
  }

  showHelp(chatId) {
    this.bot.sendMessage(chatId, `Available commands:\n\n/price <token> - Get the latest price and info for a Solana token\n/chart <token> - View a price chart for a token\n/profile <token> - Show token profile and links\n/dex <token> - Get DEX trading pairs and liquidity\n/trending - Show trending tokens on Solana\n/help - Show this help message`);
  }

  showInlinePlaceholder() {
    return "Search Solana tokens, get live prices, charts, and token info. Type a token name, symbol, or address to get started!";
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

// Example usage and startup for webhook mode
if (require.main === module) {
  const app = express();
  const port = process.env.PORT || 3000;
  const webhookUrl = process.env.PUBLIC_URL; // e.g., https://your-app.onrender.com
  const bot = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN, null, null, null, webhookUrl, app);
  bot.start();
  app.get('/', (req, res) => res.send('Bot is running!'));
  app.listen(port, () => {
    console.log(`Express server is listening on ${port}`);
  });
}
