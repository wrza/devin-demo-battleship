---
name: testing-battleship
description: How to run and end-to-end test the single-player Battleship web app (Vite + React + TS), including the GitHub Pages subpath build.
---

# Testing the Battleship app

## Running it
- Node 22 required (Vite 8). `source ~/.nvm/nvm.sh && nvm use default` (v22.12.0; `.nvmrc` pins it). The default shell node may be 20.x and will fail.
- Dev: `npm run dev` → http://localhost:5173. No auth, no backend, no secrets.
- Pages/production build: `GITHUB_PAGES=true npm run build` (sets Vite `base` to `/devin-demo-battleship/`).
  **Set `GITHUB_PAGES=true` for `npm run preview` too**, otherwise `base` falls back to `/`, the preview
  server SPA-falls-back to `index.html` for `/devin-demo-battleship/assets/*.js` and you get a blank white
  page that looks like an app bug but isn't. Then open http://localhost:4173/devin-demo-battleship/.
- Vite here binds IPv6 `[::1]` only: `curl http://127.0.0.1:5173` may fail while `curl 'http://[::1]:5173'` works.
  Use `localhost` in the browser, or add `--host` if you need IPv4.

## Driving the UI
- Every board cell is a `<button>` with `aria-label="Your fleet A1: empty"` / `"Enemy waters C2: hit"`.
  Cell state is one of `empty | ship | miss | hit`, so the whole game state is readable from the DOM —
  no need for React internals. Status line is `[role="status"]`; log entries are
  `[aria-label="Battle log"] li` (newest first). Fleet panels are the `<ul>` after the
  `Your ships` / `Enemy ships` `<h3>`; sunk ships render the text `sunk` with a strikethrough.
- Cells are `disabled` outside the phase that owns them, so "click is ignored" checks are meaningful:
  enemy cells are disabled during placement and after game over; player cells are disabled during battle.
- Rejected actions surface a `role="alert"` notice line under the status (DEBUGGING.md finding E, fixed):
  an invalid placement shows e.g. `The Carrier does not fit there.` / `The Battleship would overlap
  another ship.`, a repeat shot shows `You already fired at A1.`, and the next accepted action clears it.
  Assert on `[role="alert"]` — the board/log/status must stay unchanged. The red hover preview
  (`cell-preview-invalid`) still exists and is clipped to the board (hovering H1 with the Carrier
  reddens only H1–J1).
- Already-fired cells (`hit`/`miss` state) are `disabled` in every phase, on top of the per-phase
  disabling. To reproduce the old "silent repeat shot" regression, assert a fired enemy cell has
  `disabled=true` during your turn.
- The `Enemy ships` panel is opponent-view only (finding A, fixed): it shows `afloat` or `sunk`, never a
  partial `N/L` counter and never `not placed`. `Your ships` still shows `N/L` progress. Regression
  check: after a hit that doesn't sink, the log says `hit!` and the enemy panel must still read `afloat`
  for every un-sunk ship (`FleetStatus.test.tsx` covers this in jsdom).
- Reading state compactly is much cheaper than dumping the DOM: one `page.evaluate`/console snippet
  returning `{status, logs, enemyPanel, yourPanel, grids}` keyed by `aria-label` is enough for every
  assertion, and keeps clicks (which the user watches) in the real UI.

## Live GitHub Pages site
- Deployed at https://wrza.github.io/devin-demo-battleship/ (Pages source = "GitHub Actions"). It is a static
  client-side app, so the live site can be tested exactly like localhost — no auth, no API.
- To prove assets resolve under the subpath, run in the console:
  `performance.getEntriesByType('resource').map(r => [r.name, r.responseStatus])` — every entry should be 200.
  A blank page with a 404 on `/devin-demo-battleship/assets/index-*.js` means a base-path/deploy problem.
- The CDP helper works against the live page too; just match the page by URL substring
  `wrza.github.io/devin-demo-battleship` instead of the localhost port.
- "Place randomly" now **keeps** manually placed ships and only fills in the missing ones (finding D,
  fixed; `completeFleet` in `src/game/ai.ts`), and it is a no-op outside the placement phase.
  Regression check: place the Carrier at A1 by hand, click "Place randomly", and assert A1–E1 are still
  ship cells and the phase advanced to battle.

## Reaching a game over quickly
Playing 17+ hits by hand is slow. Connect Playwright over CDP to the already-open browser and click the
real cells (keeps evidence honest and visible in a recording):
- Python Playwright is usually already importable on the box (`python3 -c "import playwright"`); otherwise
  `npm i playwright-core` in a temp dir (no browser download needed). Use
  `chromium.connect_over_cdp('http://localhost:29229')` and pick the page whose URL matches the app.
- Drive it in the browser window the human sees (`page.bring_to_front()`) so a recording shows real clicks.
- Cheap way to catch engine/UI anomalies while playing: after every shot assert exactly one
  `You fired…` + one `Computer fired…` new log line, that the named cell's `aria-label` state matches the
  outcome, that marked-cell count equals shot count on each board, and that a `sunk the <Ship>` line flips
  exactly one fleet-panel row to `sunk`. A win game of ~54 shots produced zero violations.
- The computer AI (`src/game/ai.ts`) is checkerboard + hunt-adjacent, so a naive full-grid sweep usually
  **loses** first. Use the same hunt-and-target strategy (probe neighbours of un-sunk hits, otherwise
  checkerboard) and wait ~750 ms after each shot for the computer's reply (`COMPUTER_TURN_DELAY_MS = 600`).
  Expect ~60 shots per game; a loss is a valid game over — click "New game", use "Place randomly" (a
  spread-out fleet survives longer) and retry to also demonstrate the win state.

## Regression tests for the DEBUGGING.md findings
All of findings A–G are fixed with unit/UI regression tests — run `npm test` first; the suite covers:
- A: opponent fleet panel never leaks hit progress (`src/components/FleetStatus.test.tsx`).
- B: `allShipsSunk` works for any non-empty fleet size, `game-over` fires on the exact final shot of a
  non-standard fleet, and an empty board is never a win (`src/game/engine.test.ts`).
- C: `placeRandomPlayerFleet` is a no-op outside the placement phase (`src/game/state.test.ts`).
- D: manual placements survive "Place randomly" (state test + `src/App.test.tsx`).
- E: rejected placements/shots set `state.notice` with the reason and the UI renders it as an alert;
  fired cells are disabled (`src/game/state.test.ts`, `src/App.test.tsx`).
- F: `computerFire` survives a throwing `Random` and returns the turn to the player
  (`src/game/state.test.ts`).
- G: `randomFleet(() => 1)` produces a valid fleet (`src/game/ai.test.ts`).
Finding H (ARIA grid semantics) is still open — the grid is `role="grid"` → `role="row"` → bare
buttons without `gridcell`, so don't rely on grid-navigation semantics in tests; use the buttons'
`aria-label`s.

## Devin Secrets Needed
None.
