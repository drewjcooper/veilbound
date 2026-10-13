import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  UNIT_TYPES,
  chooseBattleAction,
  createInitialGame,
  getCombatBonus,
  getLegalMoves,
  getPhase,
  getUnitAt,
  hasLegalMove,
  moveUnit,
  passTurn,
} from "../game.js";

function makeUnit(id, type, side, row, col, overrides = {}) {
  const stats = UNIT_TYPES[type];
  return {
    id, type, side, row, col, hp: stats.maxHp, maxHp: stats.maxHp,
    might: stats.might, charged: false, ...overrides,
  };
}

function makeState(units, overrides = {}) {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  const byId = {};
  for (const unit of units) {
    board[unit.row][unit.col] = unit.id;
    byId[unit.id] = unit;
  }
  return {
    board,
    units: byId,
    currentSide: "ember",
    moves: 0,
    winner: null,
    battle: null,
    ...overrides,
  };
}

function makeBattle(attackerType = "vanguard", defenderType = "vanguard", defenderHp) {
  const attacker = makeUnit("attacker", attackerType, "ember", 4, 3);
  const defender = makeUnit("defender", defenderType, "gloom", 4, 4, defenderHp === undefined ? {} : { hp: defenderHp });
  return makeState([attacker, defender], {
    battle: { attackerId: attacker.id, defenderId: defender.id, attackerAction: null, round: 1, choosing: "attacker" },
  });
}

test("starts with two mirrored forces and Ember in the Sunward phase", () => {
  const game = createInitialGame();
  assert.equal(Object.keys(game.units).length, 12);
  assert.equal(game.currentSide, "ember");
  assert.equal(game.units["ember-crown-7-3"].row, 7);
  assert.equal(game.units["gloom-crown-0-3"].row, 0);
  assert.equal(getPhase(game).id, "sun");
});

test("phase influence rotates after each pair of moves", () => {
  const game = createInitialGame();
  assert.equal(getCombatBonus(game, "ember"), 1);
  assert.equal(getCombatBonus(game, "gloom"), 0);
  assert.equal(getPhase({ ...game, moves: 2 }).id, "moon");
  assert.equal(getCombatBonus({ ...game, moves: 2 }, "gloom"), 1);
  assert.equal(getPhase({ ...game, moves: 4 }).id, "eclipse");
  assert.equal(getCombatBonus({ ...game, moves: 4 }, "ember"), 1);
  assert.equal(getPhase({ ...game, moves: 6 }).id, "sun");
});

test("sliding units stop at allies and may challenge the first enemy", () => {
  const game = makeState([
    makeUnit("bulwark", "bulwark", "ember", 4, 4),
    makeUnit("ally", "vanguard", "ember", 4, 5),
    makeUnit("enemy", "crown", "gloom", 2, 4),
  ]);
  const moves = getLegalMoves(game, "bulwark");
  assert.deepEqual(moves, [
    { row: 5, col: 4 }, { row: 6, col: 4 },
    { row: 3, col: 4 }, { row: 2, col: 4 },
    { row: 4, col: 3 }, { row: 4, col: 2 },
  ]);
});

test("riders leap over pieces while vanguards move forward and capture diagonally", () => {
  const game = makeState([
    makeUnit("rider", "rider", "ember", 5, 5),
    makeUnit("blocker", "bulwark", "ember", 4, 5),
    makeUnit("vanguard", "vanguard", "ember", 6, 2),
    makeUnit("target", "crown", "gloom", 5, 3),
  ]);
  assert.ok(getLegalMoves(game, "rider").some(({ row, col }) => row === 3 && col === 4));
  assert.ok(getLegalMoves(game, "vanguard").some(({ row, col }) => row === 5 && col === 3));
  assert.ok(!getLegalMoves(game, "vanguard").some(({ row, col }) => row === 5 && col === 1));
});

test("a quiet move advances the turn and illegal moves are rejected", () => {
  const game = createInitialGame();
  const vanguardId = "ember-vanguard-6-3";
  assert.throws(() => moveUnit(game, vanguardId, 6, 4), /not a legal move/);
  const next = moveUnit(game, vanguardId, 5, 3);
  assert.equal(next.currentSide, "gloom");
  assert.equal(next.moves, 1);
  assert.equal(getUnitAt(next, 5, 3).id, vanguardId);
  assert.equal(getUnitAt(next, 6, 3), null);
});

test("a legal enemy move begins a challenge without advancing the turn", () => {
  const game = makeState([
    makeUnit("attacker", "crown", "ember", 4, 3),
    makeUnit("defender", "vanguard", "gloom", 3, 3),
  ]);
  const next = moveUnit(game, "attacker", 3, 3);
  assert.equal(next.currentSide, "ember");
  assert.equal(next.moves, 0);
  assert.equal(next.battle.defenderId, "defender");
});

test("a hidden attacker choice passes to the defender before resolving", () => {
  const game = makeBattle("crown", "crown");
  const waiting = chooseBattleAction(game, "strike");
  assert.equal(waiting.battle.choosing, "defender");
  assert.equal(waiting.battle.attackerAction, "strike");
  assert.equal(waiting.units.defender.hp, game.units.defender.hp);
  assert.throws(() => chooseBattleAction(waiting, "retreat"), /Choose strike/);

  const next = chooseBattleAction(waiting, "focus");
  assert.equal(next.units.defender.hp, 3);
  assert.equal(next.battle.round, 2);
  assert.equal(next.battle.choosing, "attacker");
});

test("guard reduces a strike and counters for one point", () => {
  const game = makeBattle();
  const next = chooseBattleAction(chooseBattleAction(game, "strike"), "guard");
  assert.equal(next.units.attacker.hp, 4);
  assert.equal(next.units.defender.hp, 3);
});

test("a defeated defender is removed and the victor captures the square", () => {
  const game = makeBattle("oracle", "vanguard", 4);
  const next = chooseBattleAction(chooseBattleAction(game, "strike"), "focus");
  assert.equal(next.battle, null);
  assert.equal(next.currentSide, "gloom");
  assert.equal(next.moves, 1);
  assert.equal(next.units.defender, undefined);
  assert.equal(getUnitAt(next, 4, 4).id, "attacker");
  assert.equal(getUnitAt(next, 4, 3), null);
});

test("losing a Crown ends the game immediately", () => {
  const game = makeBattle("oracle", "crown", 1);
  const next = chooseBattleAction(chooseBattleAction(game, "strike"), "guard");
  assert.equal(next.winner, "ember");
  assert.equal(next.units.defender, undefined);
  assert.equal(getUnitAt(next, 4, 4).id, "attacker");
});

test("a side can pass only when it has no legal moves", () => {
  const blockedUnits = Array.from({ length: BOARD_SIZE ** 2 }, (_, index) =>
    makeUnit(`blocked-${index}`, "vanguard", "ember", Math.floor(index / BOARD_SIZE), index % BOARD_SIZE));
  const game = makeState(blockedUnits);
  assert.equal(hasLegalMove(game), false);
  const next = passTurn(game);
  assert.equal(next.currentSide, "gloom");
  assert.equal(next.moves, 1);
  assert.throws(() => passTurn(createInitialGame()), /only pass/);
});
