require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();
const getRandomFruit=require('./utils/raritypicker')
const PORT = process.env.PORT || 3000;

// Initialize bot (Webhook mode for Render)
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Middleware to parse JSON
app.use(express.json());

// Health check endpoint (required for Render)
app.get('/', (req, res) => {
  res.send('Devil Fruit Bot is running!');
});

// Set webhook (only needed once)
app.post(`/webhook`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
  bot.setWebHook(`https://onepiecegacha-bot.onrender.com/webhook`);
});

let inventory = {}; 

const cooldown = new Map();
const COOLDOWN_TIME = 60 * 1000; 

bot.onText(/\/pull/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || `User_${userId}`;

  const now = Date.now();
  const lastUsed = cooldown.get(userId);

  if (lastUsed && now - lastUsed < COOLDOWN_TIME) {
    const secondsLeft = Math.ceil((COOLDOWN_TIME - (now - lastUsed)) / 1000);
    return bot.sendMessage(chatId, `🕒 Please wait ${secondsLeft} seconds before pulling again.`);
  }

  cooldown.set(userId, now);

  const { fruit, user, type, image, rarity } = getRandomFruit();
  const caption = `🎯 *You Pulled a Devil Fruit!*\n\n🍇 *Fruit:* ${fruit}\n👤 *User:* ${user}\n📦 *Type:* ${type} (${rarity})`;

  if (!inventory[userId]) {
    inventory[userId] = {
      username: username,
      fruits: []
    };
  }

  const fruitExists = inventory[userId].fruits.some(
    existingFruit => existingFruit.fruit === fruit
  );

  if (fruitExists) {
    bot.sendPhoto(chatId, image, { 
      caption: `${caption}\n\n⚠️ You already have this fruit in your inventory!`, 
      parse_mode: 'Markdown' 
    });
  } else {
    // Add the new fruit to inventory
    inventory[userId].fruits.push({ fruit, user, type, image, rarity });
    bot.sendPhoto(chatId, image, { caption, parse_mode: 'Markdown' });
  }
});

bot.onText(/\/inventory/, (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (!inventory[userId] || inventory[userId].fruits.length === 0) {
    bot.sendMessage(chatId, '🗃️ Your inventory is empty. Use /pull to get your first Devil Fruit!');
    return;
  }

  const list = inventory[userId].fruits
    .map((item, i) => `${i + 1}. *${item.fruit}* (${item.rarity}) — ${item.user}`)
    .join('\n');

  bot.sendMessage(chatId, `📜 *Your Devil Fruit Inventory:*\n\n${list}`, { parse_mode: 'Markdown' });
});

bot.onText(/\/leaderboard/, (msg) => {
  const chatId = msg.chat.id;

  const leaderboard = Object.entries(inventory)
    .map(([userId, userData]) => ({
      userId,
      username: userData.username,
      count: userData.fruits.length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (leaderboard.length === 0) {
    return bot.sendMessage(chatId, '🏅 No one has pulled any Devil Fruits yet!');
  }

  let text = '<b>🏆 Top Devil Fruit Collectors:</b>\n\n';
  leaderboard.forEach((entry, index) => {
    const displayName = entry.userId === msg.from.id 
      ? '<b>You</b>' 
      : `@${entry.username || `User_${entry.userId}`}`;
    text += `${index + 1}. ${displayName} - ${entry.count} fruits\n`;
  });

  bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});