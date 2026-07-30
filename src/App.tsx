import { useEffect, useState } from 'react';
import './App.css';
import { BoardGrid } from './components/BoardGrid';
import { FleetStatus } from './components/FleetStatus';
import {
  computerFire,
  createGame,
  nextShipToPlace,
  placePlayerShip,
  placeRandomPlayerFleet,
  playerFire,
  toggleOrientation,
} from './game/state';

const COMPUTER_TURN_DELAY_MS = 600;

export default function App() {
  const [game, setGame] = useState(() => createGame());

  useEffect(() => {
    if (game.phase !== 'computer-turn') return;
    const timer = setTimeout(() => setGame((current) => computerFire(current)), COMPUTER_TURN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game.phase]);

  const placing = nextShipToPlace(game);
  const status =
    game.phase === 'placement'
      ? `Place your ${placing} (${game.orientation})`
      : game.phase === 'player-turn'
        ? 'Your turn — fire at the enemy fleet'
        : game.phase === 'computer-turn'
          ? 'Computer is taking aim…'
          : game.winner === 'player'
            ? 'You win! The enemy fleet is destroyed.'
            : 'You lose. Your fleet has been destroyed.';

  return (
    <main className="app">
      <header>
        <h1>Battleship</h1>
        <p className="status" role="status">
          {status}
        </p>
        {game.notice && (
          <p className="notice" role="alert">
            {game.notice}
          </p>
        )}
        <div className="controls">
          {game.phase === 'placement' && (
            <>
              <button type="button" onClick={() => setGame(toggleOrientation(game))}>
                Rotate ({game.orientation})
              </button>
              <button type="button" onClick={() => setGame(placeRandomPlayerFleet(game))}>
                Place randomly
              </button>
            </>
          )}
          <button type="button" onClick={() => setGame(createGame())}>
            New game
          </button>
        </div>
      </header>

      <div className="boards">
        <div className="board-column">
          <BoardGrid
            label="Your fleet"
            board={game.playerBoard}
            view="owner"
            preview={
              game.phase === 'placement' && placing
                ? { name: placing, orientation: game.orientation }
                : undefined
            }
            disabled={game.phase !== 'placement'}
            onCellClick={
              game.phase === 'placement'
                ? (cell) => setGame((current) => placePlayerShip(current, cell))
                : undefined
            }
          />
          <FleetStatus board={game.playerBoard} title="Your ships" view="owner" />
        </div>

        <div className="board-column">
          <BoardGrid
            label="Enemy waters"
            board={game.computerBoard}
            view="opponent"
            disabled={game.phase !== 'player-turn'}
            onCellClick={
              game.phase === 'player-turn'
                ? (cell) => setGame((current) => playerFire(current, cell))
                : undefined
            }
          />
          <FleetStatus board={game.computerBoard} title="Enemy ships" view="opponent" />
        </div>
      </div>

      <section className="log" aria-label="Battle log">
        <h3>Battle log</h3>
        <ul>
          {[...game.log].reverse().map((entry, index) => (
            <li key={game.log.length - index}>{entry}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
