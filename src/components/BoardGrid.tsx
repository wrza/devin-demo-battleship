import { useState } from 'react';
import { canPlaceShip, cellState, opponentCellState, shipCells } from '../game/engine';
import {
  BOARD_SIZE,
  type Board,
  type CellState,
  type Coordinate,
  type Orientation,
  type ShipName,
} from '../game/types';

interface BoardGridProps {
  board: Board;
  /** Owner view shows un-hit ships; opponent view hides them. */
  view: 'owner' | 'opponent';
  disabled?: boolean;
  onCellClick?: (cell: Coordinate) => void;
  /** Ship outline previewed under the cursor during placement. */
  preview?: { name: ShipName; orientation: Orientation };
  label: string;
}

const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_, i) =>
  String.fromCharCode(65 + i),
);

function cellClass(state: CellState, view: 'owner' | 'opponent'): string {
  if (state === 'hit') return 'cell cell-hit';
  if (state === 'miss') return 'cell cell-miss';
  if (state === 'ship' && view === 'owner') return 'cell cell-ship';
  return 'cell cell-water';
}

export function BoardGrid({
  board,
  view,
  disabled,
  onCellClick,
  preview,
  label,
}: BoardGridProps) {
  const [hovered, setHovered] = useState<Coordinate | null>(null);

  const previewCells = new Set<string>();
  let previewValid = false;
  if (preview && hovered) {
    previewValid = canPlaceShip(board, preview.name, hovered, preview.orientation);
    for (const cell of shipCells(preview.name, hovered, preview.orientation)) {
      previewCells.add(`${cell.row},${cell.col}`);
    }
  }

  return (
    <section className="board">
      <h2 className="board-label">{label}</h2>
      <div className="grid" role="grid" aria-label={label} onMouseLeave={() => setHovered(null)}>
        <div className="grid-row" role="row">
          <div className="cell cell-header" aria-hidden="true" />
          {COLUMN_LABELS.map((letter) => (
            <div key={letter} className="cell cell-header" aria-hidden="true">
              {letter}
            </div>
          ))}
        </div>
        {Array.from({ length: BOARD_SIZE }, (_, row) => (
          <div className="grid-row" key={row} role="row">
            <div className="cell cell-header" aria-hidden="true">
              {row + 1}
            </div>
            {Array.from({ length: BOARD_SIZE }, (_, col) => {
              const cell: Coordinate = { row, col };
              const state =
                view === 'owner' ? cellState(board, cell) : opponentCellState(board, cell);
              const name = `${COLUMN_LABELS[col]}${row + 1}`;
              const previewed = previewCells.has(`${row},${col}`);
              const previewClass = previewed
                ? previewValid
                  ? ' cell-preview'
                  : ' cell-preview-invalid'
                : '';

              return (
                <button
                  key={col}
                  type="button"
                  className={`${cellClass(state, view)}${previewClass}`}
                  aria-label={`${label} ${name}: ${state}`}
                  disabled={disabled || !onCellClick}
                  onMouseEnter={() => preview && setHovered(cell)}
                  onFocus={() => preview && setHovered(cell)}
                  onClick={() => onCellClick?.(cell)}
                >
                  {state === 'hit' ? '✕' : state === 'miss' ? '•' : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
