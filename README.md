# Pixel Loot & Battle RPG

A small browser RPG built with HTML, CSS and JavaScript. Open `index.html` in a desktop browser to play; no installation or build step is needed.

## How to play

- Move with WASD or the arrow keys. Hold Space or left-click to swing in the direction you face.
- Press Shift to dodge in your movement direction (or your facing direction when standing still). A dodge lasts 0.2 seconds, avoids damage, cancels your swing, and has a 1.2-second cooldown shown above the arena.
- Train at the town dummy to gain attack power. Fight enemies for gold, then swing near a chest shop to buy a sword that increases your training gains.
- Travel right through the five battle areas. Earlier encounters are optional; you can return left to town and revisit areas to farm gold.
- Defeat the boss in Area 5, then walk through the right-hand gate and pay 500 gold to finish the adventure. The boss drops 1,000 gold.
- Use **Start a new adventure** on the victory screen to reset your run. Progress is currently held in memory and resets on reload.

## Goblin combat

In Area 1, nearby goblins approach you, with at most three pursuing at once. If you escape far enough, they return to their starting positions without recovering health.

An amber cone, an exclamation mark and a filling ring warn of an incoming attack. The goblin commits to that direction for a 0.55-second windup. Step out of the cone or time a dodge, then strike during its recovery. Hitting a winding-up goblin does not cancel or move its attack. The cone flashes red when the strike lands.

Sword attacks use a forward arc, with damage numbers, hit flashes, particles and slight knockback. A short grace period after taking damage prevents a group from landing several hits simultaneously. These player abilities and effects work in every battle zone; the new pursuit and windup behavior is limited to goblins. Town training and chest interactions still work by proximity.

Combat sounds are synthesized in the browser after your first input. Use **Sound: On / Off** to mute them; the game also works without audio support. No external audio files or dependencies are required.

## Checks

With Node.js 18 or newer installed, run:

```sh
node --test tests/game.test.cjs
```

These tests execute the real game script with a minimal DOM stub. They cover the final gate, rewards, victory, restart, death, backtracking, input cleanup, directional hit geometry, pursuit and leashing, committed windups, dodge timing/cooldowns, hit feedback, sound controls, and consistent simulation at 30, 60 and 144 Hz.

For a browser smoke test, check movement and training, buy a sword, return from a battle area, and switch tabs while moving. In the boss arena, the gate must block passage while the boss is alive. After defeating it, the gate should deduct the toll once, show the victory dialog, and stop combat. Restart should return to town with the starter sword, 100 HP, 10 attack power and 0 gold.

For combat, walk right from town into Area 1. Approach a small group, watch an amber cone without attacking, and let one hit land. Check damage feedback, then try a late dodge and a sidestep. Face away and swing to verify that enemies behind you are safe. Fight with the starter sword, check gold rewards, leave the arena mid-dodge, and toggle sound with both mouse and keyboard. Later enemies should keep their existing AI while respecting your dodge.
