const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- Game State ---
const state = {
  zone: 0, // 0: Town, 1: Goblins, 2: Orcs, 3: Knights, 4: Dark Knights, 5: Boss
  gold: 0,
  hp: 100,
  maxHp: 100,
  totalAttackPower: 10,
  tollCost: 500,
  equippedSword: { name: "Starter Sword", power: 1, rarity: "Common" }
};

// Player Object
const player = {
  x: 100,
  y: 200,
  size: 28,
  speed: 6.5,
  facing: "right", // "up", "down", "left", "right"
  swinging: false,
  swingTimer: 0
};

// Key Tracking
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === " " || e.code === "Space") {
    triggerAttack();
  }
});
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);
canvas.addEventListener("mousedown", triggerAttack);

// Town Objects
const dummy = { x: 120, y: 180, width: 32, height: 48 };
const chestShops = [
  { tier: "Common", cost: 50, x: 300, y: 100, color: "#aaaaaa" },
  { tier: "Rare", cost: 150, x: 420, y: 100, color: "#3b82f6" },
  { tier: "Epic", cost: 400, x: 540, y: 100, color: "#a855f7" },
  { tier: "Legendary", cost: 1000, x: 660, y: 100, color: "#eab308" },
  { tier: "BROKEN", cost: 5000, x: 480, y: 320, color: "#ef4444" }
];

// Enemy Data Setup
let enemies = [];

function spawnZoneEnemies() {
  enemies = [];
  if (state.zone === 0) return;

  const configs = {
    1: { count: 15, hp: 40, atk: 5, type: "Goblin", color: "#22c55e", size: 24, gold: 15 },
    2: { count: 10, hp: 120, atk: 12, type: "Orc", color: "#15803d", size: 30, gold: 35 },
    3: { count: 5, hp: 350, atk: 25, type: "Knight", color: "#94a3b8", size: 32, gold: 80 },
    4: { count: 3, hp: 900, atk: 50, type: "Dark Knight", color: "#334155", size: 36, gold: 200 },
    5: { count: 1, hp: 3500, atk: 90, type: "BOSS", color: "#b91c1c", size: 52, gold: 1000 }
  };

  const cfg = configs[state.zone];
  const startX = 250;
  const spacing = (canvas.width - startX - 80) / Math.max(1, cfg.count - 1);

  for (let i = 0; i < cfg.count; i++) {
    enemies.push({
      x: cfg.count === 1 ? 550 : startX + i * spacing,
      y: 100 + (i % 3) * 90,
      size: cfg.size,
      hp: cfg.hp,
      maxHp: cfg.hp,
      atk: cfg.atk,
      type: cfg.type,
      color: cfg.color,
      goldValue: cfg.gold,
      attackTimer: Math.floor(Math.random() * 60)
    });
  }
}

// Attack Execution
function triggerAttack() {
  if (player.swinging) return;
  player.swinging = true;
  player.swingTimer = 12;

  // Town: Hit Scarecrow Dummy
  if (state.zone === 0) {
    const distToDummy = Math.hypot(player.x - dummy.x, player.y - dummy.y);
    if (distToDummy < 60) {
      // Adds the sword's fixed power directly to total attack power pool
      const swordPower = state.equippedSword.power;
      state.totalAttackPower += swordPower;
      showStatus(`Trained on dummy! +${swordPower} Attack Power added (Total: ${state.totalAttackPower})`);
      updateHUD();
      return;
    }

    // Town: Buy Chests
    chestShops.forEach(shop => {
      const dist = Math.hypot(player.x - shop.x, player.y - shop.y);
      if (dist < 50) {
        if (state.gold >= shop.cost) {
          state.gold -= shop.cost;
          buyChest(shop.tier);
        } else {
          showStatus(`Not enough gold for ${shop.tier} Chest! Need 💰${shop.cost}`);
        }
      }
    });
    return;
  }

  // Battle Zones: Attack Enemies
  enemies.forEach(enemy => {
    if (enemy.hp <= 0) return;
    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < 65) {
      // Direct health subtraction
      enemy.hp -= state.totalAttackPower;
      if (enemy.hp <= 0) {
        enemy.hp = 0;
        state.gold += enemy.goldValue;
        showStatus(`Defeated ${enemy.type}! Earned 💰${enemy.goldValue}`);
      }
      updateHUD();
    }
  });
}

// Chest Loot System
function buyChest(tier) {
  const roll = Math.random() * 100;
  let rarity = "Common";

  if (tier === "Common") rarity = roll < 15 ? "Rare" : "Common";
  else if (tier === "Rare") rarity = roll < 20 ? "Epic" : "Rare";
  else if (tier === "Epic") rarity = roll < 15 ? "Legendary" : "Epic";
  else if (tier === "Legendary") rarity = roll < 0.1 ? "BROKEN" : "Legendary";
  else if (tier === "BROKEN") rarity = roll < 1.0 ? "BROKEN" : "Legendary";

  const powerValues = { Common: 2, Rare: 8, Epic: 25, Legendary: 75, BROKEN: 300 };
  const pwr = powerValues[rarity];

  state.equippedSword = { name: `${rarity} Claymore`, power: pwr, rarity: rarity };
  showStatus(`Opened ${tier} Chest: Found ${state.equippedSword.name} (+${pwr} Training Power)!`);
  updateHUD();
}

// Player Movement & Zone Transitions
function updatePlayer() {
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) { dy -= 1; player.facing = "up"; }
  if (keys["s"] || keys["arrowdown"]) { dy += 1; player.facing = "down"; }
  if (keys["a"] || keys["arrowleft"]) { dx -= 1; player.facing = "left"; }
  if (keys["d"] || keys["arrowright"]) { dx += 1; player.facing = "right"; }

  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  player.x += dx * player.speed;
  player.y += dy * player.speed;

  // Clamp within vertical bounds
  player.y = Math.max(20, Math.min(canvas.height - player.size - 20, player.y));

  // Transition Right (Next Zone)
  if (player.x > canvas.width - player.size) {
    if (state.zone === 5) {
      // Toll Fee requirement to move past Boss area
      if (state.gold >= state.tollCost) {
        state.gold -= state.tollCost;
        state.tollCost = Math.floor(state.tollCost * 2.5);
        state.zone++;
        player.x = 30;
        spawnZoneEnemies();
        showStatus(`Paid 💰Toll! Moving to Zone ${state.zone}`);
      } else {
        player.x = canvas.width - player.size - 10;
        showStatus(`Toll Gate: You need 💰${state.tollCost} to advance!`);
      }
    } else {
      state.zone++;
      player.x = 30;
      spawnZoneEnemies();
    }
    updateHUD();
  }

  // Transition Left (Previous Zone)
  if (player.x < 10 && state.zone > 0) {
    state.zone--;
    player.x = canvas.width - player.size - 30;
    spawnZoneEnemies();
    updateHUD();
  } else if (player.x < 10) {
    player.x = 10;
  }

  // Handle Swing Timer
  if (player.swinging) {
    player.swingTimer--;
    if (player.swingTimer <= 0) player.swinging = false;
  }
}

// Enemy AI & Attacks
function updateEnemies() {
  if (state.zone === 0) return;

  enemies.forEach(enemy => {
    if (enemy.hp <= 0) return;

    enemy.attackTimer++;
    if (enemy.attackTimer > 80) {
      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dist < 45) {
        state.hp -= enemy.atk;
        if (state.hp <= 0) {
          state.hp = state.maxHp;
          state.gold = Math.floor(state.gold * 0.25); // Lose 75% gold
          state.zone = 0; // Respawn in Town
          player.x = 100;
          player.y = 200;
          showStatus("Died in battle! Lost 75% gold and returned to Town.");
        }
        updateHUD();
      }
      enemy.attackTimer = 0;
    }
  });
}

// Drawing Functions
function drawPixelPlayer() {
  // Cap/Hat (Red)
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(player.x + 4, player.y, 20, 8);
  ctx.fillStyle = "#06b6d4"; // Visor
  ctx.fillRect(player.x + (player.facing === "left" ? 0 : 16), player.y + 4, 8, 4);

  // Face
  ctx.fillStyle = "#fde047";
  ctx.fillRect(player.x + 4, player.y + 8, 20, 10);
  ctx.fillStyle = "#000000"; // Eyes
  const eyeX = player.facing === "left" ? player.x + 6 : player.x + 18;
  ctx.fillRect(eyeX, player.y + 10, 4, 4);

  // Body (Red shirt, blue sleeves)
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(player.x + 2, player.y + 18, 24, 6);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(player.x + 6, player.y + 18, 16, 6);

  // Pants
  ctx.fillStyle = "#475569";
  ctx.fillRect(player.x + 6, player.y + 24, 16, 6);
}

function drawSwordSlash() {
  if (!player.swinging) return;

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 4;
  ctx.beginPath();

  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;

  if (player.facing === "right") ctx.arc(px + 15, py, 25, -Math.PI / 3, Math.PI / 3);
  else if (player.facing === "left") ctx.arc(px - 15, py, 25, (2 * Math.PI) / 3, (4 * Math.PI) / 3);
  else if (player.facing === "up") ctx.arc(px, py - 15, 25, -Math.PI, 0);
  else if (player.facing === "down") ctx.arc(px, py + 15, 25, 0, Math.PI);

  ctx.stroke();
}

function drawTown() {
  // Draw Training Dummy
  ctx.fillStyle = "#d97706";
  ctx.fillRect(dummy.x, dummy.y, dummy.width, dummy.height);
  ctx.fillStyle = "#78350f";
  ctx.fillRect(dummy.x + 12, dummy.y + dummy.height, 8, 16);
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px Courier New";
  ctx.fillText("DUMMY", dummy.x - 2, dummy.y - 8);

  // Draw Chest Shops
  chestShops.forEach(shop => {
    ctx.fillStyle = shop.color;
    ctx.fillRect(shop.x, shop.y, 36, 28);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(shop.x, shop.y, 36, 28);

    ctx.fillStyle = "#ffffff";
    ctx.font = "11px Courier New";
    ctx.fillText(`${shop.tier}`, shop.x - 5, shop.y - 12);
    ctx.fillText(`💰${shop.cost}`, shop.x - 5, shop.y + 42);
  });
}

function drawEnemies() {
  enemies.forEach(enemy => {
    if (enemy.hp <= 0) return;

    // Pixelated Body
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);

    // Enemy Health Bar
    const barW = enemy.size + 10;
    const barH = 6;
    const barX = enemy.x - 5;
    const barY = enemy.y - 20;

    ctx.fillStyle = "#000000";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(barX, barY, barW * (enemy.hp / enemy.maxHp), barH);

    // Enemy HP Numbers above head
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(`${enemy.hp}/${enemy.maxHp}`, enemy.x + enemy.size / 2, barY - 4);
    ctx.textAlign = "left";
  });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw Zone Environments
  if (state.zone === 0) {
    drawTown();
  } else {
    drawEnemies();
  }

  // Draw Entities & FX
  drawPixelPlayer();
  drawSwordSlash();
}

function updateHUD() {
  const zones = ["Town (Safe Area)", "Area 1: Goblins", "Area 2: Orcs", "Area 3: Knights", "Area 4: Dark Knights", "Area 5: BOSS ARENA"];
  document.getElementById("zone-title").textContent = `Zone: ${zones[state.zone] || "Area " + state.zone}`;
  document.getElementById("gold-display").textContent = `💰 Gold: ${state.gold}`;
  document.getElementById("hp-text").textContent = `${state.hp}/${state.maxHp}`;
  document.getElementById("atk-text").textContent = state.totalAttackPower;
  
  const hpPct = Math.max(0, (state.hp / state.maxHp) * 100);
  document.getElementById("player-hp-bar-fill").style.width = `${hpPct}%`;
}

function showStatus(msg) {
  document.getElementById("status-banner").textContent = msg;
}

function loop() {
  updatePlayer();
  updateEnemies();
  render();
  requestAnimationFrame(loop);
}

// Start Game Engine
updateHUD();
loop();
