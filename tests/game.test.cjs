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
      focus() { this.focused = true; }
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
    enemies.forEach(enemy => { enemy.x = 100; enemy.y = 200; enemy.atk = 100; enemy.attackTimer = 81; });
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
  assert.equal(snapshots[0].hp, 95);
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
