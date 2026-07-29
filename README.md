# Battleship

Single-player Battleship: you against the computer. React + TypeScript front end on top of a
pure, framework-free game engine.

## Rules implemented

- 10x10 grid per player, columns `A`–`J`, rows `1`–`10`
- Standard fleet: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2)
- Ships are placed horizontally or vertically; overlaps and out-of-bounds placements are rejected
- Turn-based firing reports `miss`, `hit`, `sunk` (with the ship name), or `game-over` when a
  player's whole fleet is destroyed
- Repeat shots and off-board shots are rejected

## Getting started

Requires Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev      # dev server on http://localhost:5173
npm test         # unit tests
npm run lint     # oxlint
npm run typecheck
npm run build
```

## Deployment

Every push to `main` builds and publishes the app to GitHub Pages via
`.github/workflows/deploy.yml`. Enable it once under **Settings → Pages → Build and deployment →
Source: GitHub Actions**; the site is then served at
`https://<owner>.github.io/devin-demo-battleship/`. The workflow builds with `GITHUB_PAGES=true`,
which sets Vite's `base` to the repository subpath (local dev still serves from `/`).

## Playing

1. Click a cell on **Your fleet** to place the highlighted ship; **Rotate** switches
   horizontal/vertical, **Place randomly** drops the whole fleet for you.
2. Once all five ships are down, click a cell in **Enemy waters** to fire.
3. The computer answers on its turn: it hunts around its own hits and otherwise fires at random
   untried cells on a checkerboard pattern.
4. First side to sink all five enemy ships wins.

## Layout

| Path | Purpose |
| --- | --- |
| `src/game/types.ts` | Board/ship/result types, ship specs, error types |
| `src/game/engine.ts` | Placement validation, firing, sunk/win detection (pure, immutable) |
| `src/game/ai.ts` | Random fleet generation and computer target selection |
| `src/game/state.ts` | Phase/turn orchestration used by the UI |
| `src/components/` | `BoardGrid`, `FleetStatus` |
| `src/App.tsx` | Screen layout, turn scheduling, battle log |

The engine never mutates its inputs: `placeShip` and `fireAt` return new boards, so the UI just
swaps state. Both take an injectable random function, which keeps the AI and fleet generation
deterministic under test.
