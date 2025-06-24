import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN || '';

export class TelegramBotService {
  private bot: TelegramBot;

  constructor() {
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
    }
    this.bot = new TelegramBot(token, { polling: true });
    this.setupListeners();
  }

  private setupListeners() {
    this.bot.onText(/\/start/, (msg: TelegramBot.Message) => {
      this.bot.sendMessage(msg.chat.id, 'Welcome to the Telegram Bot!');
    });
    // Add more command handlers here
  }

  public sendMessage(chatId: number | string, text: string) {
    return this.bot.sendMessage(chatId, text);
  }
}
