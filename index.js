require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const getRandomFruit = require('./utils/raritypicker');
const Inventory = require('./models/inventory');

const app = express();
const PORT = process.env.PORT || 3000;
const COOLDOWN_TIME = 5* 60 * 1000; // 1 minute cooldown
const cooldown = new Map();

// ✅ Define bot in webhook mode
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.use(express.json());

// ✅ Root test route
app.get('/', (req, res) => {
  res.send('🍇 Devil Fruit Bot is running!');
});

// ✅ Webhook handler
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ✅ Start server and set webhook
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
  bot.setWebHook(`https://onepiecegacha-bot.onrender.com/webhook`);
});

// ✅ /pull command
bot.onText(/\/pull/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || `User_${userId}`;
  const now = Date.now();

  if (cooldown.has(userId) && now - cooldown.get(userId) < COOLDOWN_TIME) {
    const secondsLeft = Math.ceil((COOLDOWN_TIME - (now - cooldown.get(userId))) / 1000);
    return bot.sendMessage(chatId, `🕒 Please wait ${secondsLeft} seconds before pulling again.`, {
      reply_to_message_id: msg.message_id
    });
  }

  cooldown.set(userId, now);

  const { fruit, user, type, image, rarity } = getRandomFruit();

  const caption = `🎯 *Pulled a Devil Fruit!*\n\n🍇 *Fruit:* ${fruit}\n👤 *Character:* ${user}\n📦 *Type:* ${type} (${rarity})`;

  let userInventory = await Inventory.findOne({ userId });

  if (!userInventory) {
    userInventory = new Inventory({ userId, username, fruits: [] });
  }

  const alreadyOwned = userInventory.fruits.some(f => f.fruit === fruit);
  if (alreadyOwned) {
    return bot.sendPhoto(chatId, image, {
      caption: `${caption}\n\n⚠️ You already have this fruit in your inventory!`,
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id
    });
  }

  userInventory.fruits.push({ fruit, user, type, image, rarity });
  await userInventory.save();

  bot.sendPhoto(chatId, image, {
    caption,
    parse_mode: 'Markdown',
    reply_to_message_id: msg.message_id
  });
});

// ✅ /inventory command
bot.onText(/\/inventory/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  const userInventory = await Inventory.findOne({ userId });

  if (!userInventory || userInventory.fruits.length === 0) {
    return bot.sendMessage(chatId, '🗃️ Your inventory is empty. Use /pull to get your first Devil Fruit!', {
      reply_to_message_id: msg.message_id
    });
  }

  const list = userInventory.fruits
    .map((item, i) => `${i + 1}. *${item.fruit}* (${item.rarity}) — ${item.user}`)
    .join('\n');

  bot.sendMessage(chatId, `📜 *Your Devil Fruit Inventory:*\n\n${list}`, {
    parse_mode: 'Markdown',
    reply_to_message_id: msg.message_id
  });
});

// ✅ /leaderboard command
bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;

  const allInventories = await Inventory.find();
  if (allInventories.length === 0) {
    return bot.sendMessage(chatId, '🏅 No one has pulled any Devil Fruits yet!', {
      reply_to_message_id: msg.message_id
    });
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

  bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_to_message_id: msg.message_id
  });
});
