const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const getRandomFruit=require('./utils/raritypicker')

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});
let inventory={};

const cooldown = new Map();
const COOLDOWN_TIME = 60 * 1000; // 60 seconds

bot.onText(/\/pull/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const now = Date.now();
  const lastUsed = cooldown.get(userId);

  if (lastUsed && now - lastUsed < COOLDOWN_TIME) {
    const secondsLeft = Math.ceil((COOLDOWN_TIME - (now - lastUsed)) / 1000);
    return bot.sendMessage(chatId, `🕒 Please wait ${secondsLeft} seconds before pulling again.`);
  }

  cooldown.set(userId, now);

  const { fruit, user, type, image, rarity } = getRandomFruit();
  const caption = `🎯 *You Pulled a Devil Fruit!*\n\n🍇 *Fruit:* ${fruit}\n👤 *User:* ${user}\n📦 *Type:* ${type} (${rarity})`;

  if (!inventory[userId]) inventory[userId] = [];
  inventory[userId].push(fruit);

  bot.sendPhoto(chatId, image, { caption, parse_mode: 'Markdown' });
});


bot.onText(/\/inventory/, (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (!inventory[userId] || inventory[userId].length === 0) {
    bot.sendMessage(chatId, '🗃️ Your inventory is empty. Use /pull to get your first Devil Fruit!');
    return;
  }

  const list = inventory[userId].map((item, i) => `${i + 1}. ${item.fruit} (${item.rarity})`).join('\n');
  bot.sendMessage(chatId, `📜 *Your Devil Fruit Inventory:*\n\n${list}`, { parse_mode: 'Markdown' });
});
bot.onText(/\/leaderboard/, (msg) => {
  const chatId = msg.chat.id;

  // Convert inventory object into an array of [userId, fruitArray]
  const leaderboard = Object.entries(inventory)
    .map(([userId, fruits]) => ({ userId, count: fruits.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  if (leaderboard.length === 0) {
    bot.sendMessage(chatId, '🏅 No one has pulled any Devil Fruits yet!');
    return;
  }

  let text = '🏆 *Top Devil Fruit Collectors:*\n\n';
  leaderboard.forEach((entry, index) => {
    const username = entry.userId == msg.from.id ? 'You' : `User ${entry.userId}`;
    text += `${index + 1}. ${username} - ${entry.count} fruits\n`;
  });

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});
