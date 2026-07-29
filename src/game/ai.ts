import {
  allCoordinates,
  canPlaceShip,
  createEmptyBoard,
  hasBeenShot,
  isInsideBoard,
  isShipSunk,
  placeShip,
  sameCoordinate,
} from './engine';
import {
  SHIP_SPECS,
  type Board,
  type Coordinate,
  type Orientation,
} from './types';

export type Random = () => number;

const ORIENTATIONS: Orientation[] = ['horizontal', 'vertical'];

function pick<T>(items: T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
}

/** Places the full standard fleet at random valid positions. */
export function randomFleet(random: Random = Math.random): Board {
  let board = createEmptyBoard();
  for (const spec of SHIP_SPECS) {
    const options: { start: Coordinate; orientation: Orientation }[] = [];
    for (const start of allCoordinates()) {
      for (const orientation of ORIENTATIONS) {
        if (canPlaceShip(board, spec.name, start, orientation)) {
          options.push({ start, orientation });
        }
      }
    }
    const choice = pick(options, random);
    board = placeShip(board, spec.name, choice.start, choice.orientation);
  }
  return board;
}

const NEIGHBOUR_OFFSETS: Coordinate[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

/**
 * Chooses the computer's next shot against `board` (the human's board).
 * Hunts adjacent cells around hits belonging to ships that are not yet sunk,
 * otherwise fires at a random untried cell on a checkerboard pattern.
 */
export function chooseShot(board: Board, random: Random = Math.random): Coordinate {
  const untried = allCoordinates().filter((cell) => !hasBeenShot(board, cell));
  if (untried.length === 0) {
    throw new Error('No cells left to fire at');
  }

  const woundedHits = board.ships
    .filter((ship) => !isShipSunk(ship))
    .flatMap((ship) => ship.hits);

  const targets = woundedHits
    .flatMap((hit) =>
      NEIGHBOUR_OFFSETS.map((offset) => ({
        row: hit.row + offset.row,
        col: hit.col + offset.col,
      })),
    )
    .filter((cell) => isInsideBoard(cell) && !hasBeenShot(board, cell))
    .filter(
      (cell, index, cells) =>
        cells.findIndex((other) => sameCoordinate(other, cell)) === index,
    );

  if (targets.length > 0) return pick(targets, random);

  const checkerboard = untried.filter((cell) => (cell.row + cell.col) % 2 === 0);
  return pick(checkerboard.length > 0 ? checkerboard : untried, random);
}
