import {
  BOARD_SIZE,
  SIDE_INFO,
  UNIT_TYPES,
  chooseBattleAction,
  createInitialGame,
  getLegalMoves,
  getPhase,
  getUnitAt,
  hasLegalMove,
  moveUnit,
  passTurn,
} from "./game.js";

const boardElement = document.querySelector("#board");
const gameMessage = document.querySelector("#game-message");
const battleModal = document.querySelector("#battle-modal");
const battleActions = document.querySelector("#battle-actions");
const passDevice = document.querySelector("#pass-device");
let game = createInitialGame();
let selectedUnitId = null;
let readyForBattleAction = false;
let toastTimer;

function squareName(row, col) {
  return `${"abcdefgh"[col]}${BOARD_SIZE - row}`;
}

function renderBoard() {
  const selected = game.units[selectedUnitId];
  const legal = selected ? getLegalMoves(game, selected.id) : [];
  boardElement.replaceChildren();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const unit = getUnitAt(game, row, col);
      const isLegal = legal.some((move) => move.row === row && move.col === col);
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(row + col) % 2 ? "square-dark" : "square-light"}`;
      square.dataset.row = row;
      square.dataset.col = col;
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", `${squareName(row, col)}${unit ? `, ${SIDE_INFO[unit.side].name} ${UNIT_TYPES[unit.type].name}, ${unit.hp} health` : ""}${isLegal ? unit ? ", challenge" : ", legal move" : ""}`);
      if (selected?.row === row && selected?.col === col) square.classList.add("selected-square");
      if (isLegal) square.classList.add(unit ? "challenge-square" : "move-square");

      if (unit) {
        const piece = document.createElement("span");
        piece.className = `piece ${unit.side === "ember" ? "piece-ember" : "piece-gloom"}${unit.id === selectedUnitId ? " piece-selected" : ""}`;
        piece.setAttribute("aria-hidden", "true");
        const sigil = document.createElement("span");
        sigil.className = "piece-sigil";
        sigil.textContent = UNIT_TYPES[unit.type].sigil;
        piece.append(sigil);
        const health = document.createElement("span");
        health.className = "piece-health";
        health.textContent = "●".repeat(Math.ceil(unit.hp / 2));
        piece.append(health);
        square.append(piece);
      } else if (isLegal) {
        const marker = document.createElement("span");
        marker.className = "move-marker";
        square.append(marker);
      }
      boardElement.append(square);
    }
  }
}

function renderRoster(side) {
  const units = Object.values(game.units).filter((unit) => unit.side === side);
  const crownAlive = units.some((unit) => unit.type === "crown");
  const roster = document.createElement("div");
  roster.className = `roster ${side === "ember" ? "roster-ember" : "roster-gloom"}`;
  const header = document.createElement("div");
  header.className = "roster-header";
  const label = document.createElement("span");
  label.className = "roster-name";
  label.textContent = SIDE_INFO[side].shortName;
  const crownStatus = document.createElement("span");
  crownStatus.className = "crown-status";
  crownStatus.textContent = crownAlive ? "CROWN STANDS" : "CROWN FALLEN";
  header.append(label, crownStatus);
  roster.append(header);

  const tokens = document.createElement("div");
  tokens.className = "roster-tokens";
  for (const unit of units) {
    const token = document.createElement("span");
    token.className = `roster-token ${unit.hp < unit.maxHp / 2 ? "token-wounded" : ""}`;
    token.title = `${UNIT_TYPES[unit.type].name}: ${unit.hp}/${unit.maxHp} health`;
    token.setAttribute("aria-label", token.title);
    token.textContent = UNIT_TYPES[unit.type].sigil;
    tokens.append(token);
  }
  roster.append(tokens);
  return roster;
}

function renderBattle() {
  if (!game.battle) {
    battleModal.hidden = true;
    readyForBattleAction = false;
    return;
  }
  battleModal.hidden = false;
  const battle = game.battle;
  const attacker = game.units[battle.attackerId];
  const defender = game.units[battle.defenderId];
  if (!attacker || !defender) return;
  const phase = getPhase(game);
  const arena = document.querySelector("#arena");
  arena.replaceChildren(
    createFighterCard(attacker, "attacker", phase),
    Object.assign(document.createElement("div"), { className: "arena-vs", textContent: "VS" }),
    createFighterCard(defender, "defender", phase),
  );

  document.querySelector("#battle-round").textContent = `ARENA ROUND ${String(battle.round).padStart(2, "0")} · ${phase.name.toUpperCase()}`;
  const needsHandoff = battle.choosing === "defender" || battle.round > 1;
  if (needsHandoff && !readyForBattleAction) {
    const nextUnit = battle.choosing === "attacker" ? attacker : defender;
    document.querySelector("#battle-prompt").textContent = `Pass the device to ${SIDE_INFO[nextUnit.side].name}.`;
    battleActions.hidden = true;
    passDevice.hidden = false;
  } else {
    const nextUnit = battle.choosing === "attacker" ? attacker : defender;
    document.querySelector("#battle-prompt").textContent = `${SIDE_INFO[nextUnit.side].name} — choose your move.`;
    battleActions.hidden = false;
    passDevice.hidden = true;
  }
}

function createFighterCard(unit, position, phase) {
  const card = document.createElement("div");
  card.className = `fighter-card fighter-${unit.side}`;
  const sigil = document.createElement("span");
  sigil.className = "fighter-sigil";
  sigil.textContent = UNIT_TYPES[unit.type].sigil;
  const name = document.createElement("strong");
  name.textContent = UNIT_TYPES[unit.type].name;
  const side = document.createElement("span");
  side.className = "fighter-side";
  side.textContent = SIDE_INFO[unit.side].shortName;
  const health = document.createElement("div");
  health.className = "health-track";
  const bar = document.createElement("span");
  bar.style.width = `${Math.max(0, unit.hp / unit.maxHp * 100)}%`;
  health.append(bar);
  const healthLabel = document.createElement("small");
  healthLabel.textContent = `${unit.hp} / ${unit.maxHp} VITALITY${unit.charged ? " · CHARGED" : ""}`;
  const bonus = phase.bonusSide === null || phase.bonusSide === unit.side ? " · +1 STRIKE" : "";
  const status = document.createElement("span");
  status.className = "fighter-position";
  status.textContent = position === "attacker" ? `CHALLENGER${bonus}` : `DEFENDER${bonus}`;
  card.append(sigil, name, side, health, healthLabel, status);
  return card;
}

function render() {
  renderBoard();
  const side = SIDE_INFO[game.currentSide];
  const phase = getPhase(game);
  const movesThisRound = Math.floor(game.moves / 2) + 1;
  document.querySelector("#round-label").textContent = `ROUND ${String(movesThisRound).padStart(2, "0")}`;
  document.querySelector("#turn-number").textContent = `MOVE ${String(game.moves + 1).padStart(2, "0")}`;
  document.querySelector("#active-name").textContent = game.winner
    ? `${SIDE_INFO[game.winner].name} prevails`
    : side.name;
  document.querySelector("#active-caption").textContent = game.winner ? "The crown has fallen." : `Your move · ${phase.name}`;
  const sigil = document.querySelector("#active-sigil");
  sigil.textContent = game.currentSide === "ember" ? "✦" : "◈";
  sigil.className = `active-sigil ${game.currentSide === "ember" ? "ember-sigil" : "gloom-sigil"}`;
  document.querySelector("#phase-name").textContent = phase.name;
  document.querySelector("#phase-detail").textContent = phase.detail;
  const phaseSymbol = document.querySelector("#phase-symbol");
  phaseSymbol.textContent = phase.id === "sun" ? "☼" : phase.id === "moon" ? "☾" : "◉";
  phaseSymbol.className = `phase-symbol ${phase.id}-symbol`;
  document.querySelectorAll("[data-phase-node]").forEach((node) => {
    node.classList.toggle("active", node.dataset.phaseNode === phase.id);
  });
  const forceRosters = document.querySelector("#force-rosters");
  forceRosters.replaceChildren(renderRoster("ember"), renderRoster("gloom"));
  document.querySelector("#unit-count").textContent = `${Object.keys(game.units).length} pieces`;
  const noMoves = !game.winner && !game.battle && !hasLegalMove(game);
  document.querySelector("#pass-turn").hidden = !noMoves;
  if (game.winner) gameMessage.textContent = `${SIDE_INFO[game.winner].name} wins — the enemy Crown is lost.`;
  else if (game.battle) gameMessage.textContent = "A challenge is underway in the arena.";
  else if (noMoves) gameMessage.textContent = "No pieces can move. Pass the turn to continue.";
  else if (selectedUnitId) gameMessage.textContent = "Choose one of the glowing squares.";
  else gameMessage.textContent = "Choose a piece to see its paths.";
  renderBattle();
}

function announce(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("toast-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("toast-visible"), 2400);
}

boardElement.addEventListener("click", (event) => {
  const square = event.target.closest(".square");
  if (!square || game.winner || game.battle) return;
  const row = Number(square.dataset.row);
  const col = Number(square.dataset.col);
  const unit = getUnitAt(game, row, col);

  if (selectedUnitId && getLegalMoves(game, selectedUnitId).some((move) => move.row === row && move.col === col)) {
    const challenged = Boolean(unit);
    try {
      game = moveUnit(game, selectedUnitId, row, col);
      selectedUnitId = null;
      if (challenged) announce("A challenge begins!");
    } catch (error) {
      announce(error.message);
    }
  } else if (unit?.side === game.currentSide) {
    selectedUnitId = unit.id === selectedUnitId ? null : unit.id;
  } else {
    selectedUnitId = null;
  }
  render();
});

document.querySelector("#pass-turn").addEventListener("click", () => {
  try {
    game = passTurn(game);
    selectedUnitId = null;
    announce(`${SIDE_INFO[game.currentSide].name} to move.`);
    render();
  } catch (error) {
    announce(error.message);
  }
});

battleActions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || !game.battle) return;
  try {
    game = chooseBattleAction(game, button.dataset.action);
    readyForBattleAction = false;
    if (!game.battle || game.battle.round > 1) {
      if (game.battle) {
        render();
        return;
      }
      if (game.winner) announce(`${SIDE_INFO[game.winner].name} claims the Veil!`);
      else if (!game.battle) announce("The challenge is decided. The victor holds the square.");
    }
    render();
  } catch (error) {
    announce(error.message);
  }
});

passDevice.addEventListener("click", () => {
  readyForBattleAction = true;
  renderBattle();
  battleActions.querySelector("button")?.focus();
});

document.querySelector("#reset-game").addEventListener("click", () => {
  game = createInitialGame();
  selectedUnitId = null;
  readyForBattleAction = false;
  render();
  announce("A fresh game begins. Ember moves first.");
});

render();
