const fruits = require('../fruits.json');

function getRandomFruit() {
    const rand = Math.random();

    // Adjust these based on how common each rarity should be
    let rarity;
    if (rand < 0.45) rarity = 'Common';
    else if (rand < 0.70) rarity = 'Uncommon';
    else if (rand < 0.85) rarity = 'Rare';
    else if (rand < 0.95) rarity = 'Legendary';
    else rarity = 'Mythical';

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
