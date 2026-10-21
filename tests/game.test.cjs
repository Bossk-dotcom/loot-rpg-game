const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const documentIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));

function boot(storage = new Map()) {
  const elements = new Map();
  const windowListeners = {};
  const documentListeners = {};
  const drawCalls = [];
  const frames = [];
  const drawing = new Proxy({}, { get(target, method) {
    if (method in target) return target[method];
    return (...args) => {
      const positions = { arc:[0,1,2,3,4], fillRect:[0,1,2,3], strokeRect:[0,1,2,3], clearRect:[0,1,2,3], moveTo:[0,1], lineTo:[0,1], fillText:[1,2], translate:[0,1] }[method] || [];
      positions.forEach(index => assert.ok(Number.isFinite(args[index]), `${method} argument ${index} must be finite`));
      drawCalls.push({ method, args });
    };
  }});
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      style: {}, textContent: '', innerHTML: '', open: false, listeners: {}, dataset: {},
      width: 800, height: 450,
      getContext: () => drawing,
      addEventListener(name, handler) { this.listeners[name] = handler; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      focus() { this.focused = true; },
      setAttribute(name, value) { this[name] = value; }
    });
    return elements.get(id);
  }
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const document = {
    hidden: false,
    getElementById: id => documentIds.has(id) ? element(id) : null,
    addEventListener(name, handler) { documentListeners[name] = handler; }
  };
  const context = vm.createContext({
    document,
    window: { localStorage, addEventListener(name, handler) { windowListeners[name] = handler; } },
    requestAnimationFrame: callback => frames.push(callback)
  });
  vm.runInContext(source, context);
  return { run: code => vm.runInContext(code, context), element, storage, windowListeners, documentListeners, drawCalls, frames };
}

function nearEnemy(game, type) {
  game.run(`player.x = 900; player.y = 180; updateZoneFromPosition(); enemies = [createEnemy('${type}', 950, 180)]; player.facing = 'right';`);
}

test('the real HTML and game script boot with every required control', () => {
  const game = boot();
  assert.equal(game.frames.length, 1);
  for (const id of ['inventory-button','inventory-dialog','upgrade-dialog','capacity-dialog','victory-dialog','attack-text','attack-fill']) assert.ok(documentIds.has(id));
  game.frames.shift()(0);
  assert.equal(game.frames.length, 1);
  assert.ok(game.drawCalls.some(call => call.method === 'fillText' && call.args[0] === 'DUMMY'));
});

test('each biome contains the requested monster counts and one boss', () => {
  const game = boot();
  assert.equal(game.run('enemies.filter(e=>e.type==="Goblin").length'), 15);
  assert.equal(game.run('enemies.filter(e=>e.type==="Orc").length'), 10);
  assert.equal(game.run('enemies.filter(e=>e.type==="Knight").length'), 5);
  assert.equal(game.run('enemies.filter(e=>e.type==="Dark Knight").length'), 3);
  assert.equal(game.run('enemies.filter(e=>e.type==="VORGATH").length'), 1);
  game.run('enterBiome(1);');
  assert.equal(game.run('enemies.filter(e=>e.type==="Penguin").length'), 15);
  assert.equal(game.run('enemies.filter(e=>e.type==="Arctic Wolf").length'), 10);
  assert.equal(game.run('enemies.filter(e=>e.type==="Polar Bear").length'), 5);
  assert.equal(game.run('enemies.filter(e=>e.type==="Yeti").length'), 3);
  assert.equal(game.run('enemies.filter(e=>e.type==="SKALDRATH").length'), 1);
});

test('Arctic enemies use the approved health, attack and gold values', () => {
  const game = boot();
  assert.deepEqual(JSON.parse(game.run(`JSON.stringify(Object.fromEntries(['Penguin','Arctic Wolf','Polar Bear','Yeti','SKALDRATH'].map(type=>[type,[ENEMY_SPECS[type].hp,ENEMY_SPECS[type].atk,ENEMY_SPECS[type].gold]])))`)), {
    Penguin: [100,75,25], 'Arctic Wolf': [300,110,50], 'Polar Bear': [875,135,120], Yeti: [2250,170,300], SKALDRATH: [8750,210,1500]
  });
});

test('Arctic health scales with base attack while preserving approved minimums', () => {
  const game = boot();
  game.run('state.totalAttackPower=1000; enterBiome(1);');
  assert.equal(game.run('enemies.find(e=>e.type==="Penguin").maxHp'), 5000);
  assert.equal(game.run('enemies.find(e=>e.type==="Arctic Wolf").maxHp'), 8000);
  assert.equal(game.run('enemies.find(e=>e.type==="Polar Bear").maxHp'), 14000);
  assert.equal(game.run('enemies.find(e=>e.type==="Yeti").maxHp'), 24000);
  assert.equal(game.run('enemies.find(e=>e.type==="SKALDRATH").maxHp'), 50000);
});

test('Arctic health locks on first entry and never rescale afterward', () => {
  const game = boot();
  game.run('state.totalAttackPower=100; enterBiome(1); state.totalAttackPower=500; spawnBiomeEnemies();');
  assert.equal(game.run('state.biomeAttackScales[1]'), 100);
  assert.equal(game.run('enemies.find(e=>e.type==="Penguin").maxHp'), 500);
  game.run('enterBiome(0); enterBiome(1);');
  assert.equal(game.run('enemies.find(e=>e.type==="Penguin").maxHp'), 500);
});

test('the locked Arctic health scale persists in saved progress', () => {
  const storage = new Map(), first = boot(storage);
  first.run('state.totalAttackPower=250; enterBiome(1); state.totalAttackPower=900; saveGame();');
  const loaded = boot(storage);
  assert.equal(loaded.run('state.biomeAttackScales[1]'), 250);
  assert.equal(loaded.run('enemies.find(e=>e.type==="Penguin").maxHp'), 1250);
});

test('Arctic scaling ignores damage upgrades so progression still shortens fights', () => {
  const game = boot();
  game.run('state.totalAttackPower=500; state.upgrades.damage=5; enterBiome(1);');
  assert.equal(game.run('enemies.find(e=>e.type==="Penguin").maxHp'), 2500);
  assert.equal(game.run('playerDamage().damage'), 750);
});

test('the camera follows the player through a world wider than the canvas', () => {
  const game = boot();
  assert.ok(game.run('WORLD.width') > 800);
  game.run('player.x=2400; updatePlayer(); render();');
  assert.ok(game.run('cameraX') > 0);
  assert.ok(game.drawCalls.some(call => call.method === 'translate' && call.args[0] < 0));
});

test('regular monsters remain passive until struck', () => {
  const game = boot();
  nearEnemy(game, 'Goblin');
  const x = game.run('enemies[0].x');
  game.run('updateEnemies();');
  assert.equal(game.run('enemies[0].active'), false);
  assert.equal(game.run('enemies[0].x'), x);
  game.run('triggerAttack();');
  assert.equal(game.run('enemies[0].active'), true);
  assert.equal(game.run('enemies[0].hp'), 30);
});

test('every player attack has a one-second cooldown', () => {
  const game = boot();
  game.run('player.x=dummy.x; player.y=dummy.y; triggerAttack();');
  assert.equal(game.run('state.totalAttackPower'), 11);
  assert.equal(game.run('player.attackCooldown'), 60);
  game.run('player.swinging=false; triggerAttack();');
  assert.equal(game.run('state.totalAttackPower'), 11);
  game.run('for(let i=0;i<60;i++) updatePlayer(); triggerAttack();');
  assert.equal(game.run('state.totalAttackPower'), 12);
});

test('Arctic player has a dark silhouette, bright body, and YOU label', () => {
  const game = boot();
  game.run('enterBiome(1); render();');
  assert.ok(game.drawCalls.some(call => call.method === 'fillText' && call.args[0] === 'YOU'));
  assert.ok(game.drawCalls.some(call => call.method === 'fillRect' && call.args[0] === game.run('player.x+2') && call.args[1] === game.run('player.y-2')));
});

test('aggro persists at long range until safety or death', () => {
  const game = boot();
  nearEnemy(game, 'Goblin');
  game.run('enemies[0].active=true; player.x=3000; updateEnemies();');
  assert.equal(game.run('enemies[0].active'), true);
  assert.ok(game.run('enemies[0].x') > 950);
  game.run('player.x=100; updatePlayer();');
  assert.equal(game.run('enemies[0].active'), false);
  assert.equal(game.run('enemies[0].returning'), true);
});

test('death keeps upgrades, removes 75 percent of gold and returns to the current town', () => {
  const game = boot();
  game.run('enterBiome(1); state.gold=1000; state.upgrades.health=2; state.maxHp=150; state.hp=1; damagePlayer(createEnemy("Penguin",900,100),75);');
  assert.equal(game.run('state.biome'), 1);
  assert.equal(game.run('player.x'), 100);
  assert.equal(game.run('state.gold'), 250);
  assert.equal(game.run('state.upgrades.health'), 2);
  assert.equal(game.run('state.hp'), 150);
  assert.equal(game.run('enemies.some(e=>e.active)'), false);
});

test('entering a living boss den seals the entrance and activates the boss', () => {
  const game = boot();
  game.run('enemies[0].active=true; player.x=WORLD.bossStart-1; keys.d=true; updatePlayer(); clearInput();');
  assert.equal(game.run('state.bossLocked'), true);
  assert.equal(game.run('enemies.find(e=>e.boss).active'), true);
  assert.equal(game.run('enemies[0].active'), false);
  assert.equal(game.run('enemies[0].returning'), true);
  game.run('player.x=WORLD.bossStart-100; updatePlayer();');
  assert.equal(game.run('player.x'), game.run('WORLD.bossStart+20'));
});

test('Vorgath toll is paid once and later biome travel is free', () => {
  const game = boot();
  game.run('state.gold=800; state.bossesDefeated[0]=true; spawnBiomeEnemies(); player.x=WORLD.width; updatePlayer();');
  assert.equal(game.run('state.biome'), 1);
  assert.equal(game.run('state.gold'), 300);
  assert.equal(game.run('state.tollPaid'), true);
  game.run('retreatBiome(); player.x=WORLD.width; updatePlayer();');
  assert.equal(game.run('state.biome'), 1);
  assert.equal(game.run('state.gold'), 300);
});

test('defeated bosses remain defeated when revisiting a biome', () => {
  const game = boot();
  game.run('state.bossesDefeated[0]=true; spawnBiomeEnemies();');
  assert.equal(game.run('enemies.some(e=>e.type==="VORGATH")'), false);
  game.run('enterBiome(1); retreatBiome();');
  assert.equal(game.run('enemies.some(e=>e.type==="VORGATH")'), false);
});

test('Common and Rare chest base odds retain their exact boundaries', () => {
  const game = boot();
  const commonCases = [[0,'Common'],[52.999,'Common'],[53,'Rare'],[91.999,'Rare'],[92,'Epic'],[96.999,'Epic'],[97,'Legendary']];
  const rareCases = [[0,'Common'],[39.999,'Common'],[40,'Rare'],[84.999,'Rare'],[85,'Epic'],[94.999,'Epic'],[95,'Legendary']];
  for (const [roll, expected] of commonCases) assert.equal(game.run(`rollChestRarity('Common',${roll})`), expected);
  for (const [roll, expected] of rareCases) assert.equal(game.run(`rollChestRarity('Rare',${roll})`), expected);
});

test('Luck follows the subtle exponential curve and respects the 15 percent floor', () => {
  const game = boot();
  const reductions = JSON.parse(game.run('JSON.stringify([1,2,3,4,5].map(luckReduction))'));
  assert.ok(Math.abs(reductions[0] - .5) < .001);
  assert.ok(Math.abs(reductions[4] - 4.06) < .02);
  assert.equal(game.run('getChestOdds("Common").Common'), 53);
  game.run('state.upgrades.luck=5;');
  assert.ok(Math.abs(game.run('getChestOdds("Common").Common') - 48.94) < .02);
  assert.equal(game.run('getChestOdds("Common").Common >= 15'), true);
  assert.equal(game.run('getChestOdds("Common").Common + getChestOdds("Common").Rare + getChestOdds("Common").Epic + getChestOdds("Common").Legendary'), 100);
});

test('opening a chest adds a sword without replacing the equipped sword', () => {
  const game = boot();
  const equipped = game.run('state.equippedSwordId');
  game.run('state.gold=50; Math.random=()=>0; attemptChestPurchase(chestShops[0]);');
  assert.equal(game.run('state.inventory.length'), 2);
  assert.equal(game.run('state.equippedSwordId'), equipped);
  assert.equal(game.run('state.gold'), 0);
});

test('full inventory blocks chest payment and repeatedly opens the capacity prompt', () => {
  const game = boot();
  game.run('state.gold=1000; state.inventoryCapacity=1; attemptChestPurchase(chestShops[0]);');
  assert.equal(game.run('state.gold'), 1000);
  assert.equal(game.run('state.inventory.length'), 1);
  assert.equal(game.element('capacity-dialog').open, true);
  game.element('capacity-dialog').close();
  game.run('attemptChestPurchase(chestShops[0]);');
  assert.equal(game.element('capacity-dialog').open, true);
});

test('capacity upgrades add 25 slots first and 50 afterward while doubling price', () => {
  const game = boot();
  game.run('state.gold=10000; purchaseCapacityUpgrade();');
  assert.equal(game.run('state.inventoryCapacity'), 125);
  assert.equal(game.run('state.gold'), 9000);
  assert.equal(game.run('capacityUpgradeCost()'), 2000);
  game.run('purchaseCapacityUpgrade();');
  assert.equal(game.run('state.inventoryCapacity'), 175);
  assert.equal(game.run('state.gold'), 7000);
  assert.equal(game.run('capacityUpgradeCost()'), 4000);
});

test('five matching swords forge Divine and five Divine forge God\'s Chosen', () => {
  const game = boot();
  game.run(`state.inventory=[]; for(let i=0;i<5;i++)state.inventory.push(makeSword('Epic Claymore','Epic',25)); combineSwords('Epic Claymore',0);`);
  assert.equal(game.run('state.inventory.length'), 1);
  assert.equal(game.run('state.inventory[0].name'), 'Divine Epic Claymore');
  assert.equal(game.run('state.inventory[0].power'), 38);
  game.run(`state.inventory=[]; for(let i=0;i<5;i++)state.inventory.push(makeSword('Epic Claymore','Epic',25,1)); state.equippedSwordId=state.inventory[0].id; combineSwords('Epic Claymore',1);`);
  assert.equal(game.run('state.inventory.length'), 1);
  assert.equal(game.run('state.inventory[0].name'), "God's Chosen Epic Claymore");
  assert.equal(game.run('state.inventory[0].power'), 75);
  assert.equal(game.run('state.equippedSwordId'), game.run('state.inventory[0].id'));
});

test('Equip Best chooses the highest actual power', () => {
  const game = boot();
  game.run(`state.inventory.push(makeSword('Legendary Claymore','Legendary',75),makeSword('Rare Claymore','Rare',8,2)); equipBest();`);
  assert.equal(game.run('equippedSword().name'), 'Legendary Claymore');
  assert.equal(game.run('equippedSword().power'), 75);
});

test('the Arctic shrine offers five levels with approved costs and effects', () => {
  const game = boot();
  game.run('enterBiome(1); state.gold=10000; purchaseUpgrade("health"); purchaseUpgrade("damage"); purchaseUpgrade("speed"); purchaseUpgrade("critical"); purchaseUpgrade("luck");');
  assert.equal(game.run('state.maxHp'), 125);
  assert.equal(game.run('state.hp'), 125);
  assert.equal(game.run('state.gold'), 9000);
  assert.deepEqual(JSON.parse(game.run('JSON.stringify(state.upgrades)')), { health:1, damage:1, speed:1, critical:1, luck:1 });
  game.run('state.upgrades.health=5;');
  assert.equal(game.run('purchaseUpgrade("health")'), false);
});

test('damage multiplier and critical chance modify real combat damage', () => {
  const game = boot();
  game.run('state.totalAttackPower=100; state.upgrades.damage=2; state.upgrades.critical=5; Math.random=()=>0;');
  assert.equal(game.run('playerDamage().damage'), 240);
  game.run('Math.random=()=>.99;');
  assert.equal(game.run('playerDamage().damage'), 120);
});

test('speed upgrades affect movement without changing base speed', () => {
  const game = boot();
  game.run('player.x=1000; state.upgrades.speed=5; keys.d=true; updatePlayer();');
  assert.ok(Math.abs(game.run('player.x') - 1007.475) < .001);
  assert.equal(game.run('player.speed'), 6.5);
});

test('save data restores biome, upgrades, inventory and defeated bosses', () => {
  const storage = new Map();
  const first = boot(storage);
  first.run(`state.biome=1; state.gold=777; state.upgrades.health=3; state.maxHp=175; state.bossesDefeated[0]=true; state.inventory.push(makeSword('Rare Claymore','Rare',8)); saveGame();`);
  const second = boot(storage);
  assert.equal(second.run('state.biome'), 1);
  assert.equal(second.run('state.gold'), 777);
  assert.equal(second.run('state.upgrades.health'), 3);
  assert.equal(second.run('state.inventory.length'), 2);
  assert.equal(second.run('state.bossesDefeated[0]'), true);
});

test('Arctic Wolf flashes white then keeps red eyes during its lethal tell', () => {
  const game = boot();
  game.run(`enterBiome(1); player.x=1800; player.y=180; updateZoneFromPosition(); enemies=[createEnemy('Arctic Wolf',1880,180)]; enemies[0].active=true; updateEnemies();`);
  assert.equal(game.run('enemies[0].phase'), 'windup');
  assert.equal(game.run('enemies[0].warningFlash'), 7);
  game.drawCalls.length = 0;
  game.run('render();');
  assert.ok(game.drawCalls.some(call => call.method === 'fillRect' && call.args[2] === 4 && call.args[3] === 4));
});

test('an unupgraded Arctic Wolf one-hits, while one health upgrade survives', () => {
  const game = boot();
  game.run(`enterBiome(1); state.gold=100; const wolf=createEnemy('Arctic Wolf',1800,180); damagePlayer(wolf);`);
  assert.equal(game.run('player.x'), 100);
  assert.equal(game.run('state.gold'), 25);
  game.run(`state.upgrades.health=1; state.maxHp=125; state.hp=125; const wolf2=createEnemy('Arctic Wolf',1800,180); damagePlayer(wolf2);`);
  assert.equal(game.run('state.hp'), 15);
});

test('Yeti launches snowballs and Skaldrath launches a three-shard volley', () => {
  const game = boot();
  game.run(`enterBiome(1); player.x=3700; player.y=180; updateZoneFromPosition(); const yeti=createEnemy('Yeti',3800,180); yeti.attackAngle=Math.PI; launchProjectile(yeti);`);
  assert.equal(game.run('projectiles.length'), 1);
  game.run(`projectiles=[]; const boss=createEnemy('SKALDRATH',4800,180,true); boss.attackAngle=Math.PI; [-.18,0,.18].forEach(s=>launchProjectile(boss,s));`);
  assert.equal(game.run('projectiles.length'), 3);
});

test('boss attack patterns become more dangerous as health falls', () => {
  const game = boot();
  game.run(`enterBiome(1); enemies=[createEnemy('SKALDRATH',4800,180,true)]; enemies[0].hp=enemies[0].maxHp;`);
  assert.equal(game.run('chooseAttack(enemies[0])'), 'shards');
  game.run('enemies[0].hp=enemies[0].maxHp*.5; enemies[0].attackCount=1;');
  assert.equal(game.run('chooseAttack(enemies[0])'), 'frostNova');
  game.run('enemies[0].hp=enemies[0].maxHp*.2; enemies[0].attackCount=0;');
  assert.equal(game.run('chooseAttack(enemies[0])'), 'frostNova');
  assert.equal(game.run('chooseAttack(enemies[0])'), 'shards');
});

test('Skaldrath victory opens the final dialog and freezes combat', () => {
  const game = boot();
  game.run('enterBiome(1); state.bossesDefeated[1]=true; spawnBiomeEnemies(); player.x=WORLD.width; updatePlayer();');
  assert.equal(game.run('state.won'), true);
  assert.equal(game.element('victory-dialog').open, true);
  const x = game.run('player.x');
  game.run('keys.a=true; updatePlayer();');
  assert.equal(game.run('player.x'), x);
});

test('restart clears the save and returns every progression system to defaults', () => {
  const game = boot();
  game.run('state.gold=999; state.biome=1; state.upgrades.health=5; state.inventoryCapacity=175; saveGame(); restartGame();');
  assert.equal(game.run('state.gold'), 0);
  assert.equal(game.run('state.biome'), 0);
  assert.equal(game.run('state.upgrades.health'), 0);
  assert.equal(game.run('state.inventory.length'), 1);
  assert.equal(game.run('state.inventoryCapacity'), 100);
  assert.equal(game.storage.size, 0);
});

test('input supports dodge, inventory, interaction, and safe page scrolling behavior', () => {
  const game = boot();
  let prevented = false;
  game.windowListeners.keydown({ key:'ArrowDown', repeat:false, preventDefault(){ prevented = true; } });
  assert.equal(prevented, true);
  game.windowListeners.keydown({ key:'Shift', repeat:false });
  assert.equal(game.run('player.dodgeTimer'), 12);
  game.windowListeners.keydown({ key:'i', repeat:false });
  assert.equal(game.element('inventory-dialog').open, true);
});
