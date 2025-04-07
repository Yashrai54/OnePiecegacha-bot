const fruits = require('../fruits.json');

function getRandomFruit() {
    const rand = Math.random();

    let rarity;
    if (rand < 0.50) rarity = 'Common';
    else if (rand < 0.75) rarity = 'Uncommon';
    else if (rand < 0.90) rarity = 'Rare';
    else if (rand < 0.97) rarity = 'Epic';
    else rarity = 'Legendary';

    const filtered = fruits.filter(f => f.rarity === rarity);
    const chosen = filtered[Math.floor(Math.random() * filtered.length)];

    return { ...chosen, rarity };
}

module.exports = getRandomFruit;
