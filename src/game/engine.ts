import {
  BOARD_SIZE,
  InvalidShotError,
  PlacementError,
  SHIP_SPECS,
  type Board,
  type CellState,
  type Coordinate,
  type FireResult,
  type Orientation,
  type Ship,
  type ShipName,
} from './types';

export function createEmptyBoard(): Board {
  return { ships: [], shots: [] };
}

export function sameCoordinate(a: Coordinate, b: Coordinate): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isInsideBoard({ row, col }: Coordinate): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function shipLength(name: ShipName): number {
  const spec = SHIP_SPECS.find((s) => s.name === name);
  if (!spec) throw new Error(`Unknown ship: ${name}`);
  return spec.length;
}

export function shipCells(
  name: ShipName,
  start: Coordinate,
  orientation: Orientation,
): Coordinate[] {
  const length = shipLength(name);
  return Array.from({ length }, (_, i) =>
    orientation === 'horizontal'
      ? { row: start.row, col: start.col + i }
      : { row: start.row + i, col: start.col },
  );
}

export function canPlaceShip(
  board: Board,
  name: ShipName,
  start: Coordinate,
  orientation: Orientation,
): boolean {
  try {
    validatePlacement(board, name, start, orientation);
    return true;
  } catch {
    return false;
  }
}

function validatePlacement(
  board: Board,
  name: ShipName,
  start: Coordinate,
  orientation: Orientation,
): Coordinate[] {
  if (board.ships.some((ship) => ship.name === name)) {
    throw new PlacementError('duplicate-ship', `${name} has already been placed`);
  }

  const cells = shipCells(name, start, orientation);
  if (!cells.every(isInsideBoard)) {
    throw new PlacementError(
      'out-of-bounds',
      `${name} does not fit on the board at (${start.row}, ${start.col}) ${orientation}`,
    );
  }

  const occupied = board.ships.flatMap((ship) => ship.cells);
  if (cells.some((cell) => occupied.some((taken) => sameCoordinate(cell, taken)))) {
    throw new PlacementError('overlap', `${name} overlaps another ship`);
  }

  return cells;
}

/** Returns a new board with the ship placed. Throws PlacementError when invalid. */
export function placeShip(
  board: Board,
  name: ShipName,
  start: Coordinate,
  orientation: Orientation,
): Board {
  const cells = validatePlacement(board, name, start, orientation);
  const ship: Ship = { name, length: cells.length, cells, hits: [] };
  return { ...board, ships: [...board.ships, ship] };
}

export function isShipSunk(ship: Ship): boolean {
  return ship.hits.length === ship.length;
}

export function isFleetComplete(board: Board): boolean {
  return board.ships.length === SHIP_SPECS.length;
}

export function allShipsSunk(board: Board): boolean {
  return isFleetComplete(board) && board.ships.every(isShipSunk);
}

export function hasBeenShot(board: Board, target: Coordinate): boolean {
  return board.shots.some((shot) => sameCoordinate(shot, target));
}

/**
 * Fires at `target` on `board` (the defender's board).
 * Returns a new board plus the outcome; never mutates the input.
 */
export function fireAt(board: Board, target: Coordinate): FireResult {
  if (!isInsideBoard(target)) {
    throw new InvalidShotError(`Shot (${target.row}, ${target.col}) is off the board`);
  }
  if (hasBeenShot(board, target)) {
    throw new InvalidShotError(
      `Cell (${target.row}, ${target.col}) has already been fired at`,
    );
  }

  const shots = [...board.shots, target];
  const hitIndex = board.ships.findIndex((ship) =>
    ship.cells.some((cell) => sameCoordinate(cell, target)),
  );

  if (hitIndex === -1) {
    return { board: { ...board, shots }, outcome: 'miss' };
  }

  const ships = board.ships.map((ship, index) =>
    index === hitIndex ? { ...ship, hits: [...ship.hits, target] } : ship,
  );
  const nextBoard: Board = { ships, shots };
  const hitShip = ships[hitIndex];

  if (!isShipSunk(hitShip)) {
    return { board: nextBoard, outcome: 'hit' };
  }
  if (allShipsSunk(nextBoard)) {
    return { board: nextBoard, outcome: 'game-over', sunkShip: hitShip.name };
  }
  return { board: nextBoard, outcome: 'sunk', sunkShip: hitShip.name };
}

/** Cell state from the owner's perspective (ships visible). */
export function cellState(board: Board, target: Coordinate): CellState {
  const isShot = hasBeenShot(board, target);
  const hasShip = board.ships.some((ship) =>
    ship.cells.some((cell) => sameCoordinate(cell, target)),
  );
  if (isShot) return hasShip ? 'hit' : 'miss';
  return hasShip ? 'ship' : 'empty';
}

/** Cell state from the opponent's perspective (ships hidden until hit). */
export function opponentCellState(board: Board, target: Coordinate): CellState {
  const state = cellState(board, target);
  return state === 'ship' ? 'empty' : state;
}

export function allCoordinates(): Coordinate[] {
  const cells: Coordinate[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) cells.push({ row, col });
  }
  return cells;
}

export function remainingShips(board: Board): Ship[] {
  return board.ships.filter((ship) => !isShipSunk(ship));
}
