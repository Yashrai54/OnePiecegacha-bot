const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  userId: String,
  fruits: [
    {
      fruit: String,
      rarity: String,
      type: String,
      user: String,
      image: String
    }
  ]
});

module.exports = mongoose.model('Inventory', inventorySchema);
