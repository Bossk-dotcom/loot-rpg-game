# Pixel Loot & Battle RPG

A small browser RPG built with HTML, CSS and JavaScript. Open `index.html` in a desktop browser to play; no installation or build step is needed.

## How to play

- Move with WASD or the arrow keys. Hold Space or left-click to swing in the direction you face.
- Press Shift to dodge in your movement direction (or your facing direction when standing still). A dodge lasts 0.2 seconds, avoids damage, cancels your swing, and has a 1.2-second cooldown shown above the arena.
- Train at the town dummy to gain attack power. Fight enemies for gold, then swing near a chest shop to buy a sword that increases your training gains.
- Travel right through the five battle areas. Earlier encounters are optional; you can return left to town and revisit areas to farm gold.
- Defeat the boss in Area 5, then walk through the right-hand gate and pay 500 gold to finish the adventure. The boss drops 1,000 gold.
- Use **Start a new adventure** on the victory screen to reset your run. Progress is currently held in memory and resets on reload.

## Monster combat

Goblins, orcs, knights, dark knights and the boss all approach and attack you, with at most four enemies pursuing at once. If you escape far enough, they return to their starting positions without recovering health. Each monster keeps its own movement speed, attack range and timing.

An amber cone, an exclamation mark and a filling ring warn of an incoming attack. Enemies commit to their attack direction during the windup: 0.5 seconds for goblins, 0.75 for orcs, about 0.83 for knights, 1 second for dark knights and about 1.17 for the boss. Step out of the cone or time a dodge, then strike during recovery. Hitting a winding-up enemy does not cancel or move its attack. The cone flashes red when the strike lands.

Sword attacks use a forward arc, with damage numbers, hit flashes, particles and slight knockback. A short grace period after taking damage prevents a group from landing several hits simultaneously. These abilities and effects work in every battle zone. Town training and chest interactions still work by proximity.

Regular monsters respawn at full health at their starting positions five seconds after defeat, with their attack state cleared. The boss stays defeated so you can pay the toll and finish the adventure.

Combat sounds are synthesized in the browser after your first input. Use **Sound: On / Off** to mute them; the game also works without audio support. No external audio files or dependencies are required.

## Checks

With Node.js 18 or newer installed, run:

```sh
node --test tests/game.test.cjs
```

These tests execute the real game script against the IDs from the actual HTML, validate canvas coordinates, and check that startup schedules the game loop and input works. They also cover the final gate, rewards, victory, restart, death, backtracking, directional hits, pursuit and leashing, windups, dodging, respawns, sound controls, and consistent simulation at 30, 60 and 144 Hz. Every monster type is tested for pursuit, attack timing, damage, dodging, retreat, countdown visibility and death/respawn behavior.

For a browser smoke test, check movement and training, buy a sword, return from a battle area, and switch tabs while moving. In the boss arena, the gate must block passage while the boss is alive. After defeating it, the gate should deduct the toll once, show the victory dialog, and stop combat. Restart should return to town with the starter sword, 100 HP, 10 attack power and 0 gold.

For combat, visit each of the five battle areas. Approach an enemy, watch an amber cone without attacking, and let one hit land. Check its face and countdown ring, then try a late dodge and a sidestep. Face away and swing to verify that enemies behind you are safe. Check gold rewards, wait for a regular monster to respawn, leave an arena mid-dodge, and toggle sound with both mouse and keyboard. After killing the boss, wait longer than five seconds and confirm it stays dead and the final gate remains available.

GitHub Actions runs the syntax check and regression tests for pushes and pull requests, including startup checks that catch incomplete script replacements.
