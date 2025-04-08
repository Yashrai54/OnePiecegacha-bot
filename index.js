require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();
const getRandomFruit=require('./utils/raritypicker')
const PORT = process.env.PORT || 3000;
const mongoose = require('mongoose');
const Inventory = require('./models/inventory');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Devil Fruit Bot is running!');
});

app.post(`/webhook`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
  bot.setWebHook(`https://onepiecegacha-bot.onrender.com/webhook`);
});

const cooldown = new Map();
const COOLDOWN_TIME = 60 * 1000; 

bot.onText(/\/pull/, async (msg) => {
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


const caption = `🎯 Pulled a Devil Fruit!*\n\n🍇 *Fruit:* ${fruit}\n👤 *Character:* ${user}\n📦 *Type:* ${type} (${rarity})`;

  let userInventory = await Inventory.findOne({ userId });

  if (!userInventory) {
    userInventory = new Inventory({
      userId,
      username,
      fruits: []
    });
  }

  const fruitExists = userInventory.fruits.some(f => f.fruit === fruit);
  if (fruitExists) {
    return bot.sendPhoto(chatId, image, { 
      caption: `${caption}\n\n⚠️ You already have this fruit in your inventory!`, 
      parse_mode: 'Markdown',
      reply_to_message_id:msg.message_id
    });
  }

  userInventory.fruits.push({ fruit, user, type, image, rarity });
  await userInventory.save();

  bot.sendPhoto(chatId, image, { caption, parse_mode: 'Markdown' });
});

bot.onText(/\/inventory/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  const userInventory = await Inventory.findOne({ userId });

  if (!userInventory || userInventory.fruits.length === 0) {
    return bot.sendMessage(chatId, '🗃️ Your inventory is empty. Use /pull to get your first Devil Fruit!');
  }

  const list = userInventory.fruits
    .map((item, i) => `${i + 1}. *${item.fruit}* (${item.rarity}) — ${item.user}`)
    .join('\n');

  bot.sendMessage(chatId, `📜 *Your Devil Fruit Inventory:*\n\n${list}`, { parse_mode: 'Markdown' });
});
bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;

  const allInventories = await Inventory.find();
  if (allInventories.length === 0) {
    return bot.sendMessage(chatId, '🏅 No one has pulled any Devil Fruits yet!');
  }

  const leaderboard = allInventories
    .map(user => ({
      userId: user.userId,
      username: user.username || `User_${user.userId}`,
      count: user.fruits.length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  let text = '<b>🏆 Top Devil Fruit Collectors:</b>\n\n';
  leaderboard.forEach((entry, index) => {
    const displayName = entry.userId == msg.from.id 
      ? '<b>You</b>' 
      : `@${entry.username}`;
    text += `${index + 1}. ${displayName} - ${entry.count} fruits\n`;
  });

  bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});
