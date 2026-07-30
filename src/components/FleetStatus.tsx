import { isShipSunk } from '../game/engine';
import { SHIP_SPECS, type Board, type Ship } from '../game/types';

interface FleetStatusProps {
  board: Board;
  title: string;
  /** Owner view shows hit progress; opponent view only reveals sunk ships. */
  view: 'owner' | 'opponent';
}

function shipStatus(
  view: 'owner' | 'opponent',
  ship: Ship | undefined,
  sunk: boolean,
): string {
  if (view === 'opponent') return sunk ? 'sunk' : 'afloat';
  if (!ship) return 'not placed';
  return sunk ? 'sunk' : `${ship.hits.length}/${ship.length}`;
}

export function FleetStatus({ board, title, view }: FleetStatusProps) {
  return (
    <div className="fleet-status">
      <h3>{title}</h3>
      <ul>
        {SHIP_SPECS.map((spec) => {
          const ship = board.ships.find((s) => s.name === spec.name);
          const sunk = ship ? isShipSunk(ship) : false;
          const status = shipStatus(view, ship, sunk);
          return (
            <li key={spec.name} className={sunk ? 'ship-sunk' : undefined}>
              <span>
                {spec.name} ({spec.length})
              </span>
              <span className="ship-state">{status}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
