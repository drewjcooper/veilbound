export const BOARD_SIZE = 8;
export const SIDES = ["ember", "gloom"];

export const SIDE_INFO = {
  ember: { name: "The Ember Court", shortName: "Ember", direction: -1 },
  gloom: { name: "The Gloam Host", shortName: "Gloam", direction: 1 },
};

export const PHASES = [
  { id: "sun", name: "Sunward", detail: "Ember strikes burn brighter.", bonusSide: "ember" },
  { id: "moon", name: "Moonward", detail: "Gloam strikes draw strength.", bonusSide: "gloom" },
  { id: "eclipse", name: "Eclipse", detail: "Both forces strike with equal fury.", bonusSide: null },
];

export const UNIT_TYPES = {
  crown: { name: "Crown", sigil: "✦", maxHp: 7, might: 2, movement: "crown" },
  bulwark: { name: "Bulwark", sigil: "⬟", maxHp: 8, might: 2, movement: "bulwark" },
  oracle: { name: "Oracle", sigil: "◈", maxHp: 5, might: 3, movement: "oracle" },
  rider: { name: "Rider", sigil: "➶", maxHp: 6, might: 3, movement: "rider" },
  vanguard: { name: "Vanguard", sigil: "◇", maxHp: 5, might: 3, movement: "vanguard" },
};

function makeUnit(id, type, side, row, col) {
  const stats = UNIT_TYPES[type];
  return {
    id, type, side, row, col, hp: stats.maxHp, maxHp: stats.maxHp,
    might: stats.might, charged: false,
  };
}

export function createInitialGame() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  const units = {};
  const placements = [
    ["bulwark", 0, 0], ["oracle", 0, 2], ["crown", 0, 3],
    ["rider", 0, 5], ["vanguard", 0, 7], ["vanguard", 1, 3],
  ];

  for (const side of SIDES) {
    for (const [type, baseRow, col] of placements) {
      const row = side === "ember" ? BOARD_SIZE - 1 - baseRow : baseRow;
      const id = `${side}-${type}-${row}-${col}`;
      const unit = makeUnit(id, type, side, row, col);
      units[id] = unit;
      board[row][col] = id;
    }
  }

  return {
    board,
    units,
    currentSide: "ember",
    moves: 0,
    winner: null,
    battle: null,
  };
}

export function getPhase(state) {
  return PHASES[Math.floor(state.moves / 2) % PHASES.length];
}

export function getUnitAt(state, row, col) {
  const id = state.board[row]?.[col];
  return id ? state.units[id] ?? null : null;
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function rayMoves(state, unit, directions, distance) {
  const moves = [];
  for (const [dr, dc] of directions) {
    for (let step = 1; step <= distance; step += 1) {
      const row = unit.row + dr * step;
      const col = unit.col + dc * step;
      if (!inBounds(row, col)) break;
      const occupant = getUnitAt(state, row, col);
      if (occupant?.side === unit.side) break;
      moves.push({ row, col });
      if (occupant) break;
    }
  }
  return moves;
}

export function getLegalMoves(state, unitId) {
  const unit = state.units[unitId];
  if (!unit || unit.side !== state.currentSide || state.winner || state.battle) return [];
  const cardinal = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const allDirections = [...cardinal, ...diagonal];

  if (unit.type === "bulwark") return rayMoves(state, unit, cardinal, 2);
  if (unit.type === "oracle") return rayMoves(state, unit, diagonal, 3);
  if (unit.type === "rider") {
    const leaps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    return leaps
      .map(([dr, dc]) => ({ row: unit.row + dr, col: unit.col + dc }))
      .filter(({ row, col }) => inBounds(row, col) && getUnitAt(state, row, col)?.side !== unit.side);
  }
  if (unit.type === "vanguard") {
    const direction = SIDE_INFO[unit.side].direction;
    const moves = [];
    for (let step = 1; step <= 2; step += 1) {
      const row = unit.row + direction * step;
      if (!inBounds(row, unit.col) || getUnitAt(state, row, unit.col)) break;
      moves.push({ row, col: unit.col });
    }
    for (const dc of [-1, 1]) {
      const row = unit.row + direction;
      const col = unit.col + dc;
      if (inBounds(row, col) && getUnitAt(state, row, col)?.side === (unit.side === "ember" ? "gloom" : "ember")) {
        moves.push({ row, col });
      }
    }
    return moves;
  }

  return allDirections
    .map(([dr, dc]) => ({ row: unit.row + dr, col: unit.col + dc }))
    .filter(({ row, col }) => inBounds(row, col) && getUnitAt(state, row, col)?.side !== unit.side);
}

function advanceTurn(state) {
  return {
    ...state,
    currentSide: state.currentSide === "ember" ? "gloom" : "ember",
    moves: state.moves + 1,
    battle: null,
  };
}

export function moveUnit(state, unitId, row, col) {
  if (state.winner || state.battle) throw new Error("A move cannot be made right now.");
  if (!getLegalMoves(state, unitId).some((move) => move.row === row && move.col === col)) {
    throw new Error("That square is not a legal move.");
  }
  const unit = state.units[unitId];
  const target = getUnitAt(state, row, col);
  if (target) {
    return {
      ...state,
      battle: { attackerId: unitId, defenderId: target.id, attackerAction: null, round: 1, choosing: "attacker" },
    };
  }

  const board = state.board.map((line) => [...line]);
  board[unit.row][unit.col] = null;
  board[row][col] = unitId;
  return advanceTurn({
    ...state,
    board,
    units: { ...state.units, [unitId]: { ...unit, row, col } },
  });
}

export function passTurn(state) {
  if (state.winner || state.battle) throw new Error("A move cannot be made right now.");
  const canMove = Object.keys(state.units).some((id) => getLegalMoves(state, id).length > 0);
  if (canMove) throw new Error("You can only pass when no units can move.");
  return advanceTurn(state);
}

export function getCombatBonus(state, side) {
  const phase = getPhase(state);
  return phase.bonusSide === null || phase.bonusSide === side ? 1 : 0;
}

export function resolveBattleRound(state, attackerAction, defenderAction) {
  if (!state.battle) throw new Error("There is no active battle.");
  const actions = [attackerAction, defenderAction];
  if (actions.some((action) => !["strike", "guard", "focus"].includes(action))) {
    throw new Error("Choose strike, guard, or focus.");
  }

  const battle = state.battle;
  const attacker = state.units[battle.attackerId];
  const defender = state.units[battle.defenderId];
  const units = { ...state.units };
  const fighters = [
    { unit: attacker, action: attackerAction, opponentAction: defenderAction },
    { unit: defender, action: defenderAction, opponentAction: attackerAction },
  ];
  const incoming = [0, 0];
  const healing = [0, 0];

  for (let index = 0; index < fighters.length; index += 1) {
    const { unit, action, opponentAction } = fighters[index];
    const opponentIndex = 1 - index;
    if (action === "strike") {
      let hit = unit.might + getCombatBonus(state, unit.side) + (unit.charged ? 1 : 0);
      if (opponentAction === "focus") hit += 1;
      if (opponentAction === "guard") {
        hit = Math.max(0, hit - 2);
        incoming[index] += 1;
      }
      incoming[opponentIndex] += hit;
    } else if (opponentAction !== "strike") {
      healing[index] = 1;
    }
  }

  for (let index = 0; index < fighters.length; index += 1) {
    const { unit, action, opponentAction } = fighters[index];
    units[unit.id] = {
      ...unit,
      hp: Math.max(0, Math.min(unit.maxHp, unit.hp + healing[index] - incoming[index])),
      charged: action === "focus" && opponentAction !== "strike",
    };
  }

  const attackerAfter = units[attacker.id];
  const defenderAfter = units[defender.id];
  if (attackerAfter.hp === 0 || defenderAfter.hp === 0) {
    const board = state.board.map((line) => [...line]);
    const winnerId = attackerAfter.hp > 0 ? attacker.id : defenderAfter.hp > 0 ? defender.id : null;
    if (attackerAfter.hp === 0) delete units[attacker.id];
    if (defenderAfter.hp === 0) delete units[defender.id];

    if (!winnerId) {
      board[attacker.row][attacker.col] = null;
      board[defender.row][defender.col] = null;
    } else if (winnerId === attacker.id) {
      board[attacker.row][attacker.col] = null;
      board[defender.row][defender.col] = attacker.id;
      units[attacker.id] = { ...attackerAfter, row: defender.row, col: defender.col };
    } else {
      board[defender.row][defender.col] = defender.id;
    }

    const crownFell = [attackerAfter, defenderAfter].some((unit) => unit.type === "crown" && unit.hp === 0);
    const winnerSide = crownFell
      ? ([attackerAfter, defenderAfter].find((unit) => unit.type === "crown" && unit.hp === 0)?.side === "ember" ? "gloom" : "ember")
      : null;
    const nextState = {
      ...state,
      board,
      units,
      winner: winnerSide,
      battle: null,
    };
    return winnerSide ? nextState : advanceTurn(nextState);
  }

  return {
    ...state,
    units,
    battle: { ...battle, attackerAction: null, round: battle.round + 1, choosing: "attacker" },
  };
}

export function chooseBattleAction(state, action) {
  if (!state.battle) throw new Error("There is no active battle.");
  if (!["strike", "guard", "focus"].includes(action)) throw new Error("Choose strike, guard, or focus.");
  if (state.battle.choosing === "attacker") {
    return {
      ...state,
      battle: { ...state.battle, attackerAction: action, choosing: "defender" },
    };
  }
  return resolveBattleRound(state, state.battle.attackerAction, action);
}

export function hasLegalMove(state, side = state.currentSide) {
  return Object.values(state.units).some((unit) => unit.side === side && getLegalMoves(state, unit.id).length > 0);
}
