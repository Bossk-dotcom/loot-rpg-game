// --- Game State ---
const state = {
  area: 1,
  gold: 0,
  hp: 100,
  maxHp: 100,
  baseAttack: 10,
  chestCost: 50,
  dummyHits: 0,
  dummyHitsReq: 10,
  equipment: {
    sword: { name: "Wooden Sword", power: 5, rarity: "Common" },
    shield: null,
    potions: 2,
    skill: null
  }
};

// --- Player & Enemy Spatial Positions (Canvas) ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const player = { x: 100, y: 150, size: 24, speed: 4 };
const enemy = { x: 480, y: 150, size: 30, hp: 50, maxHp: 50, attackTimer: 0 };
const keys = {};

// --- Event Listeners for Movement & Actions ---
window.addEventListener("keydown", (e) => keys[e.key] = true);
window.addEventListener("keyup", (e) => keys[e.key] = false);

canvas.addEventListener("click", () => {
  // Simple Melee Attack: Check distance between player and enemy
  const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  if (dist < 60) {
    const totalDmg = state.baseAttack + state.equipment.sword.power;
    enemy.hp -= totalDmg;
    if (enemy.hp <= 0) handleEnemyDefeat();
  }
});

document.getElementById("hit-dummy-btn").addEventListener("click", () => {
  state.dummyHits++;
  if (state.dummyHits >= state.dummyHitsReq) {
    state.baseAttack += 2;
    state.dummyHits = 0;
    state.dummyHitsReq = Math.floor(state.dummyHitsReq * 1.5); // Exponential growth formula
  }
  updateUI();
});

document.getElementById("buy-chest-btn").addEventListener("click", () => {
  if (state.gold < state.chestCost) return;
  state.gold -= state.chestCost;
  state.chestCost = Math.floor(state.chestCost * 1.25);
  
  const item = openChest();
  applyLoot(item);
  updateUI();
});

document.getElementById("use-potion-btn").addEventListener("click", () => {
  if (state.equipment.potions > 0 && state.hp < state.maxHp) {
    state.equipment.potions--;
    state.hp = Math.min(state.maxHp, state.hp + 40);
    updateUI();
  }
});

// --- Rarity Roll Logic ---
function openChest() {
  const roll = Math.random() * 100;
  let rarity = "Common";

  if (roll < 0.005) rarity = "BROKEN";
  else if (roll < 3.0) rarity = "Legendary";
  else if (roll < 8.0) rarity = "Epic";
  else if (roll < 47.0) rarity = "Rare";
  else rarity = "Common";

  const multipliers = { Common: 1, Rare: 2, Epic: 4, Legendary: 8, BROKEN: 25 };
  const swordPower = Math.floor(5 * multipliers[rarity] * (1 + state.area * 0.2));

  return { name: `${rarity} Sword`, power: swordPower, rarity: rarity };
}

function applyLoot(item) {
  state.equipment.sword = item;
  const lootMsg = document.getElementById("loot-message");
  lootMsg.className = `rarity-${item.rarity}`;
  lootMsg.textContent = `Opened Chest: Found ${item.name} (+${item.power} Power)!`;
}

// --- Combat Loop & Defeat Conditions ---
function handleEnemyDefeat() {
  const earnedGold = 25 * state.area;
  state.gold += earnedGold;
  state.area++;
  
  // Set up new enemy
  const isBoss = state.area % 5 === 0;
  enemy.maxHp = isBoss ? 250 * state.area : 40 * state.area;
  enemy.hp = enemy.maxHp;
  updateUI();
}

function handlePlayerDeath() {
  state.gold = Math.floor(state.gold * 0.25); // Keep 25%, lose 75%
  state.hp = state.maxHp;
  player.x = 100;
  player.y = 150;
  updateUI();
}

// --- Main Engine Game Loop ---
function update() {
  // Handle Player Movement
  if ((keys["w"] || keys["ArrowUp"]) && player.y > 0) player.y -= player.speed;
  if ((keys["s"] || keys["ArrowDown"]) && player.y < canvas.height - player.size) player.y += player.speed;
  if ((keys["a"] || keys["ArrowLeft"]) && player.x > 0) player.x -= player.speed;
  if ((keys["d"] || keys["ArrowRight"]) && player.x < canvas.width - player.size) player.x += player.speed;

  // Enemy Attack Logic
  enemy.attackTimer++;
  if (enemy.attackTimer > 90) { // Enemy swings roughly every 1.5 seconds
    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < 50) { // If player failed to dodge outside range
      state.hp -= 15;
      if (state.hp <= 0) handlePlayerDeath();
      updateUI();
    }
    enemy.attackTimer = 0;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw Player
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(player.x, player.y, player.size, player.size);

  // Draw Enemy (Bosses rendered red/larger)
  const isBoss = state.area % 5 === 0;
  ctx.fillStyle = isBoss ? "#ef4444" : "#e11d48";
  const eSize = isBoss ? 45 : enemy.size;
  ctx.fillRect(enemy.x, enemy.y, eSize, eSize);

  // Draw Enemy Attack Range Indicator
  ctx.strokeStyle = enemy.attackTimer > 60 ? "#ef4444" : "#555";
  ctx.beginPath();
  ctx.arc(enemy.x + eSize / 2, enemy.y + eSize / 2, 50, 0, Math.PI * 2);
  ctx.stroke();
}

function updateUI() {
  document.getElementById("area-display").textContent = state.area;
  document.getElementById("gold-display").textContent = state.gold;
  document.getElementById("hp-display").textContent = `${state.hp}/${state.maxHp}`;
  document.getElementById("attack-display").textContent = state.baseAttack + state.equipment.sword.power;
  document.getElementById("dummy-hits").textContent = state.dummyHits;
  document.getElementById("dummy-req").textContent = state.dummyHitsReq;
  document.getElementById("chest-cost").textContent = state.chestCost;
  document.getElementById("eq-potions").textContent = `${state.equipment.potions}x Health Potion`;
  
  const sw = state.equipment.sword;
  const swordEl = document.getElementById("eq-sword");
  swordEl.textContent = `${sw.name} (+${sw.power} Dmg)`;
  swordEl.className = `rarity-${sw.rarity}`;
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

updateUI();
loop();