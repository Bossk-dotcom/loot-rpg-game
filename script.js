const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WORLD = { width: 5200, townEnd: 720, bossStart: 4540, bossSpawn: 4860, edgePadding: 20 };
const COMBAT = { swordReach: 62, swordHalfAngle: Math.PI / 3, swingTicks: 20, attackCooldown: 60, dodgeTicks: 12, dodgeCooldown: 72, dodgeSpeed: 13, hurtGrace: 18, respawnTime: 480 };
const BOSS_NAMES = ["Vorgath the Merciless", "Skaldrath the Frozen Tyrant"];
const ENEMY_SPECS = {
  Goblin: { speed: 2.1, windup: 30, strikeTicks: 8, recovery: 35, reach: 65, color: "#22c55e", size: 24, hp: 40, atk: 5, gold: 15, attack: "cleave" },
  Orc: { speed: 1.6, windup: 66, strikeTicks: 10, recovery: 60, reach: 80, smashRadius: 72, color: "#15803d", size: 30, hp: 120, atk: 12, gold: 35, attack: "smash" },
  Knight: { speed: 1.3, windup: 50, strikeTicks: 12, recovery: 50, reach: 90, guardHalfAngle: Math.PI / 3, turnSpeed: Math.PI / 90, color: "#94a3b8", size: 32, hp: 350, atk: 25, gold: 80, attack: "cleave" },
  "Dark Knight": { speed: 1.1, windup: 60, strikeTicks: 14, recovery: 60, reach: 105, color: "#334155", size: 36, hp: 900, atk: 50, gold: 200, attack: "cleave" },
  VORGATH: { speed: 0.95, windup: 70, strikeTicks: 16, recovery: 65, reach: 135, smashRadius: 105, pounceRadius: 58, color: "#b91c1c", size: 52, hp: 3500, atk: 90, gold: 1000, boss: true },
  Penguin: { speed: 2.5, windup: 38, strikeTicks: 10, recovery: 34, reach: 80, pounceRadius: 42, color: "#e2e8f0", size: 24, hp: 100, minHits: 5, atk: 75, gold: 25, attack: "pounce" },
  "Arctic Wolf": { speed: 2.8, windup: 58, strikeTicks: 10, recovery: 50, reach: 135, pounceRadius: 48, color: "#cbd5e1", size: 28, hp: 300, minHits: 8, atk: 110, gold: 50, attack: "pounce", lethalTell: true },
  "Polar Bear": { speed: 1.5, windup: 78, strikeTicks: 14, recovery: 75, reach: 95, smashRadius: 92, color: "#f8fafc", size: 40, hp: 875, minHits: 14, atk: 135, gold: 120, attack: "smash" },
  Yeti: { speed: 1.25, windup: 68, strikeTicks: 12, recovery: 62, reach: 260, projectileSpeed: 5.5, color: "#93c5fd", size: 44, hp: 2250, minHits: 24, atk: 170, gold: 300, attack: "snowball" },
  SKALDRATH: { speed: 1.05, windup: 72, strikeTicks: 18, recovery: 60, reach: 280, smashRadius: 125, projectileSpeed: 6.5, color: "#2563eb", size: 58, hp: 8750, minHits: 50, atk: 210, gold: 1500, boss: true }
};

const BIOMES = [
  { id: "medieval", name: "The Fallen Kingdom", town: "Medieval Town", bossType: "VORGATH", bossName: BOSS_NAMES[0], background: "#243524", ground: "#365b35", tiers: [
    { type: "Goblin", count: 15, start: 850, end: 1650, label: "GOBLIN GROVE" },
    { type: "Orc", count: 10, start: 1750, end: 2600, label: "ORC STRONGHOLD" },
    { type: "Knight", count: 5, start: 2700, end: 3500, label: "KNIGHT CITADEL" },
    { type: "Dark Knight", count: 3, start: 3600, end: 4380, label: "DARK KEEP" }
  ]},
  { id: "arctic", name: "The Endless Arctic", town: "Arctic Town", bossType: "SKALDRATH", bossName: BOSS_NAMES[1], background: "#bfe6f2", ground: "#dff5fb", tiers: [
    { type: "Penguin", count: 15, start: 850, end: 1650, label: "PENGUIN SHELF" },
    { type: "Arctic Wolf", count: 10, start: 1750, end: 2600, label: "WOLF TUNDRA" },
    { type: "Polar Bear", count: 5, start: 2700, end: 3500, label: "POLAR WASTES" },
    { type: "Yeti", count: 3, start: 3600, end: 4380, label: "YETI RIDGE" }
  ]}
];

const chestShops = [
  { tier: "Common", cost: 50, x: 300, y: 100, color: "#aaaaaa" },
  { tier: "Rare", cost: 150, x: 440, y: 100, color: "#3b82f6" }
];
const BASE_CHEST_ODDS = { Common: { Common: 53, Rare: 39, Epic: 5, Legendary: 3 }, Rare: { Common: 40, Rare: 45, Epic: 10, Legendary: 5 } };
const SWORD_POWER = { Common: 2, Rare: 8, Epic: 25, Legendary: 75 };
const UPGRADE_COSTS = [200, 400, 700, 1100, 1600];
const UPGRADE_LABELS = { health: "Health", damage: "Damage", speed: "Speed", critical: "Critical Chance", luck: "Luck" };
const SAVE_KEY = "pixel-loot-rpg-save-v2";
const facingVectors = { right: [1, 0], down: [0, 1], left: [-1, 0], up: [0, -1] };
const dummy = { x: 120, y: 180, width: 32, height: 48 };
const upgradeShrine = { x: 610, y: 165, width: 38, height: 58 };

let nextItemId = 1;
function makeSword(name, rarity, basePower, enhancement = 0, id = null) {
  const multiplier = enhancement === 1 ? 1.5 : enhancement === 2 ? 3 : 1;
  const prefix = enhancement === 1 ? "Divine " : enhancement === 2 ? "God's Chosen " : "";
  return { id: id || `sword-${nextItemId++}`, baseName: name, name: `${prefix}${name}`, rarity, basePower, power: Math.ceil(basePower * multiplier), enhancement };
}

const createInitialState = () => {
  const starter = makeSword("Starter Sword", "Common", 1);
  return { biome: 0, zone: 0, gold: 0, hp: 100, maxHp: 100, totalAttackPower: 10, tollCost: 500, tollPaid: false, unlockedBiomes: 1,
    bossesDefeated: [false, false], bossLocked: false, inventory: [starter], inventoryCapacity: 100, capacityUpgrades: 0,
    biomeAttackScales: [null, null], equippedSwordId: starter.id, equippedSword: starter, upgrades: { health: 0, damage: 0, speed: 0, critical: 0, luck: 0 }, won: false };
};
const createInitialPlayer = () => ({ x: 100, y: 200, size: 28, speed: 6.5, facing: "right", swinging: false, swingTimer: 0, attackCooldown: 0, swingAngle: 0, swingOrigin: null, dodgeTimer: 0, dodgeCooldown: 0, dodgeX: 0, dodgeY: 0, invulnerableTimer: 0, hitFlash: 0 });

let state = createInitialState();
const player = createInitialPlayer();
const keys = {};
let enemies = [], effects = [], projectiles = [];
let cameraX = 0, soundEnabled = true, audioContext = null, lastTimestamp = null, accumulator = 0;

function center(entity) { return { x: entity.x + entity.size / 2, y: entity.y + entity.size / 2 }; }
function angleDifference(target, current) { return Math.atan2(Math.sin(target - current), Math.cos(target - current)); }
function movementVector() {
  let dx = 0, dy = 0;
  if (keys.w || keys.arrowup) dy--;
  if (keys.s || keys.arrowdown) dy++;
  if (keys.a || keys.arrowleft) dx--;
  if (keys.d || keys.arrowright) dx++;
  const length = Math.hypot(dx, dy) || 1;
  return [dx / length, dy / length];
}
function inAttackArc(origin, angle, reach, halfAngle, target) {
  const point = center(target), dx = point.x - origin.x, dy = point.y - origin.y;
  if (Math.max(0, Math.hypot(dx, dy) - target.size / Math.SQRT2) > reach) return false;
  return Math.abs(angleDifference(Math.atan2(dy, dx), angle)) <= halfAngle;
}

function unlockAudio() {
  if (!soundEnabled) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try { if (!audioContext) audioContext = new Audio(); if (audioContext.state === "suspended") audioContext.resume().catch(() => {}); } catch (_) {}
}
function playSound(kind) {
  if (!soundEnabled || !audioContext) return;
  const tones = { swing: [180, .05], hit: [100, .08], hurt: [70, .12], defeat: [420, .15], dodge: [300, .06], block: [560, .06], smash: [55, .18] };
  const [frequency, duration] = tones[kind] || [220, .05];
  try { const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.05, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration); } catch (_) {}
}
function addEffect(x, y, text, color, life = 36, vx = 0, vy = -.65) { effects.push({ x, y, text, color, life, vx, vy }); if (effects.length > 100) effects.splice(0, effects.length - 100); }
function hitBurst(entity, color) { const point = center(entity); for (let i = 0; i < 6; i++) { const angle = Math.PI * 2 * i / 6; addEffect(point.x, point.y, "", color, 18, Math.cos(angle) * 1.8, Math.sin(angle) * 1.8); } }
function updateEffects() { effects.forEach(effect => { effect.x += effect.vx; effect.y += effect.vy; effect.life--; }); effects = effects.filter(effect => effect.life > 0); }

function equippedSword() { const item = state.inventory.find(sword => sword.id === state.equippedSwordId) || state.inventory[0]; state.equippedSword = item; return item; }
function luckReduction(level = state.upgrades.luck) { let total = 0; for (let i = 0; i < level; i++) total += .5 * Math.pow(2.4, (i % 5) / 4); return total; }
function getChestOdds(tier) {
  const base = BASE_CHEST_ODDS[tier] || BASE_CHEST_ODDS.Common;
  const reduction = Math.min(Math.max(0, base.Common - 15), luckReduction());
  const higherTotal = base.Rare + base.Epic + base.Legendary;
  return { Common: base.Common - reduction, Rare: base.Rare + reduction * base.Rare / higherTotal, Epic: base.Epic + reduction * base.Epic / higherTotal, Legendary: base.Legendary + reduction * base.Legendary / higherTotal };
}
function rollChestRarity(tier, roll = Math.random() * 100) { const odds = getChestOdds(tier); let threshold = odds.Common; if (roll < threshold) return "Common"; threshold += odds.Rare; if (roll < threshold) return "Rare"; threshold += odds.Epic; return roll < threshold ? "Epic" : "Legendary"; }

function saveGame() { try { window.localStorage?.setItem(SAVE_KEY, JSON.stringify({ state, nextItemId })); } catch (_) {} }
function loadGame() {
  try {
    const raw = window.localStorage?.getItem(SAVE_KEY); if (!raw) return false;
    const saved = JSON.parse(raw), fresh = createInitialState();
    state = Object.assign(fresh, saved.state || {});
    state.upgrades = Object.assign(fresh.upgrades, saved.state?.upgrades || {});
    state.bossesDefeated = [false, false].map((value, index) => Boolean(saved.state?.bossesDefeated?.[index] ?? value));
    state.biomeAttackScales = [null, null].map((value, index) => Number.isFinite(saved.state?.biomeAttackScales?.[index]) ? saved.state.biomeAttackScales[index] : value);
    state.inventory = Array.isArray(saved.state?.inventory) && saved.state.inventory.length ? saved.state.inventory : fresh.inventory;
    nextItemId = Math.max(saved.nextItemId || 1, state.inventory.length + 1);
    if (!state.inventory.some(item => item.id === state.equippedSwordId)) state.equippedSwordId = state.inventory[0].id;
    state.equippedSword = equippedSword(); state.hp = Math.min(state.hp, state.maxHp); state.won = false; return true;
  } catch (_) { return false; }
}
function clearInput() { Object.keys(keys).forEach(key => delete keys[key]); }
function pauseInput() { clearInput(); lastTimestamp = null; accumulator = 0; }
function currentBiome() { return BIOMES[state.biome]; }
function currentBossAlive() { return enemies.some(enemy => enemy.boss && enemy.hp > 0); }
function currentRegion() {
  if (player.x < WORLD.townEnd) return 0;
  const tier = currentBiome().tiers.findIndex(entry => player.x >= entry.start && player.x <= entry.end);
  if (tier >= 0) return tier + 1;
  if (player.x >= WORLD.bossStart) return 5;
  return Math.min(4, Math.max(1, state.zone % 6));
}
function updateZoneFromPosition() { state.zone = state.biome * 6 + currentRegion(); }
function isSafeArea() { return player.x < WORLD.townEnd || (!currentBossAlive() && player.x > WORLD.bossStart); }

function resetEnemyCombat(enemy, returning = false) { Object.assign(enemy, { active: false, returning, phase: "idle", phaseTimer: 0, attackKind: null, attackAngle: 0, attackOrigin: null, attackTarget: null, facingAngle: Math.PI, blockFlash: 0, hitFlash: 0, warningFlash: 0 }); }
function lockBiomeAttackScale(index = state.biome) { if (index > 0 && !Number.isFinite(state.biomeAttackScales[index])) state.biomeAttackScales[index] = state.totalAttackPower; return state.biomeAttackScales[index] ?? state.totalAttackPower; }
function scaledEnemyHealth(type) { const spec = ENEMY_SPECS[type]; return spec.minHits ? Math.max(spec.hp, Math.ceil(lockBiomeAttackScale() * spec.minHits)) : spec.hp; }
function createEnemy(type, x, y, boss = false) {
  const spec = ENEMY_SPECS[type];
  const maxHp = scaledEnemyHealth(type);
  return { x, y, homeX: x, homeY: y, size: spec.size, hp: maxHp, maxHp, atk: spec.atk, type, name: boss ? currentBiome().bossName : type, color: spec.color, goldValue: spec.gold, boss, active: false, returning: false, phase: "idle", phaseTimer: 0, attackKind: null, attackAngle: 0, attackOrigin: null, attackTarget: null, facingAngle: Math.PI, blockFlash: 0, hitFlash: 0, warningFlash: 0, attackCount: 0, respawnTimer: 0 };
}
function spawnBiomeEnemies() {
  enemies = []; effects = []; projectiles = []; state.bossLocked = false; player.dodgeTimer = 0; player.swinging = false; player.swingTimer = 0;
  const biome = currentBiome();
  biome.tiers.forEach((tier, tierIndex) => {
    const usable = tier.end - tier.start - 100, columns = Math.max(1, Math.ceil(tier.count / 3));
    for (let i = 0; i < tier.count; i++) { const column = i % columns; enemies.push(createEnemy(tier.type, tier.start + 50 + usable * column / Math.max(1, columns - 1), 80 + (i % 3) * 120 + (tierIndex % 2) * 20)); }
  });
  if (!state.bossesDefeated[state.biome]) enemies.push(createEnemy(biome.bossType, WORLD.bossSpawn, 190, true));
  updateZoneFromPosition();
}
function returnAllEnemiesHome() { projectiles = []; enemies.forEach(enemy => { if (enemy.hp > 0 && !enemy.boss) resetEnemyCombat(enemy, true); }); }
function playerDamage() { const base = Math.max(1, Math.round(state.totalAttackPower * (1 + state.upgrades.damage * .1))), critical = Math.random() < state.upgrades.critical * .02; return { damage: critical ? base * 2 : base, critical }; }
function knightIsGuarding(enemy) { return enemy.type === "Knight" && !enemy.returning && enemy.phase !== "recovery"; }
function shieldBlocks(enemy, attacker) { if (!knightIsGuarding(enemy)) return false; const point = center(enemy), source = center(attacker); return Math.abs(angleDifference(Math.atan2(source.y - point.y, source.x - point.x), enemy.facingAngle)) <= ENEMY_SPECS.Knight.guardHalfAngle; }

function attemptChestPurchase(shop) {
  if (state.inventory.length >= state.inventoryCapacity) { openCapacityPrompt(); showStatus(`Inventory full (${state.inventory.length}/${state.inventoryCapacity}). Upgrade capacity to open another chest.`); return false; }
  if (state.gold < shop.cost) { showStatus(`Not enough gold for ${shop.tier} Chest! Need 💰${shop.cost}`); return false; }
  state.gold -= shop.cost; buyChest(shop.tier); return true;
}
function buyChest(tier) {
  if (state.inventory.length >= state.inventoryCapacity) { openCapacityPrompt(); return null; }
  const rarity = rollChestRarity(tier), sword = makeSword(`${rarity} Claymore`, rarity, SWORD_POWER[rarity]);
  state.inventory.push(sword); showStatus(`Opened ${tier} Chest: Found ${sword.name} (+${sword.power} Training Power)!`); renderInventory(); updateHUD(); saveGame(); return sword;
}
function triggerAttack() {
  if (state.won || player.swinging || player.attackCooldown > 0 || player.dodgeTimer > 0 || anyDialogOpen()) return;
  player.attackCooldown = COMBAT.attackCooldown;
  player.swinging = true; player.swingTimer = currentRegion() === 0 ? 12 : COMBAT.swingTicks;
  const [facingX, facingY] = facingVectors[player.facing]; player.swingAngle = Math.atan2(facingY, facingX); player.swingOrigin = center(player); playSound("swing");
  if (currentRegion() === 0) {
    if (Math.hypot(player.x - dummy.x, player.y - dummy.y) < 60) { const sword = equippedSword(); state.totalAttackPower += sword.power; showStatus(`Trained with ${sword.name}! +${sword.power} base Attack Power (Total: ${state.totalAttackPower})`); updateHUD(); saveGame(); return; }
    for (const shop of chestShops) if (Math.hypot(player.x - shop.x, player.y - shop.y) < 55) { attemptChestPurchase(shop); return; }
    return;
  }
  enemies.forEach(enemy => {
    if (enemy.hp <= 0 || !inAttackArc(player.swingOrigin, player.swingAngle, COMBAT.swordReach, COMBAT.swordHalfAngle, enemy)) return;
    enemy.active = true; enemy.returning = false;
    if (shieldBlocks(enemy, player)) { enemy.blockFlash = 10; addEffect(center(enemy).x, enemy.y - 52, "BLOCKED", "#bae6fd"); playSound("block"); return; }
    const hit = playerDamage(); enemy.hp -= hit.damage; enemy.hitFlash = 7; const point = center(enemy);
    addEffect(point.x, enemy.y - 52, `${hit.critical ? "CRIT " : ""}${hit.damage}`, hit.critical ? "#fde047" : "#fff2b2"); hitBurst(enemy, "#fde68a"); playSound("hit");
    if (enemy.hp <= 0) defeatEnemy(enemy);
  });
  updateHUD();
}
function defeatEnemy(enemy) {
  enemy.hp = 0; const point = center(enemy); resetEnemyCombat(enemy); state.gold += enemy.goldValue; addEffect(point.x, enemy.y - 10, `+${enemy.goldValue} gold`, "#facc15", 50); playSound("defeat");
  if (enemy.boss) { state.bossesDefeated[state.biome] = true; state.bossLocked = false; showStatus(`${enemy.name} has fallen! The forward gate is open.`); }
  else { enemy.respawnTimer = COMBAT.respawnTime; showStatus(`Defeated ${enemy.name}! Earned 💰${enemy.goldValue}`); }
  saveGame();
}
function triggerDodge() { if (state.won || player.dodgeCooldown > 0 || player.dodgeTimer > 0 || anyDialogOpen()) return; let [dx, dy] = movementVector(); if (!dx && !dy) [dx, dy] = facingVectors[player.facing]; Object.assign(player, { dodgeX: dx, dodgeY: dy, dodgeTimer: COMBAT.dodgeTicks, dodgeCooldown: COMBAT.dodgeCooldown, swinging: false, swingTimer: 0 }); playSound("dodge"); }

function enterBiome(index, x = 100) { state.biome = index; lockBiomeAttackScale(index); player.x = x; player.y = 200; state.hp = state.maxHp; Object.assign(player, { dodgeTimer: 0, dodgeCooldown: 0, invulnerableTimer: 0, swinging: false, swingTimer: 0 }); spawnBiomeEnemies(); cameraX = Math.max(0, Math.min(WORLD.width - canvas.width, player.x - canvas.width / 2)); updateHUD(); saveGame(); }
function advanceBiome() {
  if (state.biome === 0) {
    if (!state.tollPaid) { if (state.gold < state.tollCost) { player.x = WORLD.width - player.size - 25; showStatus(`The Arctic toll costs 💰${state.tollCost}.`); return; } state.gold -= state.tollCost; state.tollPaid = true; state.unlockedBiomes = 2; }
    enterBiome(1, 100); showStatus("Arctic Town unlocked. Visit the upgrade shrine before entering the tundra.");
  } else completeAdventure();
}
function retreatBiome() { if (state.biome === 0) { player.x = WORLD.edgePadding; return; } enterBiome(state.biome - 1, WORLD.width - player.size - 60); showStatus("Returned through the open gate to the Fallen Kingdom."); }

function updatePlayer() {
  if (state.won || anyDialogOpen()) return;
  let dx = 0, dy = 0;
  if (keys.w || keys.arrowup) { dy--; player.facing = "up"; } if (keys.s || keys.arrowdown) { dy++; player.facing = "down"; } if (keys.a || keys.arrowleft) { dx--; player.facing = "left"; } if (keys.d || keys.arrowright) { dx++; player.facing = "right"; }
  if (dx && dy) { dx *= .7071; dy *= .7071; }
  if (player.attackCooldown > 0) player.attackCooldown--; if (player.dodgeCooldown > 0) player.dodgeCooldown--; if (player.invulnerableTimer > 0) player.invulnerableTimer--; if (player.hitFlash > 0) player.hitFlash--;
  const previousX = player.x;
  if (player.dodgeTimer > 0) { const point = center(player); addEffect(point.x, point.y, "", "#67e8f9", 12, 0, 0); player.x += player.dodgeX * COMBAT.dodgeSpeed; player.y += player.dodgeY * COMBAT.dodgeSpeed; player.dodgeTimer--; }
  else { const speed = player.speed * (1 + state.upgrades.speed * .03); player.x += dx * speed; player.y += dy * speed; }
  player.y = Math.max(35, Math.min(canvas.height - player.size - 35, player.y));
  if (state.bossLocked && player.x < WORLD.bossStart + 20) player.x = WORLD.bossStart + 20;
  player.x = Math.max(-5, Math.min(WORLD.width + 5, player.x));
  if (!state.bossesDefeated[state.biome] && previousX < WORLD.bossStart && player.x >= WORLD.bossStart) { returnAllEnemiesHome(); state.bossLocked = true; const boss = enemies.find(enemy => enemy.boss && enemy.hp > 0); if (boss) boss.active = true; showStatus(`${currentBiome().bossName} seals the arena. There is no escape now.`); }
  if (isSafeArea() && !state.bossLocked) returnAllEnemiesHome();
  if (player.x > WORLD.width - player.size) { if (currentBossAlive()) { player.x = WORLD.width - player.size - 20; showStatus(`The gate is sealed. Defeat ${currentBiome().bossName}.`); } else advanceBiome(); }
  else if (player.x < 0) retreatBiome();
  updateZoneFromPosition(); cameraX = Math.max(0, Math.min(WORLD.width - canvas.width, player.x - canvas.width / 2)); if (player.swinging && --player.swingTimer <= 0) player.swinging = false; updateHUD();
}

function moveEnemyTowards(enemy, x, y, separate = false) {
  const spec = ENEMY_SPECS[enemy.type]; let dx = x - enemy.x, dy = y - enemy.y; const distance = Math.hypot(dx, dy); if (distance < spec.speed) { enemy.x = x; enemy.y = y; return; } dx /= distance; dy /= distance;
  if (separate) for (const other of enemies) { if (other === enemy || other.hp <= 0) continue; const sx = enemy.x - other.x, sy = enemy.y - other.y, spacing = Math.hypot(sx, sy); if (spacing > 0 && spacing < enemy.size + 8) { dx += sx / spacing * .8; dy += sy / spacing * .8; } }
  const length = Math.hypot(dx, dy) || 1; enemy.x = Math.max(WORLD.edgePadding, Math.min(WORLD.width - enemy.size - WORLD.edgePadding, enemy.x + dx / length * spec.speed)); enemy.y = Math.max(35, Math.min(canvas.height - enemy.size - 35, enemy.y + dy / length * spec.speed));
}
function damagePlayer(enemy, amount = enemy.atk) {
  if (player.dodgeTimer > 0 || player.invulnerableTimer > 0) return false;
  state.hp -= amount; player.invulnerableTimer = COMBAT.hurtGrace; player.hitFlash = 9; addEffect(center(player).x, player.y - 8, `-${amount}`, "#fca5a5"); hitBurst(player, "#fb7185"); playSound("hurt");
  if (state.hp <= 0) { state.hp = state.maxHp; state.gold = Math.floor(state.gold * .25); Object.assign(player, createInitialPlayer()); player.x = 100; clearInput(); spawnBiomeEnemies(); showStatus(`Defeated! Lost 75% gold and returned to ${currentBiome().town}.`); updateHUD(); saveGame(); return true; }
  updateHUD(); saveGame(); return false;
}
function chooseAttack(enemy) {
  const spec = ENEMY_SPECS[enemy.type]; if (!enemy.boss) return spec.attack; enemy.attackCount++; const healthRatio = enemy.hp / enemy.maxHp;
  if (enemy.type === "VORGATH") { if (healthRatio <= .33 && enemy.attackCount % 2 === 0) return "pounce"; if (healthRatio <= .66 && enemy.attackCount % 3 === 0) return "smash"; return "cleave"; }
  if (healthRatio <= .33) return enemy.attackCount % 2 ? "frostNova" : "shards"; if (healthRatio <= .66 && enemy.attackCount % 2 === 0) return "frostNova"; return "shards";
}
function startEnemyAttack(enemy, targetAngle, target) { const spec = ENEMY_SPECS[enemy.type]; Object.assign(enemy, { phase: "windup", phaseTimer: spec.windup, attackKind: chooseAttack(enemy), attackOrigin: center(enemy), attackAngle: targetAngle, attackTarget: { ...target }, warningFlash: spec.lethalTell ? 7 : 0 }); }
function launchProjectile(enemy, spread = 0) { const spec = ENEMY_SPECS[enemy.type], origin = center(enemy), angle = enemy.attackAngle + spread; projectiles.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * (spec.projectileSpeed || 5), vy: Math.sin(angle) * (spec.projectileSpeed || 5), radius: enemy.boss ? 10 : 8, damage: enemy.atk, life: 150, color: enemy.boss ? "#60a5fa" : "#e0f2fe" }); }
function resolveEnemyStrike(enemy) {
  const kind = enemy.attackKind, spec = ENEMY_SPECS[enemy.type], target = center(player); let hit = false;
  if (kind === "snowball") { launchProjectile(enemy); return false; }
  if (kind === "shards") { [-.18, 0, .18].forEach(spread => launchProjectile(enemy, spread)); return false; }
  if (kind === "smash" || kind === "frostNova") { const origin = kind === "frostNova" ? enemy.attackOrigin : enemy.attackTarget; hit = Math.hypot(target.x - origin.x, target.y - origin.y) <= spec.smashRadius + player.size / 2; playSound("smash"); }
  else if (kind === "pounce") { const destination = enemy.attackTarget; enemy.x = Math.max(enemy.boss ? WORLD.bossStart + 10 : WORLD.edgePadding, Math.min(WORLD.width - enemy.size - 20, destination.x - enemy.size / 2)); enemy.y = Math.max(35, Math.min(canvas.height - enemy.size - 35, destination.y - enemy.size / 2)); hit = Math.hypot(center(player).x - destination.x, center(player).y - destination.y) <= (spec.pounceRadius || 48) + player.size / 2; }
  else hit = inAttackArc(enemy.attackOrigin, enemy.attackAngle, spec.reach, Math.PI / 3, player);
  if (hit) { if (player.dodgeTimer > 0) addEffect(center(player).x, player.y - 8, "DODGED", "#67e8f9"); else return damagePlayer(enemy); }
  return false;
}
function updateEnemyAI(enemy) {
  const spec = ENEMY_SPECS[enemy.type]; if (enemy.warningFlash > 0) enemy.warningFlash--;
  if (enemy.phase === "windup") { if (--enemy.phaseTimer <= 0) { enemy.phase = "strike"; enemy.phaseTimer = spec.strikeTicks; return resolveEnemyStrike(enemy); } return false; }
  if (enemy.phase === "strike" || enemy.phase === "recovery") { if (--enemy.phaseTimer <= 0) { if (enemy.phase === "strike") { enemy.phase = "recovery"; enemy.phaseTimer = spec.recovery; } else enemy.phase = "idle"; } return false; }
  if (enemy.returning) { moveEnemyTowards(enemy, enemy.homeX, enemy.homeY); if (Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY) < 3) enemy.returning = false; return false; }
  if (!enemy.active) return false;
  const point = center(enemy), target = center(player), distance = Math.hypot(target.x - point.x, target.y - point.y), targetAngle = Math.atan2(target.y - point.y, target.x - point.x);
  if (enemy.type === "Knight") { const turn = angleDifference(targetAngle, enemy.facingAngle); enemy.facingAngle += Math.max(-spec.turnSpeed, Math.min(spec.turnSpeed, turn)); if (distance <= spec.reach - 8 && Math.abs(angleDifference(targetAngle, enemy.facingAngle)) > .25) return false; }
  const attackRange = spec.attack === "snowball" || enemy.boss ? spec.reach : spec.reach - 8;
  if (distance <= attackRange) startEnemyAttack(enemy, enemy.type === "Knight" ? enemy.facingAngle : targetAngle, target); else moveEnemyTowards(enemy, target.x - enemy.size / 2, target.y - enemy.size / 2, true);
  return false;
}
function updateProjectiles() {
  for (const projectile of projectiles) { projectile.x += projectile.vx; projectile.y += projectile.vy; projectile.life--; if (projectile.life > 0 && Math.hypot(projectile.x - center(player).x, projectile.y - center(player).y) <= projectile.radius + player.size / 2) { if (player.dodgeTimer > 0) addEffect(center(player).x, player.y - 8, "DODGED", "#67e8f9"); else damagePlayer({ x: projectile.x, y: projectile.y, size: 1, atk: projectile.damage }, projectile.damage); projectile.life = 0; } }
  projectiles = projectiles.filter(projectile => projectile.life > 0 && projectile.x > cameraX - 200 && projectile.x < cameraX + canvas.width + 400);
}
function updateEnemies() {
  if (state.won || currentRegion() === 0 || anyDialogOpen()) return;
  for (const enemy of enemies) { if (enemy.hp <= 0) { if (!enemy.boss && enemy.respawnTimer > 0 && --enemy.respawnTimer <= 0) { enemy.hp = enemy.maxHp; enemy.x = enemy.homeX; enemy.y = enemy.homeY; resetEnemyCombat(enemy); } continue; } if (enemy.hitFlash > 0) enemy.hitFlash--; if (enemy.blockFlash > 0) enemy.blockFlash--; if (updateEnemyAI(enemy)) return; }
  updateProjectiles();
}

function anyDialogOpen() { return ["inventory-dialog", "upgrade-dialog", "capacity-dialog", "victory-dialog"].some(id => document.getElementById(id)?.open); }
function renderInventory() {
  const list = document.getElementById("inventory-list"), count = document.getElementById("inventory-count"); if (count) count.textContent = `${state.inventory.length}/${state.inventoryCapacity}`; if (!list) return;
  const groups = new Map(); state.inventory.forEach(item => { const key = `${item.baseName}|${item.enhancement}`; if (!groups.has(key)) groups.set(key, { item, count: 0 }); groups.get(key).count++; });
  list.innerHTML = [...groups.entries()].map(([key, group]) => { const equipped = state.inventory.some(item => item.id === state.equippedSwordId && item.baseName === group.item.baseName && item.enhancement === group.item.enhancement), canCombine = group.count >= 5 && group.item.enhancement < 2; return `<div class="inventory-row"><span>${group.item.name} ×${group.count} — ${group.item.power} power${equipped ? " (equipped)" : ""}</span><span><button data-action="equip" data-id="${group.item.id}">Equip</button>${canCombine ? `<button data-action="combine" data-key="${key}">Combine 5</button>` : ""}</span></div>`; }).join("");
}
function openInventory() { pauseInput(); renderInventory(); document.getElementById("inventory-dialog").showModal(); }
function equipItem(id) { const item = state.inventory.find(sword => sword.id === id); if (!item) return false; state.equippedSwordId = item.id; state.equippedSword = item; renderInventory(); updateHUD(); saveGame(); return true; }
function equipBest() { const best = state.inventory.reduce((winner, item) => item.power > winner.power ? item : winner, state.inventory[0]); return equipItem(best.id); }
function combineSwords(baseName, enhancement) {
  const matches = state.inventory.filter(item => item.baseName === baseName && item.enhancement === enhancement); if (matches.length < 5 || enhancement >= 2) return false;
  const consumed = new Set(matches.slice(0, 5).map(item => item.id)), source = matches[0]; state.inventory = state.inventory.filter(item => !consumed.has(item.id)); const combined = makeSword(source.baseName, source.rarity, source.basePower, enhancement + 1); state.inventory.push(combined); if (consumed.has(state.equippedSwordId)) state.equippedSwordId = combined.id; equippedSword(); showStatus(`Forged ${combined.name} with ${combined.power} training power!`); renderInventory(); updateHUD(); saveGame(); return combined;
}
function capacityUpgradeCost() { return 1000 * Math.pow(2, state.capacityUpgrades); }
function capacityUpgradeGain() { return state.capacityUpgrades === 0 ? 25 : 50; }
function openCapacityPrompt() { pauseInput(); document.getElementById("capacity-message").textContent = `Inventory is full at ${state.inventoryCapacity} swords. Add ${capacityUpgradeGain()} slots for ${capacityUpgradeCost()} gold?`; document.getElementById("capacity-dialog").showModal(); }
function purchaseCapacityUpgrade() { const cost = capacityUpgradeCost(); if (state.gold < cost) { showStatus(`Capacity upgrade requires 💰${cost}.`); return false; } const gain = capacityUpgradeGain(); state.gold -= cost; state.inventoryCapacity += gain; state.capacityUpgrades++; document.getElementById("capacity-dialog").close(); showStatus(`Inventory expanded by ${gain} slots to ${state.inventoryCapacity}.`); updateHUD(); saveGame(); return true; }

function upgradeEffectText(key, level) { return { health: `+${level * 25} max HP`, damage: `+${level * 10}% damage`, speed: `+${level * 3}% speed`, critical: `${level * 2}% critical chance`, luck: `${luckReduction(level).toFixed(2)} rarity points shifted` }[key]; }
function renderUpgradeTree() { const list = document.getElementById("upgrade-list"); if (!list) return; list.innerHTML = Object.keys(UPGRADE_LABELS).map(key => { const level = state.upgrades[key], maxed = level >= 5; return `<div class="upgrade-row"><span><b>${UPGRADE_LABELS[key]}</b> ${level}/5<br><small>${upgradeEffectText(key, level)}</small></span><button data-upgrade="${key}" ${maxed ? "disabled" : ""}>${maxed ? "MAX" : `${UPGRADE_COSTS[level]} gold`}</button></div>`; }).join(""); }
function openUpgradeTree() { if (state.biome < 1 || currentRegion() !== 0) { showStatus("The upgrade shrine is located in Arctic Town."); return false; } pauseInput(); renderUpgradeTree(); document.getElementById("upgrade-dialog").showModal(); return true; }
function purchaseUpgrade(key) { if (!(key in state.upgrades) || state.upgrades[key] >= 5) return false; const level = state.upgrades[key], cost = UPGRADE_COSTS[level]; if (state.gold < cost) { showStatus(`${UPGRADE_LABELS[key]} level ${level + 1} requires 💰${cost}.`); return false; } state.gold -= cost; state.upgrades[key]++; if (key === "health") { state.maxHp += 25; state.hp += 25; } renderUpgradeTree(); updateHUD(); saveGame(); return true; }
function interact() { if (state.biome === 1 && currentRegion() === 0 && Math.hypot(player.x - upgradeShrine.x, player.y - upgradeShrine.y) < 85) openUpgradeTree(); else showStatus("There is nothing to interact with nearby."); }

function completeAdventure() { if (state.won) return; state.won = true; clearInput(); effects = []; projectiles = []; updateHUD(); document.getElementById("victory-summary").textContent = `Skaldrath has fallen. You hold ${state.gold} gold, ${state.totalAttackPower} base attack, and ${state.inventory.length} swords.`; document.getElementById("victory-dialog").showModal(); saveGame(); }
function restartGame() { try { window.localStorage?.removeItem(SAVE_KEY); } catch (_) {} nextItemId = 1; state = createInitialState(); Object.assign(player, createInitialPlayer()); effects = []; projectiles = []; pauseInput(); document.getElementById("victory-dialog").close(); spawnBiomeEnemies(); renderInventory(); updateHUD(); showStatus(`Welcome to Town. Train, collect swords, and hunt ${BOSS_NAMES[0]}.`); canvas.focus(); }

function drawReadableLabel(text, x, y, color = "#ffffff", align = "left") {
  ctx.save(); ctx.font = "bold 12px Courier New"; ctx.textAlign = align; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(3, 7, 18, .92)"; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
}

function drawWorldBackground() {
  const biome = currentBiome(); ctx.fillStyle = biome.background; ctx.fillRect(cameraX, 0, canvas.width, canvas.height); ctx.fillStyle = biome.ground; ctx.fillRect(cameraX, 40, canvas.width, canvas.height - 80);
  biome.tiers.forEach((tier, index) => { ctx.fillStyle = state.biome === 0 ? (index % 2 ? "#2f4c32" : "#3e613b") : (index % 2 ? "#c9eaf4" : "#e8f8fc"); ctx.fillRect(tier.start, 40, tier.end - tier.start, canvas.height - 80); drawReadableLabel(tier.label, tier.start + 20, 65, state.biome === 0 ? "#d1fae5" : "#e0f2fe"); });
  ctx.fillStyle = state.biome === 0 ? "#391c24" : "#16396b"; ctx.fillRect(WORLD.bossStart, 40, WORLD.width - WORLD.bossStart, canvas.height - 80); drawReadableLabel(`${biome.bossName.toUpperCase()}'S DEN`, WORLD.bossStart + 28, 68, "#fecaca");
}
function drawTown() {
  ctx.fillStyle = state.biome === 0 ? "#9a6b32" : "#effcff"; ctx.fillRect(0, 40, WORLD.townEnd, canvas.height - 80); ctx.fillStyle = "#d97706"; ctx.fillRect(dummy.x, dummy.y, dummy.width, dummy.height); ctx.fillStyle = "#78350f"; ctx.fillRect(dummy.x + 12, dummy.y + dummy.height, 8, 16); drawReadableLabel("DUMMY", dummy.x + dummy.width / 2, dummy.y - 8, "#ffffff", "center");
  chestShops.forEach(shop => { ctx.fillStyle = shop.color; ctx.fillRect(shop.x, shop.y, 42, 32); ctx.strokeStyle = "#ffffff"; ctx.strokeRect(shop.x, shop.y, 42, 32); const odds = getChestOdds(shop.tier); drawReadableLabel(`${shop.tier} Chest`, shop.x + 21, shop.y - 12, "#ffffff", "center"); drawReadableLabel(`💰${shop.cost}`, shop.x + 21, shop.y + 47, "#fde68a", "center"); drawReadableLabel(`C${odds.Common.toFixed(1)} R${odds.Rare.toFixed(1)}`, shop.x + 21, shop.y + 62, "#e2e8f0", "center"); drawReadableLabel(`E${odds.Epic.toFixed(1)} L${odds.Legendary.toFixed(1)}`, shop.x + 21, shop.y + 76, "#e2e8f0", "center"); });
  if (state.biome === 1) { ctx.fillStyle = "#7c3aed"; ctx.fillRect(upgradeShrine.x, upgradeShrine.y, upgradeShrine.width, upgradeShrine.height); drawReadableLabel("UPGRADE SHRINE", upgradeShrine.x + upgradeShrine.width / 2, upgradeShrine.y - 10, "#ffffff", "center"); drawReadableLabel("Press E", upgradeShrine.x + upgradeShrine.width / 2, upgradeShrine.y + 76, "#ffffff", "center"); }
}
function drawPixelPlayer() { ctx.fillStyle = "rgba(15, 23, 42, .45)"; ctx.fillRect(player.x - 4, player.y + player.size - 3, player.size + 8, 7); ctx.fillStyle = "#0f172a"; ctx.fillRect(player.x + 2, player.y - 2, 24, 32); ctx.fillStyle = player.hitFlash > 0 ? "#ffffff" : "#ef4444"; ctx.fillRect(player.x + 4, player.y, 20, 8); ctx.fillStyle = "#06b6d4"; ctx.fillRect(player.x + (player.facing === "left" ? 0 : 16), player.y + 4, 8, 4); ctx.fillStyle = "#facc15"; ctx.fillRect(player.x + 5, player.y + 8, 18, 20); drawReadableLabel("YOU", player.x + player.size / 2, player.y - 10, "#fef08a", "center"); }
function drawKnightShield(enemy) { const point = center(enemy); ctx.strokeStyle = enemy.blockFlash > 0 ? "#ffffff" : "#7dd3fc"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(point.x, point.y, enemy.size / 2 + 9, enemy.facingAngle - Math.PI / 3, enemy.facingAngle + Math.PI / 3); ctx.stroke(); }
function drawEnemies() {
  enemies.forEach(enemy => { if (enemy.hp <= 0) return; ctx.fillStyle = enemy.warningFlash > 0 || enemy.hitFlash > 0 ? "#ffffff" : enemy.color; ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size); const redEyes = enemy.type === "Arctic Wolf" && ["windup", "strike"].includes(enemy.phase); ctx.fillStyle = redEyes ? "#ef4444" : "#0f172a"; ctx.fillRect(enemy.x + 6, enemy.y + 7, 4, 4); ctx.fillRect(enemy.x + enemy.size - 10, enemy.y + 7, 4, 4); if (enemy.type === "Knight") drawKnightShield(enemy); const barWidth = enemy.size + (enemy.boss ? 90 : 10), barX = enemy.x + enemy.size / 2 - barWidth / 2, barY = enemy.y - 20; ctx.fillStyle = "#3f0b0b"; ctx.fillRect(barX, barY, barWidth, 7); ctx.fillStyle = "#22c55e"; ctx.fillRect(barX, barY, barWidth * enemy.hp / enemy.maxHp, 7); drawReadableLabel(enemy.boss ? enemy.name : `${enemy.hp}/${enemy.maxHp}`, enemy.x + enemy.size / 2, barY - 6, enemy.boss ? "#fecaca" : "#ffffff", "center"); });
}
function drawEnemyAttacks() {
  enemies.forEach(enemy => { if (enemy.hp <= 0 || enemy.phase !== "windup") return; const spec = ENEMY_SPECS[enemy.type], progress = 1 - enemy.phaseTimer / spec.windup; ctx.strokeStyle = enemy.type === "Arctic Wolf" ? "#ef4444" : "#fbbf24"; ctx.lineWidth = 3; if (["smash", "pounce"].includes(enemy.attackKind)) { ctx.beginPath(); ctx.arc(enemy.attackTarget.x, enemy.attackTarget.y, enemy.attackKind === "smash" ? spec.smashRadius : spec.pounceRadius, 0, Math.PI * 2); ctx.stroke(); } else if (enemy.attackKind === "frostNova") { ctx.beginPath(); ctx.arc(enemy.attackOrigin.x, enemy.attackOrigin.y, spec.smashRadius, 0, Math.PI * 2); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(enemy.attackOrigin.x, enemy.attackOrigin.y, Math.max(enemy.size, spec.reach * progress), enemy.attackAngle - Math.PI / 3, enemy.attackAngle + Math.PI / 3); ctx.stroke(); } });
  projectiles.forEach(projectile => { ctx.fillStyle = projectile.color; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2); ctx.fill(); });
}
function drawSwordSlash() { if (!player.swinging || !player.swingOrigin) return; const elapsed = COMBAT.swingTicks - player.swingTimer, sweep = player.swingAngle - COMBAT.swordHalfAngle + elapsed / COMBAT.swingTicks * COMBAT.swordHalfAngle * 2; ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(player.swingOrigin.x + Math.cos(sweep) * 22, player.swingOrigin.y + Math.sin(sweep) * 22); ctx.lineTo(player.swingOrigin.x + Math.cos(sweep) * COMBAT.swordReach, player.swingOrigin.y + Math.sin(sweep) * COMBAT.swordReach); ctx.stroke(); }
function drawEffects() { effects.forEach(effect => { if (effect.text) drawReadableLabel(effect.text, effect.x, effect.y, effect.color, "center"); else { ctx.fillStyle = effect.color; ctx.fillRect(effect.x - 2, effect.y - 2, 4, 4); } }); }
function render() { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.translate(-cameraX, 0); drawWorldBackground(); drawTown(); if (state.bossLocked) { ctx.fillStyle = "#ef4444"; ctx.fillRect(WORLD.bossStart, 35, 8, canvas.height - 70); } drawEnemyAttacks(); drawEnemies(); drawPixelPlayer(); drawSwordSlash(); drawEffects(); ctx.restore(); }

function regionName() { const region = currentRegion(); if (region === 0) return currentBiome().town; if (region === 5) return `${currentBiome().bossName}'s Den`; return currentBiome().tiers[region - 1]?.label || currentBiome().name; }
function updateHUD() {
  document.getElementById("zone-title").textContent = `${currentBiome().name}: ${regionName()}`; document.getElementById("gold-display").textContent = `💰 Gold: ${state.gold}`; document.getElementById("hp-text").textContent = `${state.hp}/${state.maxHp}`; document.getElementById("atk-text").textContent = `${state.totalAttackPower} ×${(1 + state.upgrades.damage * .1).toFixed(1)}`; document.getElementById("player-hp-bar-fill").style.width = `${Math.max(0, state.hp / state.maxHp * 100)}%`;
  const inventoryCount = document.getElementById("inventory-count"); if (inventoryCount) inventoryCount.textContent = `${state.inventory.length}/${state.inventoryCapacity}`;
  const objective = document.getElementById("objective-text"); if (state.won) objective.textContent = "The Arctic tyrant has fallen. Your journey will continue in a future biome."; else if (state.bossLocked) objective.textContent = `Defeat ${currentBiome().bossName}. The arena is sealed.`; else if (currentRegion() === 0 && state.biome === 1) objective.textContent = "Spend gold at the upgrade shrine, manage your inventory, or enter the Arctic."; else if (currentRegion() === 0) objective.textContent = `Train and gather swords before confronting ${BOSS_NAMES[0]}.`; else objective.textContent = "Strike an enemy to provoke it. Aggro persists until it dies or you reach safety.";
}
function updateCombatHUD() { const status = player.dodgeTimer > 0 ? "Dodging" : player.dodgeCooldown > 0 ? `${(player.dodgeCooldown / 60).toFixed(1)}s` : "Ready"; document.getElementById("dodge-text").textContent = status; document.getElementById("dodge-fill").style.width = `${100 * (1 - player.dodgeCooldown / COMBAT.dodgeCooldown)}%`; document.getElementById("attack-text").textContent = player.attackCooldown > 0 ? `${(player.attackCooldown / 60).toFixed(1)}s` : "Ready"; document.getElementById("attack-fill").style.width = `${100 * (1 - player.attackCooldown / COMBAT.attackCooldown)}%`; }
function showStatus(message) { document.getElementById("status-banner").textContent = message; }
function loop(timestamp) { if (lastTimestamp !== null && !document.hidden && !state.won) { accumulator += Math.min(timestamp - lastTimestamp, 100); while (accumulator + 1e-7 >= 1000 / 60) { updatePlayer(); if (keys[" "]) triggerAttack(); updateEnemies(); updateEffects(); accumulator -= 1000 / 60; } } lastTimestamp = timestamp; render(); updateCombatHUD(); requestAnimationFrame(loop); }

window.addEventListener("keydown", event => { if (state.won || event.ctrlKey || event.metaKey || event.altKey) return; if (["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName)) return; const key = event.key.toLowerCase(); if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault(); keys[key] = true; unlockAudio(); if (!event.repeat && (event.key === " " || event.code === "Space")) triggerAttack(); if (!event.repeat && event.key === "Shift") triggerDodge(); if (!event.repeat && key === "e") interact(); if (!event.repeat && key === "i") openInventory(); });
window.addEventListener("keyup", event => keys[event.key.toLowerCase()] = false); window.addEventListener("blur", pauseInput); document.addEventListener("visibilitychange", pauseInput); canvas.addEventListener("mousedown", event => { if (event.button === 0) { unlockAudio(); triggerAttack(); } });
document.getElementById("sound-button").addEventListener("click", () => { soundEnabled = !soundEnabled; document.getElementById("sound-button").textContent = soundEnabled ? "Sound: On" : "Sound: Off"; document.getElementById("sound-button").setAttribute("aria-pressed", String(!soundEnabled)); canvas.focus(); });
document.getElementById("inventory-button").addEventListener("click", openInventory); document.getElementById("inventory-close").addEventListener("click", () => document.getElementById("inventory-dialog").close()); document.getElementById("equip-best-button").addEventListener("click", equipBest);
document.getElementById("inventory-list").addEventListener("click", event => { if (event.target?.dataset?.action === "equip") equipItem(event.target.dataset.id); if (event.target?.dataset?.action === "combine") { const [baseName, enhancement] = event.target.dataset.key.split("|"); combineSwords(baseName, Number(enhancement)); } });
document.getElementById("upgrade-close").addEventListener("click", () => document.getElementById("upgrade-dialog").close()); document.getElementById("upgrade-list").addEventListener("click", event => { if (event.target?.dataset?.upgrade) purchaseUpgrade(event.target.dataset.upgrade); }); document.getElementById("capacity-upgrade-button").addEventListener("click", purchaseCapacityUpgrade); document.getElementById("capacity-close").addEventListener("click", () => document.getElementById("capacity-dialog").close()); document.getElementById("restart-button").addEventListener("click", restartGame); document.getElementById("victory-dialog").addEventListener("cancel", event => event.preventDefault());

loadGame(); Object.assign(player, createInitialPlayer()); spawnBiomeEnemies(); renderInventory(); updateHUD(); showStatus(`Welcome back. ${currentBiome().bossName} waits beyond the final territory.`); requestAnimationFrame(loop);
