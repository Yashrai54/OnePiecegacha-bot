const fruits = require('../fruits.json');

function getRandomFruit() {
    const rand = Math.random();

    // Adjust these based on how common each rarity should be
    if (rand < 0.40) rarity = 'Common';         // 40%
else if (rand < 0.65) rarity = 'Uncommon';  // 25%
else if (rand < 0.80) rarity = 'Rare';      // 15%
else if (rand < 0.90) rarity = 'Epic';      // 10%
else if (rand < 0.97) rarity = 'Legendary'; // 7%
else rarity = 'Mythical';                   // 3

    // Fallback in case selected rarity has no entries
    let filtered = fruits.filter(f => f.rarity === rarity);

    if (filtered.length === 0) {
        // Fallback to next available rarity (rarities in preferred order)
        const fallbackOrder = ['Legendary', 'Rare', 'Uncommon', 'Common', 'Mythical'];
        for (const r of fallbackOrder) {
            filtered = fruits.filter(f => f.rarity === r);
            if (filtered.length > 0) {
                rarity = r;
                break;
            }
        }
    }

    const chosen = filtered[Math.floor(Math.random() * filtered.length)];

    return { ...chosen, rarity };
}

module.exports = getRandomFruit;
