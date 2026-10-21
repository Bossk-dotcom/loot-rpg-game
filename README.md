# Pixel Loot & Battle RPG

**[Play the game in your browser](https://bossk-dotcom.github.io/loot-rpg-game/)**

A browser RPG built with HTML, CSS, and JavaScript. Open `index.html` in a desktop browser to play; no installation or build step is required.

## How to play

- Move with WASD or the arrow keys across large scrolling biome maps.
- Hold Space or left-click to swing. Press Shift to dodge.
- Press E near the Arctic upgrade shrine. Press I or use the toolbar button to manage swords.
- Train at either town's dummy to increase base attack using the equipped sword's power.
- Strike a regular enemy to provoke it. Aggro persists until it dies or the player reaches a town, gate, or boss den.
- Bosses automatically engage. Entering a living boss's den seals the entrance until victory or death.

## World progression

The Fallen Kingdom contains Goblins, Orcs, Knights, Dark Knights, and Vorgath the Merciless. Its world is divided by visible territory changes rather than separate single-screen rooms.

Defeating Vorgath opens the forward gate. The first crossing costs a one-time 500-gold toll and unlocks the Endless Arctic. Later travel between unlocked biomes is free, and defeated bosses remain defeated.

The Endless Arctic contains 15 Penguins, 10 Arctic Wolves, 5 Polar Bears, 3 Yetis, and Skaldrath the Frozen Tyrant. Arctic Wolves telegraph their lethal pounce with a white flash and red eyes. Polar Bears use ground smashes, Yetis throw snowballs, and Skaldrath changes attacks as his health falls.

Death returns the player to the current biome's town, resets enemy aggro, preserves upgrades and unlocks, and removes 75% of current gold.

## Chests, luck, and inventory

Both current towns contain:

- Common chest, 50 gold: 53% Common, 39% Rare, 5% Epic, 3% Legendary.
- Rare chest, 150 gold: 40% Common, 45% Rare, 10% Epic, 5% Legendary.

Luck subtly shifts probability away from Common and proportionally into higher rarities. Its per-level shift follows an exponential five-level curve of approximately 0.50, 0.62, 0.77, 0.96, and 1.20 percentage points. Each future biome tier restarts that curve, while the lowest rarity has a 15% floor. Current adjusted odds are displayed beside every chest.

The inventory starts at 100 swords. Chest rewards are stored instead of automatically replacing the equipped sword. **Equip Best** selects the highest-power item.

- Five identical swords combine into one **Divine** sword with 1.5× base power.
- Five identical Divine swords combine into one **God's Chosen** sword with 3× base power.
- When full, every chest attempt offers a capacity upgrade. The first adds 25 slots for 1,000 gold; later upgrades add 50 slots and double in price.

## Arctic upgrade shrine

Arctic Town unlocks five levels each of:

- Health: +25 maximum HP per level.
- Damage: +10% total combat damage per level.
- Speed: +3% movement speed per level.
- Critical Chance: +2% chance per level to deal double damage.
- Luck: improves chest rarity odds using the curve above.

Levels cost 200, 400, 700, 1,100, and 1,600 gold. Upgrades persist through death and reset only when starting a new adventure.

## Saving

Progress saves automatically in browser local storage, including gold, upgrades, inventory, equipped sword, capacity, unlocked biomes, paid tolls, and defeated bosses. **Start a new adventure** clears that save and restores the initial state.

## Checks

With Node.js 18 or newer installed, run:

```sh
node --test tests/game.test.cjs
```

The regression suite boots the real HTML and game script and covers world size and camera movement, biome populations, passive and persistent aggro, safe-area retreat, death, boss locks, one-time tolls, free backtracking, chest boundaries, Luck math, inventory limits, sword fusion, Equip Best, upgrades, saving, Arctic attacks, boss phases, victory, restart, and controls.

GitHub Actions runs syntax and regression checks for pushes and pull requests.
