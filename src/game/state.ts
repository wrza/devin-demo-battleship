import { chooseShot, randomFleet, type Random } from './ai';
import {
  allShipsSunk,
  createEmptyBoard,
  fireAt,
  isFleetComplete,
  placeShip,
} from './engine';
import {
  SHIP_SPECS,
  type Board,
  type Coordinate,
  type FireOutcome,
  type Orientation,
  type ShipName,
} from './types';

export type Phase = 'placement' | 'player-turn' | 'computer-turn' | 'game-over';
export type Winner = 'player' | 'computer';

export interface GameState {
  phase: Phase;
  playerBoard: Board;
  computerBoard: Board;
  /** Index into SHIP_SPECS of the ship the player is placing next. */
  placingIndex: number;
  orientation: Orientation;
  winner?: Winner;
  log: string[];
}

export function nextShipToPlace(state: GameState): ShipName | undefined {
  return SHIP_SPECS[state.placingIndex]?.name;
}

export function createGame(random: Random = Math.random): GameState {
  return {
    phase: 'placement',
    playerBoard: createEmptyBoard(),
    computerBoard: randomFleet(random),
    placingIndex: 0,
    orientation: 'horizontal',
    log: ['Place your fleet to begin.'],
  };
}

export function toggleOrientation(state: GameState): GameState {
  return {
    ...state,
    orientation: state.orientation === 'horizontal' ? 'vertical' : 'horizontal',
  };
}

function describe(who: 'You' | 'Computer', outcome: FireOutcome, target: Coordinate, ship?: ShipName) {
  const cell = `${String.fromCharCode(65 + target.col)}${target.row + 1}`;
  switch (outcome) {
    case 'miss':
      return `${who} fired at ${cell}: miss.`;
    case 'hit':
      return `${who} fired at ${cell}: hit!`;
    case 'sunk':
      return `${who} fired at ${cell}: sunk the ${ship}!`;
    case 'game-over':
      return `${who} fired at ${cell}: sunk the ${ship} — fleet destroyed!`;
  }
}

/** Places the player's next ship. Returns the unchanged state when placement is invalid. */
export function placePlayerShip(state: GameState, start: Coordinate): GameState {
  const name = nextShipToPlace(state);
  if (state.phase !== 'placement' || !name) return state;

  let playerBoard: Board;
  try {
    playerBoard = placeShip(state.playerBoard, name, start, state.orientation);
  } catch {
    return state;
  }

  const placingIndex = state.placingIndex + 1;
  const ready = isFleetComplete(playerBoard);
  return {
    ...state,
    playerBoard,
    placingIndex,
    phase: ready ? 'player-turn' : 'placement',
    log: ready
      ? [...state.log, 'Fleet ready. Fire at the enemy waters!']
      : [...state.log, `Placed ${name}.`],
  };
}

export function placeRandomPlayerFleet(
  state: GameState,
  random: Random = Math.random,
): GameState {
  return {
    ...state,
    playerBoard: randomFleet(random),
    placingIndex: SHIP_SPECS.length,
    phase: 'player-turn',
    log: [...state.log, 'Fleet placed at random. Fire at the enemy waters!'],
  };
}

/** The player fires at the computer's board. */
export function playerFire(state: GameState, target: Coordinate): GameState {
  if (state.phase !== 'player-turn') return state;

  let result;
  try {
    result = fireAt(state.computerBoard, target);
  } catch {
    return state;
  }

  const won = result.outcome === 'game-over';
  return {
    ...state,
    computerBoard: result.board,
    phase: won ? 'game-over' : 'computer-turn',
    winner: won ? 'player' : undefined,
    log: [...state.log, describe('You', result.outcome, target, result.sunkShip)],
  };
}

/** The computer fires at the player's board. */
export function computerFire(state: GameState, random: Random = Math.random): GameState {
  if (state.phase !== 'computer-turn') return state;

  const target = chooseShot(state.playerBoard, random);
  const result = fireAt(state.playerBoard, target);
  const lost = result.outcome === 'game-over';

  return {
    ...state,
    playerBoard: result.board,
    phase: lost ? 'game-over' : 'player-turn',
    winner: lost ? 'computer' : undefined,
    log: [...state.log, describe('Computer', result.outcome, target, result.sunkShip)],
  };
}

export function isGameOver(state: GameState): boolean {
  return allShipsSunk(state.playerBoard) || allShipsSunk(state.computerBoard);
}
