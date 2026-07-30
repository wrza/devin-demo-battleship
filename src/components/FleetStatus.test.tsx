import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyBoard, fireAt, placeShip } from '../game/engine';
import type { Board } from '../game/types';
import { FleetStatus } from './FleetStatus';

afterEach(cleanup);

function boardWithHitCarrier(): Board {
  const board = placeShip(createEmptyBoard(), 'Carrier', { row: 0, col: 0 }, 'horizontal');
  return fireAt(board, { row: 0, col: 0 }).board;
}

function sunkDestroyerBoard(): Board {
  let board = placeShip(createEmptyBoard(), 'Destroyer', { row: 0, col: 0 }, 'horizontal');
  board = fireAt(board, { row: 0, col: 0 }).board;
  return fireAt(board, { row: 0, col: 1 }).board;
}

function rowFor(name: string): HTMLElement {
  return screen.getByText(new RegExp(`^${name} \\(`)).closest('li')!;
}

describe('FleetStatus', () => {
  it('shows hit progress in the owner view', () => {
    render(<FleetStatus board={boardWithHitCarrier()} title="Your ships" view="owner" />);

    expect(within(rowFor('Carrier')).getByText('1/5')).toBeTruthy();
    expect(within(rowFor('Battleship')).getByText('not placed')).toBeTruthy();
  });

  it('never reveals hit progress in the opponent view', () => {
    render(<FleetStatus board={boardWithHitCarrier()} title="Enemy ships" view="opponent" />);

    expect(within(rowFor('Carrier')).getByText('afloat')).toBeTruthy();
    expect(screen.queryByText(/\d\/\d/)).toBeNull();
    expect(screen.queryByText('not placed')).toBeNull();
  });

  it('reveals sunk ships in the opponent view', () => {
    render(<FleetStatus board={sunkDestroyerBoard()} title="Enemy ships" view="opponent" />);

    expect(within(rowFor('Destroyer')).getByText('sunk')).toBeTruthy();
    expect(within(rowFor('Carrier')).getByText('afloat')).toBeTruthy();
  });
});
