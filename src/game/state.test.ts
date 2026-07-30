import { describe, expect, it } from 'vitest';
import type { Random } from './ai';
import { fireAt, isFleetComplete } from './engine';
import {
  computerFire,
  createGame,
  nextShipToPlace,
  placePlayerShip,
  placeRandomPlayerFleet,
  playerFire,
  toggleOrientation,
  type GameState,
} from './state';
import { SHIP_SPECS, type Coordinate } from './types';

function seeded(seed: number): Random {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function placeFleetInRows(state: GameState): GameState {
  return SHIP_SPECS.reduce(
    (current, _spec, index) => placePlayerShip(current, { row: index, col: 0 }),
    state,
  );
}

describe('game setup', () => {
  it('starts in the placement phase with a full computer fleet', () => {
    const game = createGame(seeded(1));

    expect(game.phase).toBe('placement');
    expect(isFleetComplete(game.computerBoard)).toBe(true);
    expect(game.playerBoard.ships).toHaveLength(0);
    expect(nextShipToPlace(game)).toBe('Carrier');
  });

  it('advances through the fleet as ships are placed and then starts the battle', () => {
    let game = createGame(seeded(1));
    game = placePlayerShip(game, { row: 0, col: 0 });

    expect(nextShipToPlace(game)).toBe('Battleship');
    expect(game.phase).toBe('placement');

    game = placeFleetInRows(game);
    expect(isFleetComplete(game.playerBoard)).toBe(true);
    expect(game.phase).toBe('player-turn');
  });

  it('rejects invalid placements with an explanatory notice', () => {
    const game = createGame(seeded(1));
    const offBoard = placePlayerShip(game, { row: 0, col: 9 });

    expect(offBoard.playerBoard).toBe(game.playerBoard);
    expect(offBoard.placingIndex).toBe(game.placingIndex);
    expect(offBoard.log).toBe(game.log);
    expect(offBoard.notice).toBe('The Carrier does not fit there.');

    const placed = placePlayerShip(game, { row: 0, col: 0 });
    const overlapping = placePlayerShip(placed, { row: 0, col: 0 });
    expect(overlapping.playerBoard).toBe(placed.playerBoard);
    expect(overlapping.notice).toBe('The Battleship would overlap another ship.');
  });

  it('clears the notice on the next accepted action', () => {
    const game = createGame(seeded(1));
    const rejected = placePlayerShip(game, { row: 0, col: 9 });
    expect(rejected.notice).toBeDefined();

    const accepted = placePlayerShip(rejected, { row: 0, col: 0 });
    expect(accepted.notice).toBeUndefined();
  });

  it('toggles orientation and places vertically', () => {
    const game = toggleOrientation(createGame(seeded(1)));
    expect(game.orientation).toBe('vertical');

    const placed = placePlayerShip(game, { row: 0, col: 0 });
    expect(placed.playerBoard.ships[0].cells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 },
      { row: 4, col: 0 },
    ]);
  });

  it('can place the player fleet at random', () => {
    const game = placeRandomPlayerFleet(createGame(seeded(1)), seeded(9));

    expect(isFleetComplete(game.playerBoard)).toBe(true);
    expect(game.phase).toBe('player-turn');
  });

  it('keeps manually placed ships when the rest of the fleet is placed at random', () => {
    let game = createGame(seeded(1));
    game = placePlayerShip(game, { row: 0, col: 0 });
    game = placePlayerShip(game, { row: 2, col: 0 });
    const carrier = game.playerBoard.ships.find((s) => s.name === 'Carrier')!;
    const battleship = game.playerBoard.ships.find((s) => s.name === 'Battleship')!;

    const completed = placeRandomPlayerFleet(game, seeded(9));

    expect(isFleetComplete(completed.playerBoard)).toBe(true);
    expect(completed.playerBoard.ships.find((s) => s.name === 'Carrier')!.cells).toEqual(
      carrier.cells,
    );
    expect(
      completed.playerBoard.ships.find((s) => s.name === 'Battleship')!.cells,
    ).toEqual(battleship.cells);
    expect(completed.phase).toBe('player-turn');
  });

  it('only places the fleet at random during the placement phase', () => {
    const game = placeFleetInRows(createGame(seeded(1)));
    expect(game.phase).toBe('player-turn');

    expect(placeRandomPlayerFleet(game, seeded(9))).toBe(game);

    const over: GameState = { ...game, phase: 'game-over', winner: 'player' };
    expect(placeRandomPlayerFleet(over, seeded(9))).toBe(over);
  });
});

describe('turn taking', () => {
  it('passes the turn to the computer after the player fires, and back again', () => {
    let game = placeFleetInRows(createGame(seeded(1)));

    game = playerFire(game, { row: 9, col: 9 });
    expect(game.phase).toBe('computer-turn');
    expect(game.computerBoard.shots).toHaveLength(1);

    game = computerFire(game, seeded(4));
    expect(game.phase).toBe('player-turn');
    expect(game.playerBoard.shots).toHaveLength(1);
  });

  it('ignores player shots outside the player turn and repeated shots', () => {
    let game = placeFleetInRows(createGame(seeded(1)));
    game = playerFire(game, { row: 0, col: 0 });

    const duringComputerTurn = playerFire(game, { row: 5, col: 5 });
    expect(duringComputerTurn).toBe(game);

    game = computerFire(game, seeded(4));
    const repeat = playerFire(game, { row: 0, col: 0 });
    expect(repeat.computerBoard).toBe(game.computerBoard);
    expect(repeat.phase).toBe('player-turn');
    expect(repeat.log).toBe(game.log);
    expect(repeat.notice).toBe('You already fired at A1.');
  });

  it('returns the turn to the player when the computer cannot fire', () => {
    let game = placeFleetInRows(createGame(seeded(1)));
    game = playerFire(game, { row: 9, col: 9 });
    expect(game.phase).toBe('computer-turn');

    // A Random that always throws stands in for any engine failure mid-turn.
    const broken: Random = () => {
      throw new Error('boom');
    };
    const recovered = computerFire(game, broken);

    expect(recovered.phase).toBe('player-turn');
    expect(recovered.playerBoard).toBe(game.playerBoard);
    expect(recovered.winner).toBeUndefined();
  });

  it('logs hits, misses and sinkings', () => {
    let game = placeFleetInRows(createGame(seeded(1)));
    const target = game.computerBoard.ships.find((ship) => ship.name === 'Destroyer')!;

    game = playerFire(game, target.cells[0]);
    expect(game.log.at(-1)).toMatch(/hit!/);

    game = computerFire(game, seeded(4));
    game = playerFire(game, target.cells[1]);
    expect(game.log.at(-1)).toMatch(/sunk the Destroyer!/);
  });
});

describe('win and loss detection', () => {
  function sinkAllComputerShips(game: GameState): Coordinate[] {
    return game.computerBoard.ships.flatMap((ship) => ship.cells);
  }

  it('declares the player the winner once every computer ship is sunk', () => {
    let game = placeFleetInRows(createGame(seeded(1)));
    const targets = sinkAllComputerShips(game);

    for (const target of targets) {
      game = playerFire(game, target);
      if (game.phase === 'computer-turn') {
        // Skip the computer's reply so the player can never lose first in this test.
        game = { ...game, phase: 'player-turn' };
      }
    }

    expect(game.phase).toBe('game-over');
    expect(game.winner).toBe('player');
    expect(game.log.at(-1)).toMatch(/fleet destroyed/);
  });

  it('declares the computer the winner once every player ship is sunk', () => {
    let game = placeFleetInRows(createGame(seeded(1)));
    game = { ...game, phase: 'computer-turn' };

    for (let i = 0; i < 100 && game.phase !== 'game-over'; i += 1) {
      game = computerFire(game, seeded(11 + i));
      if (game.phase === 'player-turn') game = { ...game, phase: 'computer-turn' };
    }

    expect(game.phase).toBe('game-over');
    expect(game.winner).toBe('computer');
  });

  it('stops accepting fire after the game is over', () => {
    let game = placeFleetInRows(createGame(seeded(1)));
    game = { ...game, phase: 'game-over', winner: 'player' };

    expect(playerFire(game, { row: 0, col: 0 })).toBe(game);
    expect(computerFire(game, seeded(1))).toBe(game);
  });

  it('does not end the game when only some ships are sunk', () => {
    let game = placeFleetInRows(createGame(seeded(1)));
    const carrier = game.computerBoard.ships.find((s) => s.name === 'Carrier')!;
    let board = game.computerBoard;
    for (const cell of carrier.cells) board = fireAt(board, cell).board;
    game = { ...game, computerBoard: board };

    expect(game.phase).toBe('player-turn');
    expect(game.winner).toBeUndefined();
  });
});
