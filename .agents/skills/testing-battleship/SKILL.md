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
- Invalid placements (overflow/overlap) are silent no-ops: assert on the *status line* and the fleet panel
  ("not placed"), not on an error message. The only feedback is the red hover preview
  (`cell-preview-invalid`), and it is clipped to the board, so hovering H1 with the Carrier highlights
  only H1–J1, never the 5-cell footprint that failed.
- Cells are only disabled *per phase*, never per cell state: during your turn an already-fired enemy cell
  stays `disabled=false` and re-clicking it is a completely silent no-op (no log entry, no status change).
  Assert on the battle-log entry count plus the status text to prove "nothing happened".
- The `Enemy ships` panel is the same component as `Your ships`, so it shows a partial per-ship hit
  counter (e.g. `Battleship (4) 1/4`) as soon as a hit lands — it leaks which enemy ship was hit before
  it sinks (documented in `DEBUGGING.md` finding A). If a PR claims to fix this, assert the opponent
  panel only ever shows `sunk` / `afloat`, never `N/L`.
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
- Careful: "Place randomly" re-randomises the **whole** fleet, discarding ships you placed manually. Do
  manual-placement assertions first, then use it to finish.

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

## Devin Secrets Needed
None.
