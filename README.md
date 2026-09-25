# Pixel Loot & Battle RPG

A small browser RPG built with HTML, CSS and JavaScript. Open `index.html` in a desktop browser to play; no installation or build step is needed.

## How to play

- Move with WASD or the arrow keys. Hold Space or left-click to swing.
- Train at the town dummy to gain attack power. Fight enemies for gold, then swing near a chest shop to buy a sword that increases your training gains.
- Travel right through the five battle areas. Earlier encounters are optional; you can return left to town and revisit areas to farm gold.
- Defeat the boss in Area 5, then walk through the right-hand gate and pay 500 gold to finish the adventure. The boss drops 1,000 gold.
- Use **Start a new adventure** on the victory screen to reset your run. Progress is currently held in memory and resets on reload.

## Checks

With Node.js 18 or newer installed, run:

```sh
node --test tests/game.test.cjs
```

These tests execute the real game script with a minimal DOM stub. They cover the final gate, rewards, victory, restart, death, backtracking, input cleanup, and consistent simulation at 30, 60 and 144 Hz.

For a browser smoke test, check movement and training, buy a sword, return from a battle area, and switch tabs while moving. In the boss arena, the gate must block passage while the boss is alive. After defeating it, the gate should deduct the toll once, show the victory dialog, and stop combat. Restart should return to town with the starter sword, 100 HP, 10 attack power and 0 gold.
