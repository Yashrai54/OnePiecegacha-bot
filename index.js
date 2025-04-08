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
    userInventory = new Inventory({ userId, username, fruits: [], bounty: 0 });
  }

  const alreadyOwned = userInventory.fruits.some(
  f => f.user === fruit.user && f.fruit === fruit.fruit && f.type === fruit.type
);

  if (alreadyOwned) {
    return bot.sendPhoto(chatId, image, {
      caption: `${caption}\n\n⚠️ You already have this fruit in your inventory!`,
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id
    });
  }

  // Only add fruit and bounty if it's a new one
  userInventory.fruits.push({ fruit, user, type, image, rarity });
  userInventory.bounty += 100;

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

  const topUsers = await Inventory.find().sort({ bounty: -1 }).limit(10);

  if (topUsers.length === 0) {
    return bot.sendMessage(chatId, '💸 No bounties have been earned yet. Use /pull to get started!', {
      reply_to_message_id: msg.message_id
    });
  }

  let text = '<b>💰 Top Bounties:</b>\n\n';
  topUsers.forEach((user, index) => {
    const name = user.userId == msg.from.id
      ? '<b>You</b>'
      : `@${user.username || 'User_' + user.userId}`;
    text += `${index + 1}. ${name} - ${user.bounty} berries\n`;
  });

  bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_to_message_id: msg.message_id
  });
});

bot.onText(/\/bounty/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const userInventory = await Inventory.findOne({ userId });

  if (!userInventory) {
    return bot.sendMessage(chatId, "👤 You don't have any bounty yet. Try /pull to start earning!", {
      reply_to_message_id: msg.message_id
    });
  }

  bot.sendMessage(chatId, `💰 *Your Bounty:* ${userInventory.bounty} berries`, {
    parse_mode: 'Markdown',
    reply_to_message_id: msg.message_id
  });
});
const pendingFights = new Map(); // userId -> { challengerId, timeout }
const pvpCooldowns = new Map();
const PVP_COOLDOWN = 5 * 60 * 1000; // 5 minutes in milliseconds
// Example using a Map for pending fights

bot.onText(/\/fight(?:\s+@?(\w+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const challengerId = msg.from.id;
  const challengerUsername = msg.from.username;

  let targetId;
  let targetUsername;

  if (msg.reply_to_message) {
    targetId = msg.reply_to_message.from.id;
    targetUsername = msg.reply_to_message.from.username || `User_${targetId}`;
  } else if (match[1]) {
    targetUsername = match[1].replace('@', '');
    const targetUser = await Inventory.findOne({ username: targetUsername });
    if (!targetUser) {
      return bot.sendMessage(chatId, `❌ Could not find user @${targetUsername}.`, {
        reply_to_message_id: msg.message_id
      });
    }
    targetId = targetUser.userId;
  } else {
    return bot.sendMessage(chatId, '⚠️ Please reply to a user or tag a username to fight.', {
      reply_to_message_id: msg.message_id
    });
  }

  if (targetId === challengerId) {
    return bot.sendMessage(chatId, '🧠 You can’t fight yourself.', {
      reply_to_message_id: msg.message_id
    });
  }

  if (pendingFights.has(targetId)) {
    return bot.sendMessage(chatId, `⚔️ @${targetUsername} already has a pending challenge.`);
  }

  const timeout = setTimeout(() => {
    pendingFights.delete(targetId);
    bot.sendMessage(chatId, `⌛ @${targetUsername} did not accept the challenge in time.`);
  }, 60 * 1000); // 1 minute to accept

  pendingFights.set(targetId, {
    challengerId,
    chatId,
    timeout
  });
  const now = Date.now();
if (pvpCooldowns.has(challengerId) && now - pvpCooldowns.get(challengerId) < PVP_COOLDOWN) {
  const secondsLeft = Math.ceil((PVP_COOLDOWN - (now - pvpCooldowns.get(challengerId))) / 1000);
  return bot.sendMessage(chatId, `⏳ Please wait ${secondsLeft} seconds before challenging again.`, {
    reply_to_message_id: msg.message_id
  });
}
pvpCooldowns.set(challengerId, now);
  bot.sendMessage(chatId, `🥊 @${challengerUsername} has challenged @${targetUsername} to a fight!\n\n@${targetUsername}, type /accept to begin the fight!`, {
    reply_to_message_id: msg.message_id
  });
});


bot.onText(/\/accept/, async (msg) => {
  const defenderId = msg.from.id;
  const defenderUsername = msg.from.username || `User_${defenderId}`;
  const fight = pendingFights.get(defenderId);

  if (!fight) {
    return bot.sendMessage(msg.chat.id, `❌ You don't have any pending fight requests.`);
  }

  const { challengerId, timeout, chatId } = fight;
  clearTimeout(timeout);
  pendingFights.delete(defenderId);

  const challengerInv = await Inventory.findOne({ userId: challengerId });
  const defenderInv = await Inventory.findOne({ userId: defenderId });

  const attackerFruit = challengerInv.fruits[Math.floor(Math.random() * challengerInv.fruits.length)];
  const defenderFruit = defenderInv.fruits[Math.floor(Math.random() * defenderInv.fruits.length)];

  const rank = { Mythical: 5, Legendary: 4,Epic:3, Rare: 2,Uncommon:1.5, Common: 1 };

  let winnerId, loserId, winnerName, loserName;
  if (rank[attackerFruit.rarity] > rank[defenderFruit.rarity]) {
    winnerId = challengerId;
    loserId = defenderId;
    winnerName = challengerInv.username;
    loserName = defenderUsername;
  } else if (rank[attackerFruit.rarity] < rank[defenderFruit.rarity]) {
    winnerId = defenderId;
    loserId = challengerId;
    winnerName = defenderUsername;
    loserName = challengerInv.username;
  } else {
    const win = Math.random() < 0.5;
    winnerId = win ? challengerId : defenderId;
    loserId = win ? defenderId : challengerId;
    winnerName = win ? challengerInv.username : defenderUsername;
    loserName = win ? defenderUsername : challengerInv.username;
  }

  const winnerInv = winnerId === challengerId ? challengerInv : defenderInv;
  const loserInv = winnerId === challengerId ? defenderInv : challengerInv;

  winnerInv.bounty += 200;
  loserInv.bounty = Math.max(0, loserInv.bounty - 100);

  await winnerInv.save();
  await loserInv.save();

  const result = `
🥊 <b>PvP Fight Accepted!</b>

🍇 <b>@${challengerInv.username}</b> used: ${attackerFruit.fruit} (${attackerFruit.rarity})
🍇 <b>@${defenderUsername}</b> used: ${defenderFruit.fruit} (${defenderFruit.rarity})

🏁 <b>Winner:</b> ${winnerName}
💰 +200 bounty to ${winnerName}
💸 -100 bounty from ${loserName}
`;

  bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
});
