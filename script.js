const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Combat values are simulation ticks (60 ticks per second) and canvas pixels.
const COMBAT = {
  swordReach: 62, swordHalfAngle: Math.PI / 3, swingTicks: 20,
  dodgeTicks: 12, dodgeCooldown: 72, dodgeSpeed: 13,
  hurtGrace: 18, detection: 175, loseInterest: 250, leash: 230,
  goblinSpeed: 2.1, maxPursuers: 3,
  windup: 33, strikeTicks: 8, recovery: 40, enemyReach: 70,
  enemyHalfAngle: Math.PI / 3
};
const facingVectors = { right: [1, 0], down: [0, 1], left: [-1, 0], up: [0, -1] };
let effects = [];
let soundEnabled = true;
let audioContext = null;

function unlockAudio() {
  if (!soundEnabled) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    if (!audioContext) audioContext = new Audio();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  } catch (_) { /* Combat still works when audio is unavailable. */ }
}

function playSound(kind) {
  if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
  const sounds = {
    swing: [310, 100, 0.07, "triangle"], hit: [180, 65, 0.09, "square"],
    hurt: [110, 45, 0.13, "sawtooth"], dodge: [450, 130, 0.12, "sine"],
    defeat: [500, 850, 0.14, "triangle"]
  };
  const [start, end, duration, type] = sounds[kind];
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(start, now);
  oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function center(entity) {
  return { x: entity.x + entity.size / 2, y: entity.y + entity.size / 2 };
}

function movementVector() {
  const x = Number(!!(keys.d || keys.arrowright)) - Number(!!(keys.a || keys.arrowleft));
  const y = Number(!!(keys.s || keys.arrowdown)) - Number(!!(keys.w || keys.arrowup));
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

// Circle vs. sector intersection, including the two radial edges and arc.
// Rendering uses the same origin, reach and angle as collision detection.
function inAttackArc(origin, angle, reach, halfAngle, target) {
  const point = center(target);
  const dx = point.x - origin.x, dy = point.y - origin.y;
  const distance = Math.hypot(dx, dy), radius = target.size / 2;
  if (distance <= radius) return true;
  if (distance > reach + radius) return false;
  const offset = Math.atan2(dy, dx) - angle;
  const difference = Math.abs(Math.atan2(Math.sin(offset), Math.cos(offset)));
  if (difference <= halfAngle) return true;
  return [-halfAngle, halfAngle].some(edge => {
    const vx = Math.cos(angle + edge), vy = Math.sin(angle + edge);
    const projection = Math.max(0, Math.min(reach, dx * vx + dy * vy));
    return Math.hypot(dx - vx * projection, dy - vy * projection) <= radius;
  });
}

function addEffect(x, y, text, color, life = 36, vx = 0, vy = -0.65) {
  effects.push({ x, y, text, color, life, vx, vy });
  if (effects.length > 100) effects.shift();
}

function hitBurst(entity, color) {
  const point = center(entity);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    addEffect(point.x, point.y, "", color, 16, Math.cos(angle) * 2, Math.sin(angle) * 2);
  }
}

function updateEffects() {
  effects.forEach(effect => { effect.x += effect.vx; effect.y += effect.vy; effect.life--; });
  effects = effects.filter(effect => effect.life > 0);
}

// --- Game State ---
const FINAL_ZONE = 5;
const WELCOME_MESSAGE = "Welcome to Town! Train on the dummy, buy swords, then defeat the boss and escape through the toll gate.";
const createInitialState = () => ({
  zone: 0, // 0: Town, 1: Goblins, 2: Orcs, 3: Knights, 4: Dark Knights, 5: Boss
  gold: 0,
  hp: 100,
  maxHp: 100,
  totalAttackPower: 10,
  tollCost: 500,
  equippedSword: { name: "Starter Sword", power: 1, rarity: "Common" },
  won: false
});
const state = createInitialState();

// Player Object
const createInitialPlayer = () => ({
  x: 100,
  y: 200,
  size: 28,
  speed: 6.5,
  facing: "right", // "up", "down", "left", "right"
  swinging: false,
  swingTimer: 0,
  swingAngle: 0,
  swingOrigin: null,
  dodgeTimer: 0,
  dodgeCooldown: 0,
  dodgeX: 0,
  dodgeY: 0,
  invulnerableTimer: 0,
  hitFlash: 0
});
const player = createInitialPlayer();

// Key Tracking
const keys = {};
window.addEventListener("keydown", (e) => {
  if (state.won || e.ctrlKey || e.metaKey || e.altKey) return;
  if (["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
  unlockAudio();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
  keys[e.key.toLowerCase()] = true;
  if (!e.repeat && (e.key === " " || e.code === "Space")) {
    triggerAttack();
  }
  if (!e.repeat && e.key === "Shift") triggerDodge();
});
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) { unlockAudio(); triggerAttack(); }
});

document.getElementById("sound-button").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) unlockAudio();
  document.getElementById("sound-button").textContent = soundEnabled ? "Sound: On" : "Sound: Off";
  document.getElementById("sound-button").setAttribute("aria-pressed", String(!soundEnabled));
  canvas.focus();
});

function clearInput() {
  Object.keys(keys).forEach(key => delete keys[key]);
}

function pauseInput() {
  clearInput();
  lastTimestamp = null;
  accumulator = 0;
}

window.addEventListener("blur", pauseInput);
document.addEventListener("visibilitychange", pauseInput);

const victoryDialog = document.getElementById("victory-dialog");
document.getElementById("restart-button").addEventListener("click", restartGame);
victoryDialog.addEventListener("cancel", e => e.preventDefault());

function completeAdventure() {
  if (state.won) return;
  state.gold -= state.tollCost;
  state.won = true;
  clearInput();
  player.swinging = false;
  player.swingTimer = 0;
  player.dodgeTimer = 0;
  effects = [];
  updateHUD();
  showStatus("Adventure complete! The boss is defeated and the final toll is paid.");
  document.getElementById("victory-summary").textContent = `You escaped with ${state.gold} gold and ${state.totalAttackPower} attack power.`;
  victoryDialog.showModal();
}

function restartGame() {
  Object.assign(state, createInitialState());
  Object.assign(player, createInitialPlayer());
  enemies = [];
  effects = [];
  pauseInput();
  victoryDialog.close();
  updateHUD();
  showStatus(WELCOME_MESSAGE);
  canvas.focus();
}

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
  effects = [];
  player.dodgeTimer = 0;
  player.swinging = false;
  player.swingTimer = 0;
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
      attackTimer: Math.floor(Math.random() * 60),
      homeX: cfg.count === 1 ? 550 : startX + i * spacing,
      homeY: 100 + (i % 3) * 90,
      active: false,
      returning: false,
      phase: "idle",
      phaseTimer: 0,
      attackAngle: 0,
      attackOrigin: null,
      hitFlash: 0
    });
  }
}

// Attack Execution
function triggerAttack() {
  if (state.won || player.swinging || player.dodgeTimer > 0) return;
  player.swinging = true;
  player.swingTimer = state.zone === 0 ? 12 : COMBAT.swingTicks;
  const [facingX, facingY] = facingVectors[player.facing];
  player.swingAngle = Math.atan2(facingY, facingX);
  player.swingOrigin = center(player);
  playSound("swing");

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
    if (inAttackArc(player.swingOrigin, player.swingAngle, COMBAT.swordReach, COMBAT.swordHalfAngle, enemy)) {
      enemy.hp -= state.totalAttackPower;
      enemy.hitFlash = 7;
      const point = center(enemy);
      addEffect(point.x, enemy.y - 52, `${state.totalAttackPower}`, "#fff2b2");
      hitBurst(enemy, "#fde68a");
      // Committed attacks cannot be stun-locked or moved away from their tell.
      if (enemy.phase !== "windup" && enemy.phase !== "strike") {
        const origin = center(player);
        const distance = Math.hypot(point.x - origin.x, point.y - origin.y) || 1;
        enemy.x = Math.max(20, Math.min(canvas.width - enemy.size - 20, enemy.x + (point.x - origin.x) / distance * 14));
        enemy.y = Math.max(35, Math.min(canvas.height - enemy.size - 20, enemy.y + (point.y - origin.y) / distance * 14));
      }
      playSound("hit");
      if (enemy.hp <= 0) {
        enemy.hp = 0;
        state.gold += enemy.goldValue;
        showStatus(`Defeated ${enemy.type}! Earned 💰${enemy.goldValue}`);
        addEffect(point.x, enemy.y - 10, `+${enemy.goldValue} gold`, "#facc15", 50);
        playSound("defeat");
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
function triggerDodge() {
  if (state.won || player.dodgeCooldown > 0 || player.dodgeTimer > 0) return;
  let [dx, dy] = movementVector();
  if (dx === 0 && dy === 0) [dx, dy] = facingVectors[player.facing];
  player.dodgeX = dx;
  player.dodgeY = dy;
  player.dodgeTimer = COMBAT.dodgeTicks;
  player.dodgeCooldown = COMBAT.dodgeCooldown;
  player.swinging = false;
  player.swingTimer = 0;
  playSound("dodge");
}

function updatePlayer() {
  if (state.won) return;
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) { dy -= 1; player.facing = "up"; }
  if (keys["s"] || keys["arrowdown"]) { dy += 1; player.facing = "down"; }
  if (keys["a"] || keys["arrowleft"]) { dx -= 1; player.facing = "left"; }
  if (keys["d"] || keys["arrowright"]) { dx += 1; player.facing = "right"; }

  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  if (player.dodgeCooldown > 0) player.dodgeCooldown--;
  if (player.invulnerableTimer > 0) player.invulnerableTimer--;
  if (player.hitFlash > 0) player.hitFlash--;
  if (player.dodgeTimer > 0) {
    const point = center(player);
    addEffect(point.x, point.y, "", "#67e8f9", 12, 0, 0);
    player.x += player.dodgeX * COMBAT.dodgeSpeed;
    player.y += player.dodgeY * COMBAT.dodgeSpeed;
    player.dodgeTimer--;
  } else {
    player.x += dx * player.speed;
    player.y += dy * player.speed;
  }

  // Clamp within vertical bounds
  player.y = Math.max(20, Math.min(canvas.height - player.size - 20, player.y));

  // Transition Right (Next Zone)
  if (player.x > canvas.width - player.size) {
    if (state.zone === FINAL_ZONE) {
      player.x = canvas.width - player.size - 10;
      if (enemies.some(enemy => enemy.hp > 0)) {
        showStatus("The final gate is locked. Defeat the boss first!");
      } else if (state.gold >= state.tollCost) {
        completeAdventure();
        return;
      } else {
        showStatus(`Toll Gate: You need 💰${state.tollCost} to escape!`);
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
function moveEnemyTowards(enemy, x, y, separate = false) {
  let dx = x - enemy.x, dy = y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance < COMBAT.goblinSpeed) { enemy.x = x; enemy.y = y; return; }
  dx /= distance; dy /= distance;
  if (separate) {
    for (const other of enemies) {
      if (other === enemy || other.hp <= 0) continue;
      const sx = enemy.x - other.x, sy = enemy.y - other.y;
      const spacing = Math.hypot(sx, sy);
      if (spacing > 0 && spacing < enemy.size + 8) {
        dx += sx / spacing * 0.8;
        dy += sy / spacing * 0.8;
      }
    }
  }
  const length = Math.hypot(dx, dy) || 1;
  enemy.x = Math.max(20, Math.min(canvas.width - enemy.size - 20, enemy.x + dx / length * COMBAT.goblinSpeed));
  enemy.y = Math.max(35, Math.min(canvas.height - enemy.size - 20, enemy.y + dy / length * COMBAT.goblinSpeed));
}

function damagePlayer(enemy) {
  if (player.dodgeTimer > 0 || player.invulnerableTimer > 0) return false;
  state.hp -= enemy.atk;
  player.invulnerableTimer = COMBAT.hurtGrace;
  player.hitFlash = 9;
  const point = center(player), source = center(enemy);
  addEffect(point.x, player.y - 8, `-${enemy.atk}`, "#fca5a5");
  hitBurst(player, "#fb7185");
  playSound("hurt");
  if (state.hp <= 0) {
    state.hp = state.maxHp;
    state.gold = Math.floor(state.gold * 0.25);
    state.zone = 0;
    Object.assign(player, createInitialPlayer());
    clearInput();
    spawnZoneEnemies();
    showStatus("Died in battle! Lost 75% gold and returned to Town.");
    updateHUD();
    return true;
  }
  const distance = Math.hypot(point.x - source.x, point.y - source.y) || 1;
  player.x = Math.max(10, Math.min(canvas.width - player.size - 10, player.x + (point.x - source.x) / distance * 12));
  player.y = Math.max(20, Math.min(canvas.height - player.size - 20, player.y + (point.y - source.y) / distance * 12));
  updateHUD();
  return false;
}

function updateGoblin(enemy) {
  if (enemy.phase === "windup") {
    enemy.phaseTimer--;
    if (enemy.phaseTimer <= 0) {
      enemy.phase = "strike";
      enemy.phaseTimer = COMBAT.strikeTicks;
      if (inAttackArc(enemy.attackOrigin, enemy.attackAngle, COMBAT.enemyReach, COMBAT.enemyHalfAngle, player)) {
        if (player.dodgeTimer > 0) {
          const point = center(player);
          addEffect(point.x, player.y - 8, "DODGED", "#67e8f9");
        }
        return damagePlayer(enemy);
      }
    }
    return false;
  }
  if (enemy.phase === "strike" || enemy.phase === "recovery") {
    enemy.phaseTimer--;
    if (enemy.phaseTimer <= 0) {
      if (enemy.phase === "strike") {
        enemy.phase = "recovery";
        enemy.phaseTimer = COMBAT.recovery;
      } else enemy.phase = "idle";
    }
    return false;
  }

  const point = center(enemy), target = center(player);
  const distance = Math.hypot(target.x - point.x, target.y - point.y);
  const fromHome = Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY);
  if (enemy.active && (distance > COMBAT.loseInterest || fromHome > COMBAT.leash)) {
    enemy.active = false;
    enemy.returning = true;
  }
  if (enemy.returning) {
    moveEnemyTowards(enemy, enemy.homeX, enemy.homeY);
    if (Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY) < 3) enemy.returning = false;
    return false;
  }
  if (!enemy.active) return false;
  if (distance <= COMBAT.enemyReach - 8) {
    enemy.phase = "windup";
    enemy.phaseTimer = COMBAT.windup;
    enemy.attackOrigin = point;
    enemy.attackAngle = Math.atan2(target.y - point.y, target.x - point.x);
  } else {
    moveEnemyTowards(enemy, target.x - enemy.size / 2, target.y - enemy.size / 2, true);
  }
  return false;
}

function updateEnemies() {
  if (state.won || state.zone === 0) return;

  const target = center(player);
  const goblins = enemies.filter(enemy => enemy.type === "Goblin" && enemy.hp > 0);
  let slots = COMBAT.maxPursuers - goblins.filter(enemy => enemy.active).length;
  goblins.filter(enemy => !enemy.active && !enemy.returning)
    .map(enemy => ({ enemy, distance: Math.hypot(center(enemy).x - target.x, center(enemy).y - target.y) }))
    .sort((a, b) => a.distance - b.distance)
    .forEach(({ enemy, distance }) => {
      if (slots > 0 && distance <= COMBAT.detection) { enemy.active = true; slots--; }
    });

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.hitFlash > 0) enemy.hitFlash--;
    if (enemy.type === "Goblin") {
      if (updateGoblin(enemy)) return;
      continue;
    }

    // Later enemies retain their original behavior for this focused update.
    enemy.attackTimer++;
    if (enemy.attackTimer > 80) {
      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dist < 45) {
        if (damagePlayer(enemy)) return;
      }
      enemy.attackTimer = 0;
    }
  }
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

  if (player.hitFlash > 0) {
    ctx.fillStyle = "#ffffffaa";
    ctx.fillRect(player.x + 2, player.y, 24, 30);
  }
  if (player.dodgeTimer > 0 || player.invulnerableTimer > 0) {
    const point = center(player);
    ctx.strokeStyle = player.dodgeTimer > 0 ? "#67e8f9" : "#fda4af";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 21, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawAttackArc(origin, angle, reach, halfAngle, color, opacity) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.arc(origin.x, origin.y, reach, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawSwordSlash() {
  if (!player.swinging || !player.swingOrigin) return;
  const duration = state.zone === 0 ? 12 : COMBAT.swingTicks;
  const elapsed = duration - player.swingTimer;
  // Keep the impact arc brief so it does not linger behind a moving player.
  if (elapsed >= 7) return;
  const origin = player.swingOrigin;
  drawAttackArc(origin, player.swingAngle, COMBAT.swordReach, COMBAT.swordHalfAngle, "#7dd3fc", 0.12);
  const sweep = player.swingAngle - COMBAT.swordHalfAngle + elapsed / 7 * COMBAT.swordHalfAngle * 2;
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(origin.x + Math.cos(sweep) * 22, origin.y + Math.sin(sweep) * 22);
  ctx.lineTo(origin.x + Math.cos(sweep) * COMBAT.swordReach, origin.y + Math.sin(sweep) * COMBAT.swordReach);
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
    ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);
    if (enemy.type === "Goblin") {
      ctx.fillRect(enemy.x - 4, enemy.y + 3, 4, 7);
      ctx.fillRect(enemy.x + enemy.size, enemy.y + 3, 4, 7);
      ctx.fillStyle = enemy.phase === "windup" ? "#fef3c7" : "#052e16";
      ctx.fillRect(enemy.x + 5, enemy.y + 7, 4, 4);
      ctx.fillRect(enemy.x + 15, enemy.y + 7, 4, 4);
      ctx.fillRect(enemy.x + 8, enemy.y + 17, 8, 3);
      if (enemy.phase === "windup") {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 18px Courier New";
        ctx.fillText("!", enemy.x + enemy.size / 2 - 5, enemy.y - 38);
      }
    }

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

function drawEnemyAttacks() {
  enemies.forEach(enemy => {
    if (enemy.hp <= 0 || !enemy.attackOrigin) return;
    if (enemy.phase === "windup") {
      const progress = 1 - enemy.phaseTimer / COMBAT.windup;
      drawAttackArc(enemy.attackOrigin, enemy.attackAngle, COMBAT.enemyReach, COMBAT.enemyHalfAngle, "#fbbf24", 0.08 + progress * 0.22);
      ctx.strokeStyle = "#fff2b2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(enemy.attackOrigin.x, enemy.attackOrigin.y, 19, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    } else if (enemy.phase === "strike") {
      drawAttackArc(enemy.attackOrigin, enemy.attackAngle, COMBAT.enemyReach, COMBAT.enemyHalfAngle, "#fb7185", 0.35);
    }
  });
}

function drawEffects() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 13px Courier New";
  effects.forEach(effect => {
    ctx.globalAlpha = Math.min(1, effect.life / 12);
    ctx.fillStyle = effect.color;
    if (effect.text) {
      ctx.strokeStyle = "#101018";
      ctx.lineWidth = 3;
      ctx.strokeText(effect.text, effect.x, effect.y);
      ctx.fillText(effect.text, effect.x, effect.y);
    } else ctx.fillRect(effect.x - 2, effect.y - 2, 4, 4);
  });
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw Zone Environments
  if (state.zone === 0) {
    drawTown();
  } else {
    if (state.zone === 1) {
      ctx.fillStyle = "#89b69a";
      ctx.font = "bold 12px Courier New";
      ctx.fillText(`GOBLIN GROVE  ·  ${enemies.filter(enemy => enemy.hp > 0).length} remaining`, 18, 25);
    }
    drawEnemyAttacks();
    drawEnemies();
  }

  if (state.zone === FINAL_ZONE) {
    const bossAlive = enemies.some(enemy => enemy.hp > 0);
    ctx.fillStyle = bossAlive ? "#ef4444" : "#eab308";
    ctx.fillRect(canvas.width - 14, 30, 6, canvas.height - 60);
    ctx.font = "bold 12px Courier New";
    ctx.textAlign = "right";
    ctx.fillText(bossAlive ? "GATE LOCKED" : `EXIT: ${state.tollCost} GOLD →`, canvas.width - 22, 22);
    ctx.textAlign = "left";
  }

  // Draw Entities & FX
  drawPixelPlayer();
  drawSwordSlash();
  drawEffects();
  updateCombatHUD();
}

function updateCombatHUD() {
  const status = player.dodgeTimer > 0 ? "Dodging" : player.dodgeCooldown > 0 ? `${(player.dodgeCooldown / 60).toFixed(1)}s` : "Ready";
  const text = document.getElementById("dodge-text");
  if (text.textContent !== status) text.textContent = status;
  document.getElementById("dodge-fill").style.width = `${100 * (1 - player.dodgeCooldown / COMBAT.dodgeCooldown)}%`;
}

function updateHUD() {
  const zones = ["Town (Safe Area)", "Area 1: Goblins", "Area 2: Orcs", "Area 3: Knights", "Area 4: Dark Knights", "Area 5: BOSS ARENA"];
  document.getElementById("zone-title").textContent = `Zone: ${zones[state.zone] || "Area " + state.zone}`;
  document.getElementById("gold-display").textContent = `💰 Gold: ${state.gold}`;
  document.getElementById("hp-text").textContent = `${state.hp}/${state.maxHp}`;
  document.getElementById("atk-text").textContent = state.totalAttackPower;
  document.getElementById("objective-text").textContent = state.won
    ? "Adventure complete. Well fought!"
    : state.zone === FINAL_ZONE
      ? enemies.some(enemy => enemy.hp > 0)
        ? "Defeat the boss to unlock the final gate."
        : `Boss defeated! Walk right and pay ${state.tollCost} gold to escape.`
      : state.zone === 1
        ? "Watch the amber attack cone. Step aside or Shift-dodge, then strike back."
        : "Train, collect better swords, then defeat the boss in Area 5.";
  
  const hpPct = Math.max(0, (state.hp / state.maxHp) * 100);
  document.getElementById("player-hp-bar-fill").style.width = `${hpPct}%`;
}

function showStatus(msg) {
  document.getElementById("status-banner").textContent = msg;
}

// Simulate at the original 60 Hz speed, regardless of display refresh rate.
const STEP_MS = 1000 / 60;
let lastTimestamp = null;
let accumulator = 0;

function loop(timestamp) {
  if (lastTimestamp !== null && !document.hidden && !state.won) {
    // Discard long pauses instead of applying a burst of movement or damage.
    accumulator += Math.min(timestamp - lastTimestamp, 100);
    while (accumulator + 1e-7 >= STEP_MS) {
      updatePlayer();
      if (keys[" "]) triggerAttack();
      updateEnemies();
      updateEffects();
      accumulator -= STEP_MS;
      if (state.won) {
        accumulator = 0;
        break;
      }
    }
  }
  lastTimestamp = timestamp;
  render();
  requestAnimationFrame(loop);
}

// Start Game Engine
updateHUD();
showStatus(WELCOME_MESSAGE);
requestAnimationFrame(loop);
