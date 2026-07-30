import { describe, expect, it } from 'vitest';
import {
  allShipsSunk,
  canPlaceShip,
  cellState,
  createEmptyBoard,
  fireAt,
  isShipSunk,
  opponentCellState,
  placeShip,
  remainingShips,
  shipCells,
} from './engine';
import {
  BOARD_SIZE,
  InvalidShotError,
  PlacementError,
  SHIP_SPECS,
  type Board,
  type Coordinate,
  type ShipName,
} from './types';

function boardWith(
  placements: [ShipName, Coordinate, 'horizontal' | 'vertical'][],
): Board {
  return placements.reduce(
    (board, [name, start, orientation]) => placeShip(board, name, start, orientation),
    createEmptyBoard(),
  );
}

/** Full fleet in non-overlapping rows: Carrier row 0, Battleship row 1, ... */
function fullFleet(): Board {
  return boardWith(
    SHIP_SPECS.map((spec, index) => [
      spec.name,
      { row: index, col: 0 },
      'horizontal',
    ]),
  );
}

function sink(board: Board, name: ShipName): Board {
  const ship = board.ships.find((s) => s.name === name);
  if (!ship) throw new Error(`ship ${name} not on board`);
  return ship.cells.reduce((current, cell) => fireAt(current, cell).board, board);
}

describe('ship placement validation', () => {
  it('places a ship horizontally on the requested cells', () => {
    const board = placeShip(createEmptyBoard(), 'Destroyer', { row: 3, col: 4 }, 'horizontal');

    expect(board.ships).toHaveLength(1);
    expect(board.ships[0].cells).toEqual([
      { row: 3, col: 4 },
      { row: 3, col: 5 },
    ]);
    expect(board.ships[0].hits).toEqual([]);
  });

  it('places a ship vertically on the requested cells', () => {
    const board = placeShip(createEmptyBoard(), 'Cruiser', { row: 7, col: 1 }, 'vertical');

    expect(board.ships[0].cells).toEqual([
      { row: 7, col: 1 },
      { row: 8, col: 1 },
      { row: 9, col: 1 },
    ]);
  });

  it('uses the standard ship set with the standard lengths', () => {
    expect(SHIP_SPECS.map((spec) => [spec.name, spec.length])).toEqual([
      ['Carrier', 5],
      ['Battleship', 4],
      ['Cruiser', 3],
      ['Submarine', 3],
      ['Destroyer', 2],
    ]);
  });

  it('rejects a horizontal placement that runs off the right edge', () => {
    const start = { row: 0, col: BOARD_SIZE - 2 };

    expect(canPlaceShip(createEmptyBoard(), 'Cruiser', start, 'horizontal')).toBe(false);
    expect(() => placeShip(createEmptyBoard(), 'Cruiser', start, 'horizontal')).toThrow(
      PlacementError,
    );
  });

  it('rejects a vertical placement that runs off the bottom edge', () => {
    const start = { row: BOARD_SIZE - 3, col: 5 };

    expect(canPlaceShip(createEmptyBoard(), 'Carrier', start, 'vertical')).toBe(false);
  });

  it('rejects negative coordinates', () => {
    expect(canPlaceShip(createEmptyBoard(), 'Destroyer', { row: -1, col: 0 }, 'horizontal')).toBe(
      false,
    );
  });

  it('allows a ship that ends exactly on the last column', () => {
    const start = { row: 2, col: BOARD_SIZE - 3 };

    expect(canPlaceShip(createEmptyBoard(), 'Cruiser', start, 'horizontal')).toBe(true);
  });

  it('rejects overlapping placements', () => {
    const board = placeShip(createEmptyBoard(), 'Carrier', { row: 4, col: 0 }, 'horizontal');

    expect(canPlaceShip(board, 'Battleship', { row: 4, col: 4 }, 'horizontal')).toBe(false);
    expect(canPlaceShip(board, 'Battleship', { row: 2, col: 3 }, 'vertical')).toBe(false);
    expect(() => placeShip(board, 'Battleship', { row: 4, col: 4 }, 'horizontal')).toThrow(
      /overlaps/,
    );
  });

  it('allows adjacent, non-overlapping placements', () => {
    const board = placeShip(createEmptyBoard(), 'Carrier', { row: 4, col: 0 }, 'horizontal');

    expect(canPlaceShip(board, 'Battleship', { row: 4, col: 5 }, 'horizontal')).toBe(true);
    expect(canPlaceShip(board, 'Battleship', { row: 5, col: 0 }, 'horizontal')).toBe(true);
  });

  it('rejects placing the same ship twice', () => {
    const board = placeShip(createEmptyBoard(), 'Submarine', { row: 0, col: 0 }, 'horizontal');

    expect(() => placeShip(board, 'Submarine', { row: 5, col: 5 }, 'horizontal')).toThrow(
      /already been placed/,
    );
  });

  it('does not mutate the board it is given', () => {
    const board = createEmptyBoard();
    placeShip(board, 'Destroyer', { row: 0, col: 0 }, 'horizontal');

    expect(board.ships).toHaveLength(0);
  });

  it('computes cells without consulting the board', () => {
    expect(shipCells('Battleship', { row: 1, col: 1 }, 'vertical')).toHaveLength(4);
  });
});

describe('hit and miss detection', () => {
  it('reports a miss on open water and records the shot', () => {
    const board = boardWith([['Destroyer', { row: 0, col: 0 }, 'horizontal']]);

    const result = fireAt(board, { row: 9, col: 9 });

    expect(result.outcome).toBe('miss');
    expect(result.sunkShip).toBeUndefined();
    expect(result.board.shots).toEqual([{ row: 9, col: 9 }]);
    expect(cellState(result.board, { row: 9, col: 9 })).toBe('miss');
  });

  it('reports a hit when a ship occupies the cell', () => {
    const board = boardWith([['Carrier', { row: 2, col: 2 }, 'horizontal']]);

    const result = fireAt(board, { row: 2, col: 3 });

    expect(result.outcome).toBe('hit');
    expect(result.board.ships[0].hits).toEqual([{ row: 2, col: 3 }]);
    expect(cellState(result.board, { row: 2, col: 3 })).toBe('hit');
  });

  it('hides un-hit ships from the opponent view but reveals hits', () => {
    const board = boardWith([['Carrier', { row: 2, col: 2 }, 'horizontal']]);

    expect(opponentCellState(board, { row: 2, col: 2 })).toBe('empty');
    expect(cellState(board, { row: 2, col: 2 })).toBe('ship');

    const { board: after } = fireAt(board, { row: 2, col: 2 });
    expect(opponentCellState(after, { row: 2, col: 2 })).toBe('hit');
  });

  it('rejects firing at the same cell twice', () => {
    const board = boardWith([['Destroyer', { row: 0, col: 0 }, 'horizontal']]);
    const { board: after } = fireAt(board, { row: 5, col: 5 });

    expect(() => fireAt(after, { row: 5, col: 5 })).toThrow(InvalidShotError);
  });

  it('rejects firing outside the board', () => {
    expect(() => fireAt(createEmptyBoard(), { row: BOARD_SIZE, col: 0 })).toThrow(
      InvalidShotError,
    );
  });

  it('does not mutate the board it is given', () => {
    const board = boardWith([['Destroyer', { row: 0, col: 0 }, 'horizontal']]);
    fireAt(board, { row: 0, col: 0 });

    expect(board.shots).toHaveLength(0);
    expect(board.ships[0].hits).toHaveLength(0);
  });
});

describe('sinking a ship', () => {
  it('reports sunk with the ship name only on the final hit', () => {
    const board = boardWith([
      ['Cruiser', { row: 1, col: 1 }, 'horizontal'],
      ['Carrier', { row: 5, col: 0 }, 'horizontal'],
    ]);

    const first = fireAt(board, { row: 1, col: 1 });
    expect(first.outcome).toBe('hit');

    const second = fireAt(first.board, { row: 1, col: 2 });
    expect(second.outcome).toBe('hit');

    const third = fireAt(second.board, { row: 1, col: 3 });
    expect(third.outcome).toBe('sunk');
    expect(third.sunkShip).toBe('Cruiser');
    expect(isShipSunk(third.board.ships[0])).toBe(true);
  });

  it('leaves other ships afloat when one is sunk', () => {
    const board = sink(fullFleet(), 'Destroyer');

    expect(remainingShips(board).map((ship) => ship.name)).toEqual([
      'Carrier',
      'Battleship',
      'Cruiser',
      'Submarine',
    ]);
    expect(allShipsSunk(board)).toBe(false);
  });
});

describe('win condition detection', () => {
  it('is not a win until every ship of the fleet is sunk', () => {
    let board = fullFleet();
    for (const name of ['Carrier', 'Battleship', 'Cruiser', 'Submarine'] as ShipName[]) {
      board = sink(board, name);
      expect(allShipsSunk(board)).toBe(false);
    }

    const destroyer = board.ships.find((ship) => ship.name === 'Destroyer')!;
    const penultimate = fireAt(board, destroyer.cells[0]);
    expect(penultimate.outcome).toBe('hit');

    const final = fireAt(penultimate.board, destroyer.cells[1]);
    expect(final.outcome).toBe('game-over');
    expect(final.sunkShip).toBe('Destroyer');
    expect(allShipsSunk(final.board)).toBe(true);
    expect(remainingShips(final.board)).toEqual([]);
  });

  it('declares a win when every ship on the board is sunk, whatever the fleet size', () => {
    const board = sink(
      boardWith([['Destroyer', { row: 0, col: 0 }, 'horizontal']]),
      'Destroyer',
    );

    expect(allShipsSunk(board)).toBe(true);
  });

  it('ends the game on the final shot of a non-standard fleet', () => {
    const board = boardWith([
      ['Destroyer', { row: 0, col: 0 }, 'horizontal'],
      ['Cruiser', { row: 2, col: 0 }, 'horizontal'],
    ]);

    const partial = sink(board, 'Cruiser');
    expect(allShipsSunk(partial)).toBe(false);

    const penultimate = fireAt(partial, { row: 0, col: 0 });
    expect(penultimate.outcome).toBe('hit');

    const final = fireAt(penultimate.board, { row: 0, col: 1 });
    expect(final.outcome).toBe('game-over');
    expect(allShipsSunk(final.board)).toBe(true);
  });

  it('never declares a win for a board with no ships', () => {
    expect(allShipsSunk(createEmptyBoard())).toBe(false);
    expect(allShipsSunk(fireAt(createEmptyBoard(), { row: 0, col: 0 }).board)).toBe(false);
  });

  it('does not treat misses as progress toward a win', () => {
    const board = fireAt(fullFleet(), { row: 9, col: 9 }).board;

    expect(allShipsSunk(board)).toBe(false);
  });
});
