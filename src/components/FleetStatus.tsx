import { isShipSunk } from '../game/engine';
import { SHIP_SPECS, type Board } from '../game/types';

interface FleetStatusProps {
  board: Board;
  title: string;
}

export function FleetStatus({ board, title }: FleetStatusProps) {
  return (
    <div className="fleet-status">
      <h3>{title}</h3>
      <ul>
        {SHIP_SPECS.map((spec) => {
          const ship = board.ships.find((s) => s.name === spec.name);
          const sunk = ship ? isShipSunk(ship) : false;
          const status = !ship ? 'not placed' : sunk ? 'sunk' : `${ship.hits.length}/${ship.length}`;
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
