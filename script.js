// --- Monster Definition & Respawn Configuration ---
const RESPAWN_TIME_SECONDS = 5; // Set desired respawn delay in seconds

// Helper to reset a monster to full state on respawn
function respawnMonster(monster) {
  monster.hp = monster.maxHp;
  monster.x = monster.spawnX;
  monster.y = monster.spawnY;
  monster.isDead = false;
  monster.respawnTimer = 0;
  monster.attackWindup = 0;
}

// --- Main Update Loop snippet ---
function updateMonsters(deltaTime) {
  monsters.forEach((monster) => {
    // 1. Handle Respawn Timer for Dead Monsters
    if (monster.isDead) {
      if (monster.respawnTimer > 0) {
        monster.respawnTimer -= deltaTime;
        if (monster.respawnTimer <= 0) {
          respawnMonster(monster);
        }
      }
      return; // Skip active logic while dead
    }

    // Skip safe-zone dummies or non-hostile entities
    if (monster.type === 'dummy') return;

    // 2. Pursuit & Attack Mechanics (Applied to all monsters)
    const dx = player.x - monster.x;
    const dy = player.y - monster.y;
    const dist = Math.hypot(dx, dy);

    // Pursuit range (e.g., within 250px)
    if (dist < 250 && dist > monster.attackRange) {
      monster.x += (dx / dist) * monster.speed;
      monster.y += (dy / dist) * monster.speed;
    }

    // Attack Windup & Strike Logic
    if (dist <= monster.attackRange) {
      monster.attackWindup += deltaTime;
      if (monster.attackWindup >= monster.windupDuration) {
        // Perform attack on player if not dodging
        if (!player.isDodging) {
          player.hp = Math.max(0, player.hp - monster.damage);
        }
        monster.attackWindup = 0; // Reset windup
      }
    } else {
      monster.attackWindup = Math.max(0, monster.attackWindup - deltaTime);
    }
  });
}

// --- Handling Monster Defeat ---
function onMonsterDefeated(monster) {
  monster.isDead = true;
  monster.respawnTimer = RESPAWN_TIME_SECONDS;
  player.gold += monster.goldReward;
}
