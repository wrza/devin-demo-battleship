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
  ("not placed"), not on an error message.

## Reaching a game over quickly
Playing 17+ hits by hand is slow. Connect Playwright over CDP to the already-open browser and click the
real cells (keeps evidence honest and visible in a recording):
- `npm i playwright-core` in a temp dir (no browser download needed),
  `chromium.connectOverCDP('http://localhost:29229')`, pick the page whose URL matches the app.
- The computer AI (`src/game/ai.ts`) is checkerboard + hunt-adjacent, so a naive full-grid sweep usually
  **loses** first. Use the same hunt-and-target strategy (probe neighbours of un-sunk hits, otherwise
  checkerboard) and wait ~750 ms after each shot for the computer's reply (`COMPUTER_TURN_DELAY_MS = 600`).
  Expect ~60 shots per game; a loss is a valid game over — click "New game", use "Place randomly" (a
  spread-out fleet survives longer) and retry to also demonstrate the win state.

## Devin Secrets Needed
None.
