// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const RESPAWN_TIME_SECONDS = 5;

const player = {
  x: 400,
  y: 300,
  hp: 100,
  maxHp: 100,
  speed: 3,
  isDodging: false,
  gold: 0
};

// Monsters initialization
const monsters = [
  {
    id: 1,
    type: 'goblin',
    x: 100,
    y: 100,
    spawnX: 100,
    spawnY: 100,
    width: 30,
    height: 30,
    hp: 30,
    maxHp: 30,
    damage: 8,
    speed: 1.8,
    attackRange: 35,
    windupDuration: 0.6,
    attackWindup: 0,
    goldReward: 10,
    isDead: false,
    respawnTimer: 0
  },
  {
    id: 2,
    type: 'skeleton',
    x: 600,
    y: 150,
    spawnX: 600,
    spawnY: 150,
    width: 30,
    height: 30,
    hp: 45,
    maxHp: 45,
    damage: 12,
    speed: 1.4,
    attackRange: 40,
    windupDuration: 0.8,
    attackWindup: 0,
    goldReward: 15,
    isDead: false,
    respawnTimer: 0
  },
  {
    id: 3,
    type: 'orc',
    x: 500,
    y: 450,
    spawnX: 500,
    spawnY: 450,
    width: 36,
    height: 36,
    hp: 75,
    maxHp: 75,
    damage: 20,
    speed: 1.1,
    attackRange: 45,
    windupDuration: 1.0,
    attackWindup: 0,
    goldReward: 25,
    isDead: false,
    respawnTimer: 0
  },
  {
    id: 4,
    type: 'dummy',
    x: 200,
    y: 400,
    spawnX: 200,
    spawnY: 400,
    width: 28,
    height: 28,
    hp: 999,
    maxHp: 999,
    damage: 0,
    speed: 0,
    attackRange: 0,
    windupDuration: 0,
    attackWindup: 0,
    goldReward: 0,
    isDead: false,
    respawnTimer: 0
  }
];

// ==========================================
// RESPAWN & DEATH LOGIC
// ==========================================
function respawnMonster(monster) {
  monster.hp = monster.maxHp;
  monster.x = monster.spawnX;
  monster.y = monster.spawnY;
  monster.isDead = false;
  monster.respawnTimer = 0;
  monster.attackWindup = 0;
}

function onMonsterDefeated(monster) {
  monster.isDead = true;
  monster.respawnTimer = RESPAWN_TIME_SECONDS;
  player.gold += monster.goldReward;
}

// ==========================================
// MONSTER UPDATE LOOP
// ==========================================
function updateMonsters(deltaTime) {
  monsters.forEach((monster) => {
    // Handle Respawn Timer for Dead Monsters
    if (monster.isDead) {
      if (monster.respawnTimer > 0) {
        monster.respawnTimer -= deltaTime;
        if (monster.respawnTimer <= 0) {
          respawnMonster(monster);
        }
      }
      return;
    }

    // Skip safe-zone training dummies
    if (monster.type === 'dummy') return;

    // Pursuit & Combat Mechanics
    const dx = player.x - monster.x;
    const dy = player.y - monster.y;
    const dist = Math.hypot(dx, dy);

    // Pursuit range check (within 250px)
    if (dist < 250 && dist > monster.attackRange) {
      monster.x += (dx / dist) * monster.speed;
      monster.y += (dy / dist) * monster.speed;
    }

    // Attack Windup & Damage Logic
    if (dist <= monster.attackRange) {
      monster.attackWindup += deltaTime;
      if (monster.attackWindup >= monster.windupDuration) {
        if (!player.isDodging) {
          player.hp = Math.max(0, player.hp - monster.damage);
        }
        monster.attackWindup = 0;
      }
    } else {
      monster.attackWindup = Math.max(0, monster.attackWindup - deltaTime);
    }
  });
}

// ==========================================
// RENDERING FUNCTIONS
// ==========================================
function drawMonsterFace(ctx, x, y, width, height, type, isWindingUp) {
  ctx.save();

  // Face Colors / Eyes based on Monster Type
  if (type === 'skeleton') {
    ctx.fillStyle = '#000000';
  } else if (type === 'orc') {
    ctx.fillStyle = '#ff3300';
  } else {
    ctx.fillStyle = '#ffff00'; // Goblins and others
  }

  // Draw Eyes
  ctx.fillRect(x + width * 0.22, y + height * 0.25, 4, 4);
  ctx.fillRect(x + width * 0.65, y + height * 0.25, 4, 4);

  // Brow expression
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.18, y + height * 0.18);
  ctx.lineTo(x + width * 0.38, y + height * 0.24);
  ctx.moveTo(x + width * 0.82, y + height * 0.18);
  ctx.lineTo(x + width * 0.62, y + height * 0.24);
  ctx.stroke();

  // Dynamic Mouth Expression (Opens when winding up attack)
  ctx.fillStyle = '#000000';
  if (isWindingUp) {
    ctx.fillRect(x + width * 0.3, y + height * 0.58, width * 0.4, 7);
  } else {
    ctx.fillRect(x + width * 0.35, y + height * 0.65, width * 0.3, 2);
  }

  ctx.restore();
}

function drawMonsters(ctx) {
  monsters.forEach((monster) => {
    if (monster.isDead) return;

    ctx.save();

    // Body Color per Monster Type
    if (monster.type === 'goblin') ctx.fillStyle = '#2e8b57';
    else if (monster.type === 'skeleton') ctx.fillStyle = '#dcdcdc';
    else if (monster.type === 'orc') ctx.fillStyle = '#455a64';
    else ctx.fillStyle = '#8b4513'; // Dummy

    // Base Body
    ctx.fillRect(monster.x, monster.y, monster.width, monster.height);

    // Render Detailed Face (if not dummy)
    if (monster.type !== 'dummy') {
      const isWindingUp = monster.attackWindup > 0;
      drawMonsterFace(ctx, monster.x, monster.y, monster.width, monster.height, monster.type, isWindingUp);
    }

    // Health Bar
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(monster.x, monster.y - 8, monster.width, 4);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(monster.x, monster.y - 8, (monster.width * monster.hp) / monster.maxHp, 4);

    ctx.restore();
  });
}
