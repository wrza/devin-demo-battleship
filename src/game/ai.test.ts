import { describe, expect, it } from 'vitest';
import { chooseShot, completeFleet, randomFleet, type Random } from './ai';
import {
  allShipsSunk,
  createEmptyBoard,
  fireAt,
  hasBeenShot,
  isFleetComplete,
  placeShip,
  sameCoordinate,
} from './engine';
import { SHIP_SPECS, type Board, type Coordinate } from './types';

/** Deterministic pseudo-random generator so fleet/shot choices are reproducible. */
function seeded(seed: number): Random {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('randomFleet', () => {
  it('places the whole standard fleet without overlaps or out-of-bounds cells', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const board = randomFleet(seeded(seed));

      expect(isFleetComplete(board)).toBe(true);
      expect(board.ships.map((ship) => ship.name).sort()).toEqual(
        SHIP_SPECS.map((spec) => spec.name).sort(),
      );

      const cells = board.ships.flatMap((ship) => ship.cells);
      expect(cells).toHaveLength(SHIP_SPECS.reduce((sum, s) => sum + s.length, 0));
      const keys = new Set(cells.map((cell) => `${cell.row},${cell.col}`));
      expect(keys.size).toBe(cells.length);
      expect(cells.every((c) => c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10)).toBe(true);
    }
  });

  it('places a valid fleet even when the random source returns the boundary value 1', () => {
    const board = randomFleet(() => 1);

    expect(isFleetComplete(board)).toBe(true);
  });
});

describe('completeFleet', () => {
  it('keeps existing ships and only places the missing ones', () => {
    const partial = placeShip(createEmptyBoard(), 'Carrier', { row: 0, col: 0 }, 'horizontal');

    const board = completeFleet(partial, seeded(5));

    expect(isFleetComplete(board)).toBe(true);
    expect(board.ships.find((ship) => ship.name === 'Carrier')!.cells).toEqual(
      partial.ships[0].cells,
    );
  });

  it('returns a complete board unchanged', () => {
    const full = randomFleet(seeded(3));
    expect(completeFleet(full, seeded(5))).toBe(full);
  });
});

describe('chooseShot', () => {
  it('never repeats a shot', () => {
    const random = seeded(7);
    let board = randomFleet(seeded(3));

    for (let i = 0; i < 100; i += 1) {
      const shot = chooseShot(board, random);
      expect(hasBeenShot(board, shot)).toBe(false);
      board = fireAt(board, shot).board;
    }

    expect(board.shots).toHaveLength(100);
    expect(allShipsSunk(board)).toBe(true);
  });

  it('targets a cell adjacent to an unsunk hit', () => {
    const board: Board = placeShip(
      createEmptyBoard(),
      'Carrier',
      { row: 4, col: 2 },
      'horizontal',
    );
    const hit = fireAt(board, { row: 4, col: 4 }).board;

    const neighbours: Coordinate[] = [
      { row: 3, col: 4 },
      { row: 5, col: 4 },
      { row: 4, col: 3 },
      { row: 4, col: 5 },
    ];

    for (let seed = 1; seed <= 10; seed += 1) {
      const shot = chooseShot(hit, seeded(seed));
      expect(neighbours.some((cell) => sameCoordinate(cell, shot))).toBe(true);
    }
  });

  it('throws when the board is fully explored', () => {
    let board = createEmptyBoard();
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        board = fireAt(board, { row, col }).board;
      }
    }

    expect(() => chooseShot(board, seeded(1))).toThrow(/No cells left/);
  });
});
