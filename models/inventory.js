const mongoose = require('mongoose');

const fruitSchema = new mongoose.Schema({
  fruit: String,
  user: String,
  type: String,
  image: String,
  rarity: String
});

const inventorySchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    unique: true
  },
  username: String,
  fruits: [fruitSchema],
  bounty: {
    type: Number,
    default: 0
  }
});
