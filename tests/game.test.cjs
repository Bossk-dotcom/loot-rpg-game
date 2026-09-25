const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

// Run the real game logic with a minimal DOM; no browser or packages required.
function boot() {
  const elements = new Map();
  const windowListeners = {};
  const documentListeners = {};
  const drawing = new Proxy({}, { get: () => () => {} });
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      style: {}, textContent: '', open: false, listeners: {},
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
  const document = {
    hidden: false,
    getElementById: element,
    addEventListener(name, handler) { documentListeners[name] = handler; }
  };
  const context = vm.createContext({
    document,
    window: { addEventListener(name, handler) { windowListeners[name] = handler; } },
    requestAnimationFrame: () => {}
  });
  vm.runInContext(source, context);
  return {
    run: code => vm.runInContext(code, context),
    element, document, windowListeners, documentListeners
  };
}

function atBoss(game, gold = 500, defeated = false) {
  game.run(`state.zone = 5; state.gold = ${gold}; spawnZoneEnemies(); player.x = 780;`);
  if (defeated) game.run('enemies[0].hp = 0;');
}

test('final gate cannot be bought past a living boss', () => {
  const game = boot();
  atBoss(game, 1000);
  game.run('updatePlayer();');
  assert.equal(game.run('state.zone'), 5);
  assert.equal(game.run('state.gold'), 1000);
  assert.equal(game.run('state.won'), false);
  assert.match(game.element('status-banner').textContent, /Defeat the boss/);
});

test('insufficient toll keeps a defeated-boss run playable', () => {
  const game = boot();
  atBoss(game, 499, true);
  game.run('updatePlayer();');
  assert.equal(game.run('state.zone'), 5);
  assert.equal(game.run('state.gold'), 499);
  assert.equal(game.run('state.won'), false);
  assert.match(game.element('status-banner').textContent, /500/);
});

test('exact toll wins once without spawning undefined zone 6', () => {
  const game = boot();
  atBoss(game, 500, true);
  game.run('updatePlayer(); updatePlayer(); completeAdventure();');
  assert.equal(game.run('state.zone'), 5);
  assert.equal(game.run('state.gold'), 0);
  assert.equal(game.run('state.won'), true);
  assert.equal(game.element('victory-dialog').open, true);
  assert.match(game.element('victory-summary').textContent, /0 gold/);
});

test('full route, actual boss kill, reward, toll and restart work together', () => {
  const game = boot();
  for (let zone = 1; zone <= 5; zone++) {
    game.run('player.x = 780; updatePlayer();');
    assert.equal(game.run('state.zone'), zone);
    assert.ok(game.run('enemies.length') > 0);
  }
  // A deterministic endgame build avoids minutes of training in this smoke test.
  game.run('state.totalAttackPower = 3500; player.x = 500; player.y = 100; triggerAttack();');
  assert.equal(game.run('enemies[0].hp'), 0);
  assert.equal(game.run('state.gold'), 1000);
  assert.match(game.element('objective-text').textContent, /Boss defeated/);
  game.run('player.x = 780; updatePlayer();');
  assert.equal(game.run('state.won'), true);
  assert.equal(game.run('state.gold'), 500);
  game.element('restart-button').listeners.click();
  assert.equal(game.run('state.zone'), 0);
  assert.equal(game.run('state.gold'), 0);
  assert.equal(game.run('state.hp'), 100);
  assert.equal(game.run('state.totalAttackPower'), 10);
  assert.equal(game.run('state.equippedSword.power'), 1);
  assert.equal(game.run('state.tollCost'), 500);
  assert.equal(game.run('state.won'), false);
  assert.equal(game.run('enemies.length'), 0);
  assert.equal(game.run('player.x'), 100);
  assert.equal(game.run('player.swinging'), false);
  assert.equal(game.element('victory-dialog').open, false);
  assert.equal(game.element('gameCanvas').focused, true);
  game.run('triggerAttack();');
  assert.equal(game.run('state.totalAttackPower'), 11);
});

test('victory freezes movement, damage and attacks', () => {
  const game = boot();
  atBoss(game, 500, true);
  game.run('updatePlayer();');
  const x = game.run('player.x');
  game.run('keys.d = true; enemies[0].hp = 3500; enemies[0].attackTimer = 100; enemies[0].x = player.x; enemies[0].y = player.y; updatePlayer(); updateEnemies(); triggerAttack();');
  assert.equal(game.run('player.x'), x);
  assert.equal(game.run('state.hp'), 100);
  assert.equal(game.run('enemies[0].hp'), 3500);
  assert.equal(game.run('player.swinging'), false);
});

test('death stops the old enemy wave and applies its penalty only once', () => {
  const game = boot();
  game.run(`state.zone = 1; state.gold = 100; state.hp = 1; spawnZoneEnemies();
    enemies.forEach(enemy => { enemy.x = 100; enemy.y = 200; enemy.atk = 100;
      enemy.phase = 'windup'; enemy.phaseTimer = 1; enemy.attackOrigin = center(enemy); enemy.attackAngle = 0; });
    keys.d = true; updateEnemies();`);
  assert.equal(game.run('state.zone'), 0);
  assert.equal(game.run('state.hp'), 100);
  assert.equal(game.run('state.gold'), 25);
  assert.equal(game.run('enemies.length'), 0);
  assert.equal(game.run('Object.keys(keys).length'), 0);
});

test('backtracking to town and farming encounters still work', () => {
  const game = boot();
  game.run('player.x = 780; updatePlayer(); enemies[0].hp = 0; player.x = 0; updatePlayer();');
  assert.equal(game.run('state.zone'), 0);
  assert.equal(game.run('enemies.length'), 0);
  game.run('player.x = 780; updatePlayer();');
  assert.equal(game.run('enemies.length'), 15);
  assert.equal(game.run('enemies[0].hp'), 40);
});

for (const fps of [30, 60, 144]) {
  test(`movement covers the same distance at ${fps} Hz`, () => {
    const game = boot();
    game.run('keys.d = true; loop(0);');
    for (let frame = 1; frame <= fps; frame++) game.run(`loop(${frame * 1000 / fps});`);
    assert.equal(game.run('player.x'), 490);
  });
}

test('held-space training and enemy timers agree across refresh rates', () => {
  const snapshots = [30, 60, 144].map(fps => {
    const game = boot();
    game.run('keys[" "] = true; loop(0);');
    for (let frame = 1; frame <= fps * 2; frame++) game.run(`loop(${frame * 1000 / fps});`);
    const attack = game.run('state.totalAttackPower');
    game.run('clearInput(); state.zone = 1; spawnZoneEnemies(); enemies = enemies.slice(0, 1); enemies[0].attackTimer = 0; player.x = enemies[0].x; player.y = enemies[0].y;');
    for (let frame = fps * 2 + 1; frame <= fps * 4; frame++) game.run(`loop(${frame * 1000 / fps});`);
    return { attack, hp: game.run('state.hp') };
  });
  assert.deepEqual(snapshots[0], snapshots[1]);
  assert.deepEqual(snapshots[1], snapshots[2]);
  assert.equal(snapshots[0].hp, 90);
});

test('blur clears held controls and discards elapsed background time', () => {
  const game = boot();
  game.run('keys.d = true; loop(0);');
  game.windowListeners.blur();
  game.run('loop(60000);');
  assert.equal(game.run('player.x'), 100);
  assert.equal(game.run('Object.keys(keys).length'), 0);
  game.document.hidden = true;
  game.run('keys.d = true; loop(70000);');
  assert.equal(game.run('player.x'), 100);
  game.documentListeners.visibilitychange();
  assert.equal(game.run('Object.keys(keys).length'), 0);
});

test('long frame stalls cannot produce unbounded catch-up movement', () => {
  const game = boot();
  game.run('keys.d = true; loop(0); loop(60000);');
  assert.equal(game.run('player.x'), 139);
});

test('only left mouse attacks and arrow keys suppress page scrolling', () => {
  const game = boot();
  game.element('gameCanvas').listeners.mousedown({ button: 2 });
  assert.equal(game.run('state.totalAttackPower'), 10);
  game.element('gameCanvas').listeners.mousedown({ button: 0 });
  assert.equal(game.run('state.totalAttackPower'), 11);
  let prevented = false;
  game.windowListeners.keydown({ key: 'ArrowDown', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
});

function goblinEncounter(game) {
  game.run(`state.zone = 1; spawnZoneEnemies(); enemies = enemies.slice(0, 1);
    enemies[0].x = 250; enemies[0].y = 180; enemies[0].homeX = 250; enemies[0].homeY = 180;
    player.x = 200; player.y = 180; player.facing = 'right';`);
}

for (const [facing, dx, dy] of [['right', 50, 0], ['left', -50, 0], ['up', 0, -50], ['down', 0, 50]]) {
  test(`a ${facing} swing hits in front but not behind`, () => {
    const game = boot();
    goblinEncounter(game);
    game.run(`player.facing = '${facing}';
      enemies[0].x = player.x + ${dx}; enemies[0].y = player.y + ${dy};
      enemies.push({...enemies[0], x: player.x - ${dx}, y: player.y - ${dy}});
      triggerAttack();`);
    assert.equal(game.run('enemies[0].hp'), 30);
    assert.equal(game.run('enemies[1].hp'), 40);
  });
}

test('sword reach respects the visible arc and target edges', () => {
  const game = boot();
  goblinEncounter(game);
  assert.equal(game.run('inAttackArc({x:0,y:0}, 0, 62, Math.PI/3, {x:70,y:-5,size:10})'), false);
  assert.equal(game.run('inAttackArc({x:0,y:0}, 0, 62, Math.PI/3, {x:60,y:-5,size:10})'), true);
  assert.equal(game.run('inAttackArc({x:0,y:0}, 0, 62, Math.PI/3, {x:-35,y:-5,size:10})'), false);
});

test('one swing grants a kill reward once and leaves bounded feedback', () => {
  const game = boot();
  goblinEncounter(game);
  game.run('enemies[0].hp = 10; triggerAttack(); triggerAttack(); player.swinging = false; triggerAttack();');
  assert.equal(game.run('state.gold'), 15);
  assert.equal(game.run('enemies[0].hp'), 0);
  assert.ok(game.run('effects.some(effect => effect.text === "+15 gold")'));
  game.run('for(let i=0;i<500;i++) addEffect(0,0,"1","white");');
  assert.ok(game.run('effects.length') <= 100);
  game.run('for(let i=0;i<60;i++) updateEffects();');
  assert.equal(game.run('effects.length'), 0);
});

test('nearby goblins pursue; distant goblins stay home', () => {
  const game = boot();
  goblinEncounter(game);
  game.run('player.x = 100; updateEnemies();');
  assert.ok(game.run('enemies[0].x') < 250);
  const distant = boot();
  goblinEncounter(distant);
  distant.run('player.x = 10; updateEnemies();');
  assert.equal(distant.run('enemies[0].x'), 250);
  assert.equal(distant.run('enemies[0].active'), false);
});

test('no more than three goblins can pursue at once', () => {
  const game = boot();
  game.run('state.zone = 1; spawnZoneEnemies(); player.x = 450; player.y = 180; updateEnemies();');
  assert.equal(game.run('enemies.filter(enemy => enemy.active).length'), 3);
});

test('pursuers give up at their leash and return home without healing', () => {
  const game = boot();
  goblinEncounter(game);
  game.run('enemies[0].active = true; enemies[0].hp = 20; enemies[0].x = 500; player.x = 540; updateEnemies();');
  assert.equal(game.run('enemies[0].active'), false);
  assert.equal(game.run('enemies[0].returning'), true);
  game.run('player.x = 10; for(let i=0;i<130;i++) updateEnemies();');
  assert.ok(Math.abs(game.run('enemies[0].x') - 250) < 3);
  assert.equal(game.run('enemies[0].returning'), false);
  assert.equal(game.run('enemies[0].hp'), 20);
});

test('windup gives a full warning, commits direction, and can be sidestepped', () => {
  const game = boot();
  goblinEncounter(game);
  game.run('updateEnemies();');
  assert.equal(game.run('enemies[0].phase'), 'windup');
  const angle = game.run('enemies[0].attackAngle');
  game.run('for(let i=0;i<32;i++) updateEnemies();');
  assert.equal(game.run('state.hp'), 100);
  game.run('player.x = 310; updateEnemies();');
  assert.equal(game.run('enemies[0].phase'), 'strike');
  assert.equal(game.run('enemies[0].attackAngle'), angle);
  assert.equal(game.run('state.hp'), 100);
});

test('standing in a committed attack takes one hit followed by recovery', () => {
  const game = boot();
  goblinEncounter(game);
  game.run('for(let i=0;i<34;i++) updateEnemies();');
  assert.equal(game.run('state.hp'), 95);
  game.run('for(let i=0;i<8;i++) updateEnemies();');
  assert.equal(game.run('state.hp'), 95);
  assert.equal(game.run('enemies[0].phase'), 'recovery');
});

test('hits flash and knock back an idle goblin but do not move a committed tell', () => {
  const game = boot();
  goblinEncounter(game);
  game.run('triggerAttack();');
  assert.ok(game.run('enemies[0].x') > 250);
  assert.ok(game.run('enemies[0].hitFlash') > 0);
  const committed = boot();
  goblinEncounter(committed);
  committed.run('updateEnemies(); triggerAttack();');
  assert.equal(committed.run('enemies[0].phase'), 'windup');
  assert.equal(committed.run('enemies[0].x'), 250);
  assert.equal(committed.run('enemies[0].attackOrigin.x'), 262);
});

test('dodge follows movement and locks direction, with a normalized diagonal', () => {
  const game = boot();
  game.run('player.x = 300; player.y = 200; keys.d = true; keys.w = true; triggerDodge(); clearInput(); keys.a = true; updatePlayer();');
  const dx = game.run('player.x') - 300, dy = game.run('player.y') - 200;
  assert.ok(dx > 0 && dy < 0);
  assert.ok(Math.abs(Math.hypot(dx, dy) - 13) < 1e-9);
});

test('stationary dodge follows facing and cannot repeat until its cooldown ends', () => {
  const game = boot();
  game.run('player.x = 300; player.facing = "left"; triggerDodge(); for(let i=0;i<12;i++) updatePlayer(); triggerDodge();');
  assert.equal(game.run('player.x'), 144);
  assert.equal(game.run('player.dodgeTimer'), 0);
  game.run('for(let i=0;i<60;i++) updatePlayer(); triggerDodge();');
  assert.equal(game.run('player.dodgeTimer'), 12);
});

test('dodge cancels a swing, blocks attacks and avoids damage during its window', () => {
  const game = boot();
  goblinEncounter(game);
  game.run('updateEnemies(); triggerAttack(); triggerDodge(); triggerAttack(); enemies[0].phaseTimer = 1; updateEnemies();');
  assert.equal(game.run('player.swinging'), false);
  assert.equal(game.run('enemies[0].hp'), 30);
  assert.equal(game.run('state.hp'), 100);
  assert.ok(game.run('effects.some(effect => effect.text === "DODGED")'));
});

test('dodging too early does not protect against a later hit', () => {
  const game = boot();
  goblinEncounter(game);
  game.run('updateEnemies(); triggerDodge(); player.dodgeX=0; player.dodgeY=0; for(let i=0;i<12;i++) updatePlayer(); enemies[0].phaseTimer=1; updateEnemies();');
  assert.equal(game.run('state.hp'), 95);
});

test('simultaneous goblin hits get a short grace window instead of stacking', () => {
  const game = boot();
  goblinEncounter(game);
  game.run('enemies.push({...enemies[0]}); for(let i=0;i<34;i++) updateEnemies();');
  assert.equal(game.run('state.hp'), 95);
});

test('dodge also protects against later enemies without changing their AI', () => {
  const game = boot();
  game.run('state.zone=2; spawnZoneEnemies(); enemies=enemies.slice(0,1); player.x=enemies[0].x; player.y=enemies[0].y; enemies[0].attackTimer=81; triggerDodge(); updateEnemies();');
  assert.equal(game.run('state.hp'), 100);
});

test('zone changes and restart clear transient combat, retaining a travel cooldown', () => {
  const game = boot();
  game.run('player.x=770; triggerDodge(); updatePlayer();');
  assert.equal(game.run('state.zone'), 1);
  assert.equal(game.run('player.dodgeTimer'), 0);
  assert.ok(game.run('player.dodgeCooldown') > 0);
  assert.equal(game.run('effects.length'), 0);
  game.run('restartGame();');
  assert.equal(game.run('player.dodgeCooldown'), 0);
  assert.equal(game.run('player.invulnerableTimer'), 0);
});

test('Shift input starts one dodge and native repeat cannot queue another', () => {
  const game = boot();
  game.windowListeners.keydown({key:'Shift', repeat:false});
  assert.equal(game.run('player.dodgeTimer'), 12);
  game.run('player.dodgeTimer=0; player.dodgeCooldown=0;');
  game.windowListeners.keydown({key:'Shift', repeat:true});
  assert.equal(game.run('player.dodgeTimer'), 0);
});

test('muting sound and unavailable audio do not break combat or capture button keys', () => {
  const game = boot();
  game.element('sound-button').listeners.click();
  assert.equal(game.element('sound-button').textContent, 'Sound: Off');
  assert.equal(game.element('sound-button')['aria-pressed'], 'true');
  game.windowListeners.keydown({key:' ', target:{tagName:'BUTTON'}});
  assert.equal(game.run('player.swinging'), false);
  game.element('sound-button').listeners.click();
  game.run('triggerAttack();');
  assert.equal(game.run('state.totalAttackPower'), 11);
});

test('dodge and a moving goblin encounter remain consistent across frame rates', () => {
  const outcomes = [30,60,144].map(fps => {
    const game = boot();
    goblinEncounter(game);
    game.run('player.x=150; triggerDodge(); loop(0);');
    for(let frame=1;frame<=fps*2;frame++) game.run(`loop(${frame*1000/fps});`);
    return game.run('JSON.stringify({hp:state.hp,x:player.x,enemyX:enemies[0].x,phase:enemies[0].phase,cooldown:player.dodgeCooldown})');
  });
  assert.equal(outcomes[0], outcomes[1]);
  assert.equal(outcomes[1], outcomes[2]);
});
