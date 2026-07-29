export const BOARD_SIZE = 10;

export type ShipName =
  | 'Carrier'
  | 'Battleship'
  | 'Cruiser'
  | 'Submarine'
  | 'Destroyer';

export type Orientation = 'horizontal' | 'vertical';

export interface ShipSpec {
  name: ShipName;
  length: number;
}

export const SHIP_SPECS: readonly ShipSpec[] = [
  { name: 'Carrier', length: 5 },
  { name: 'Battleship', length: 4 },
  { name: 'Cruiser', length: 3 },
  { name: 'Submarine', length: 3 },
  { name: 'Destroyer', length: 2 },
] as const;

export interface Coordinate {
  row: number;
  col: number;
}

export interface Ship {
  name: ShipName;
  length: number;
  cells: Coordinate[];
  hits: Coordinate[];
}

export type CellState = 'empty' | 'ship' | 'miss' | 'hit';

export interface Board {
  ships: Ship[];
  shots: Coordinate[];
}

export type FireOutcome = 'miss' | 'hit' | 'sunk' | 'game-over';

export interface FireResult {
  board: Board;
  outcome: FireOutcome;
  /** Set when a ship was sunk by this shot (including the final shot of the game). */
  sunkShip?: ShipName;
}

export type PlacementErrorReason = 'out-of-bounds' | 'overlap' | 'duplicate-ship';

export class PlacementError extends Error {
  reason: PlacementErrorReason;

  constructor(reason: PlacementErrorReason, message: string) {
    super(message);
    this.name = 'PlacementError';
    this.reason = reason;
  }
}

export class InvalidShotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidShotError';
  }
}
