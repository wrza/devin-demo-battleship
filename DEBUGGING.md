# DEBUGGING.md

An audit of this repository as it exists at `5171f46` (plus the two open skill branches), written
from the artifacts — commit diffs, the current source, and code executed against the scenarios
below. It is not written from memory of building the app, and it does not defer to the "no
application defects found" claim posted on PR #1.

Summary up front: **the core game loop is correct.** Placement flush against edges and corners,
adjacent ships, sinking a ship whose cells touch another ship, and the win condition on the exact
final shot all behave correctly and were verified empirically. What the audit did turn up is one
rules-fidelity defect (the enemy fleet panel publishes information the rules of Battleship hide),
several latent robustness gaps that only survive because the UI happens not to reach them, and
three places where a symptom was worked around instead of a cause — including one that is codified
in the test suite as intended behaviour.

Nothing found here corrupts a game in progress or makes the game unwinnable.

> **Status update.** Findings A–G were fixed in the follow-up PR that accompanies this revision of
> the document, each with a regression test; the per-finding "How it was fixed" sections below
> describe the actual fix. Finding H (ARIA grid semantics) remains open.

---

## 1. Method

- `git log` was read in full: the history is four commits (`a30c5f4`, `1d65e48`, `c33326f`,
  merge `5171f46`) plus two commits on unmerged branches that only add
  `.agents/skills/testing-battleship/SKILL.md`. Every commit was diffed against its parent.
- PR #1's conversation was read, including the one Devin Review finding and the two end-to-end
  test reports.
- Behaviour was measured by extracting the real modules (no reimplementation) into throwaway
  probe suites run with `vitest`, and by building and serving the production bundle. The probe
  files were deleted after the numbers below were collected; every number in this document is
  output from running the code in this repository, and each finding names the probe that produced
  it so it can be rebuilt from the snippets included below.
- Baseline for the record: `npm run lint`, `npm run typecheck` clean, `npm test` → 43 passed,
  `GITHUB_PAGES=true npm run build` succeeds, on Node 22.12.0.

---

## 2. Commit-by-commit behavioural review

### `a30c5f4` — "Initialize repository"

Adds `.gitignore` only (logs, `node_modules`, `dist`, `dist-ssr`, `*.local`, editor files). No
behavioural change. `dist` being ignored matters later only in that the deployed bundle is never
committed, so the Pages workflow is the only producer of the published artifact.

### `1d65e48` — "Add single-player Battleship game with React UI, engine tests and Pages deploy"

29 files, 4596 insertions. The entire application, the entire test suite, both CI workflows and
all tooling config arrive in one commit, so there is no incremental history to diff for this
code — "what changed behaviourally" here is "everything", and the only way to review it is to
audit the result. Worth stating plainly: this commit is not reviewable as a diff, and any bug
introduced during its development is invisible in the history. Sections 3–5 are that audit.

What the commit message does not say, and what the diff does say:

- `allShipsSunk` does not mean "all ships are sunk". It means "there are exactly
  `SHIP_SPECS.length` ships and all of them are sunk" (`engine.ts:107`). See finding **B**.
- The turn engine returns the *same object* for every rejected action (bad placement, out-of-turn
  fire, repeat shot). That is a deliberate contract, but it is implemented with bare `catch {}`
  blocks that throw away `PlacementError.reason` and `InvalidShotError`, so no caller can ever
  explain a rejection. See finding **E**.
- `placeRandomPlayerFleet` is the only state transition with **no phase guard** (`state.ts:93`),
  which is inconsistent with the contract the other three transitions implement. See finding **C**.
- `FleetStatus` is rendered for both fleets and reads `board.ships` directly, bypassing the
  `opponentCellState` abstraction the board grid uses to hide enemy ships. See finding **A**.
- `state.ts:144` exports `isGameOver`, which nothing calls. It is the function whose vacuous-truth
  problem motivated the `isFleetComplete` guard in `allShipsSunk`; see section 5.1.
- `computerFire` calls `chooseShot`/`fireAt` unguarded while `playerFire` wraps them in
  `try/catch` (`state.ts:107` vs `state.ts:128`). See finding **F**.

### `c33326f` — "Let in-flight Pages deployments finish instead of cancelling them"

One line: `concurrency.cancel-in-progress: true → false` in `.github/workflows/deploy.yml`. This
is a genuine cause fix (Devin Review flagged that a new push could abort a publish mid-flight),
and the message is accurate. The behavioural change it does not mention: deploys now **queue**
instead of being superseded, so N pushes in quick succession serialize into N publishes and the
site can lag several minutes behind `main` rather than jumping to the newest commit. That is the
right trade for a Pages site, but it is a change in deployment latency, not only in safety.

### `5171f46` — merge of PR #1

A true merge commit of the two commits above; no squash, no conflict resolution, no content of its
own.

### `09d4a70`, `67e7cd3` (branches `devin/update-skills-*`, both open)

Add `.agents/skills/testing-battleship/SKILL.md`. Documentation only — no application change — but
the content is evidence: it documents three workarounds instead of fixes (`GITHUB_PAGES=true` for
`preview`, "invalid placements are silent no-ops, assert on the status line instead", "'Place
randomly' discards ships you placed manually"). Sections 5.2 and 5.3 treat those as findings.

---

## 3. Findings

Severity is stated for the app as it ships today, with the latent risk called out separately.

### A. The enemy fleet panel publishes which enemy ship you hit — Medium (rules correctness)

**What I saw.** One shot into open enemy water that happened to hit, and the *Enemy ships* panel
immediately read:

```
Carrier (5)     0/5
Battleship (4)  0/4
Cruiser (3)     0/3
Submarine (3)   1/3      <-- log line was only "You fired at E1: hit!"
Destroyer (2)   0/2
```

**What I expected.** Battleship hides ship identity until a ship is sunk. A hit is "hit", nothing
more. The engine agrees with that reading: `opponentCellState` exists specifically so the enemy
grid renders un-hit ship cells as `empty`, and `fireAt` only fills in `sunkShip` on the sinking
shot. The UI should not know more than the engine is willing to tell an opponent.

**Cause.** `FleetStatus` (`src/components/FleetStatus.tsx:15-17`) is rendered for both fleets with
nothing but a different `title`, and it reads the defender's `board.ships` array directly:
`${ship.hits.length}/${ship.length}`. There is no owner/opponent mode, so the abstraction that
hides enemy ships on the grid is bypassed in the panel next to it. The board grid is correct; the
panel beside it leaks.

**Measured impact.** Over 200 simulated games, the panel reveals a ship's identity on average
**6.1 player shots before the sinking shot** that is allowed to reveal it (n=863 ships). Two or
more enemy ships are wounded simultaneously on **2.4% of shots** (242 of 10,145), and in 236 of
those cases wounded cells of *different* ships were orthogonally adjacent — exactly the ambiguity
real Battleship relies on, resolved for free by the panel.

Being direct about the size of the effect: it is a spoiler, not a balance break. I gave a
hunt-and-target player the panel's per-ship hit attribution and ran it against 400 identical
fleets alongside the same player restricted to rules-legal information:

```
with the panel's per-ship hit attribution: 51.22 shots to destroy the fleet
with only rules-legal information:         50.89 shots
panel information helped in 22/400 games (6%)
```

So the leak is worth roughly **zero shots** to a competent player (the small difference is
targeting-order noise, and it went the wrong way), because the ambiguous situations it resolves
are rare. It is a fidelity defect that spoils information, not an exploit.

**How it was fixed.** `FleetStatus` now takes a `view: 'owner' | 'opponent'` prop, mirroring
`cellState` vs `opponentCellState`: the opponent view renders only `sunk` / `afloat`, never a hit
counter and never `not placed`. `FleetStatus.test.tsx` asserts the opponent view never shows a
partial count for a wounded ship.

### B. `allShipsSunk` silently requires exactly five ships — Low today, latent trap

**What I saw.** A fully destroyed fleet that reports "not all ships sunk", and a `fireAt` that
returns `sunk` rather than `game-over` on the shot that destroys the last ship:

```
fleet of 1: every ship sunk=true  lastOutcome=sunk       allShipsSunk=false
fleet of 2: every ship sunk=true  lastOutcome=sunk       allShipsSunk=false
fleet of 3: every ship sunk=true  lastOutcome=sunk       allShipsSunk=false
fleet of 4: every ship sunk=true  lastOutcome=sunk       allShipsSunk=false
fleet of 5: every ship sunk=true  lastOutcome=game-over  allShipsSunk=true
```

**What I expected.** `allShipsSunk(board)` to mean what it says for any non-empty board. A board
whose every ship is sunk is a destroyed fleet; a four-ship variant, or a fleet trimmed for a test
fixture, should still end the game.

**Cause.** `engine.ts:107` — `isFleetComplete(board) && board.ships.every(isShipSunk)`, where
`isFleetComplete` is `board.ships.length === SHIP_SPECS.length`. This exists because
`[].every(...)` is `true`, so an empty board would otherwise report itself destroyed during the
placement phase. The guard fixes that symptom by hard-coding the standard fleet size into the
win condition. Consequence: `fireAt` can never emit `game-over` for any fleet that is not exactly
five ships, so such a game never ends. See section 5.1 — this is a workaround, not a fix.

**Impact today.** Not reachable through the UI: both boards are always full standard fleets
(`randomFleet` places all of `SHIP_SPECS`; the player cannot start the battle until
`isFleetComplete`). The severity is entirely in what happens the first time someone adds a
variant fleet or a smaller test fixture — the game will hang silently at "one ship left" with no
error anywhere.

**How it was fixed.** `allShipsSunk` is now `board.ships.length > 0 && board.ships.every(isShipSunk)`
— the `ships.length > 0` guard fixes the vacuous-truth case at the cause without hard-coding the
fleet size. The `engine.test.ts` test that locked the workaround in (see 5.1) was inverted to
assert the correct semantics, and new tests cover `game-over` on the final shot of a non-standard
fleet and the empty board.

### C. `placeRandomPlayerFleet` has no phase guard — Low today, latent

**What I saw.** Calling it mid-battle discards the battle; calling it after a loss un-loses it:

```
before:  phase=player-turn  shots taken against the player=1
after:   phase=player-turn  shots taken against the player=0     (fresh fleet, damage erased)
from game-over(winner=computer) -> phase=player-turn, winner still 'computer'
```

**What I expected.** The same contract every other transition honours: `placePlayerShip`,
`playerFire` and `computerFire` all return the state unchanged when called in the wrong phase.
This one should return `state` unless `state.phase === 'placement'`.

**Cause.** `state.ts:93-104` sets `playerBoard`, `placingIndex` and `phase: 'player-turn'`
unconditionally, and leaves `winner` untouched — so the "revived" state is also internally
inconsistent (`phase: 'player-turn'` with `winner: 'computer'`).

**Impact today.** Not reachable: `App.tsx:46` only renders the "Place randomly" button while
`game.phase === 'placement'`. The invariant is enforced by JSX, not by the state machine, so the
first extra call site (a keyboard shortcut, a "reroll" button, an undo) reintroduces it.

**How it was fixed.** `placeRandomPlayerFleet` now starts with
`if (state.phase !== 'placement') return state;`, the same contract as every other transition,
with a regression test calling it from `player-turn` and `game-over`.

### D. "Place randomly" destroys manual placements without warning — Low (UX)

**What I saw.** Placed the Carrier and Battleship by hand (9 occupied cells), clicked
*Place randomly*: **0 of the 9 manually occupied cells survived**, the whole fleet was
re-randomised, and the only trace was the log line "Fleet placed at random. Fire at the enemy
waters!" — nothing says the previous placements were discarded.

**What I expected.** Either "place the ships I haven't placed yet" (the button sits in the
placement toolbar next to *Rotate*, which acts on the ship being placed), or an explicit warning.

**Cause.** `placeRandomPlayerFleet` calls `randomFleet()` for the whole fleet from scratch instead
of completing `state.playerBoard` from `state.placingIndex` onward.

**How it was fixed.** `placeRandomPlayerFleet` now calls a new `completeFleet(board, random)`
(`ai.ts`), which keeps the ships already on the board and randomly places only the missing ones;
`randomFleet` is now `completeFleet(createEmptyBoard())`. Manual placements survive the button,
verified at both the state layer and through the rendered UI. If completion is ever impossible the
state gets a `notice` instead of a crash. The skill file's warning was replaced accordingly.

### E. Rejected actions are silent, and the engine's reasons are thrown away — Low/Medium (UX)

**What I saw.** Two separate silences:

```
clicked H1 while placing the Carrier (needs H1..L1):
  status before "Place your Carrier (horizontal)" / after "Place your Carrier (horizontal)"
  battle log entries 1 -> 1

clicked an enemy cell that was already fired at (A1, aria-label "Enemy waters A1: hit"):
  button disabled=false   log entries before=4 after=4   status unchanged
```

**What I expected.** A rejected placement should say why ("Carrier doesn't fit there" — the engine
computes exactly that string), and a cell that cannot be fired at again should not be clickable.

**Cause.** `types.ts` defines `PlacementError` with a `reason` of `'out-of-bounds' | 'overlap' |
'duplicate-ship'` and `InvalidShotError` with a message; `state.ts:76` and `state.ts:114` both
discard them with `catch { return state; }`. Nothing on the way to the UI carries a rejection
reason, so `App.tsx` has nothing to render. Separately, `BoardGrid` disables cells per *phase*
(`disabled={game.phase !== 'player-turn'}`) but not per *cell state*, so already-fired cells stay
enabled and absorb clicks.

Mitigation that exists: the hover preview turns red for an invalid placement
(`cell-preview-invalid`), which covers the mouse case but not keyboard, touch, or "why did nothing
happen". That mitigation is itself partial: `previewCells` only marks cells that exist in the grid,
so hovering H1 with the Carrier reddens H1–J1 and the two cells that overflow the board are simply
not drawn — the feedback shows a 3-cell ship, not the 5-cell footprint that is being rejected
(confirmed in a browser).

**How it was fixed.** `GameState` gained a transient `notice` field: rejected placements map
`PlacementError.reason` to a human explanation ("The Carrier does not fit there.", "…would overlap
another ship."), repeat shots produce "You already fired at A1.", and any accepted action clears
it. `App.tsx` renders it as a `role="alert"` line under the status. Separately, `BoardGrid` now
disables any cell whose state is `hit` or `miss`, so a spent cell can no longer absorb clicks.
The clipped red preview still exists, but it is no longer the only feedback.

### F. `computerFire` is unguarded where `playerFire` is guarded — Low, latent

**What I saw.** `chooseShot` throws `No cells left to fire at` on an exhausted board, and
`computerFire` calls both `chooseShot` and `fireAt` without a `try/catch`, inside a `setTimeout`
callback in `App.tsx:22`. An exception there is not catchable by React, so it would leave the UI
stuck in "Computer is taking aim…" forever with an uncaught error in the console.

**What I expected.** Symmetry with `playerFire`, which swallows engine errors and returns the
state unchanged.

**Cause.** `state.ts:128-142` has no error handling.

**Impact today.** Empirically unreachable. Across 200 full simulated games the longest game was
134 turns and neither board ever ran out of legal cells (the 17 ship cells guarantee the game ends
by shot 100); a separate 50-fleet sweep of `chooseShot` never needed more than 100 shots to sink
a fleet. So this is a robustness gap, not a live bug — but it is the one place where a future
change (a "computer vs computer" mode, a smaller board, resuming a saved game) turns into an
unrecoverable UI.

**How it was fixed.** `computerFire` now wraps `chooseShot`/`fireAt` in a `try/catch`; on failure
it yields the turn back to the player (`phase: 'player-turn'`) instead of stranding the game in
`computer-turn`, with a regression test injecting a throwing `Random`.

### G. The injected `Random` contract is unenforced — Low

**What I saw.** `randomFleet(() => 1)` dies with
`TypeError: Cannot read properties of undefined (reading 'start')`.

**What I expected.** A clear error, or clamping. `Random = () => number` is a public seam
advertised in the README as the thing that makes the engine testable, so it should not corrupt on
a boundary value.

**Cause.** `ai.ts:22` — `items[Math.floor(random() * items.length)]` indexes out of bounds when
`random()` returns exactly `1`, and the `undefined` is then dereferenced by the caller.

**Impact.** `Math.random()` is specified as `[0, 1)`, so production never hits it; the exposure is
to test doubles and seeded generators written by future callers.

**How it was fixed.** `pick` now clamps the index with `Math.min(items.length - 1, …)` and throws
a clear error for an empty list. `randomFleet(() => 1)` now produces a valid fleet (tested).

### H. The board is not a valid ARIA grid — Low (accessibility)

**What I saw.** `BoardGrid` renders `role="grid"` → `role="row"` → bare `<button>`, with the
row/column header cells `aria-hidden="true"`.

**What I expected.** Rows to contain `role="gridcell"` (with the button inside), and headers to be
`columnheader`/`rowheader` rather than hidden.

**Cause.** `src/components/BoardGrid.tsx:56-95`.

**Impact.** Screen readers cannot navigate the grid as a grid. It is partly self-mitigating: each
button's `aria-label` spells out the coordinate and state ("Enemy waters C2: hit"), which is also
what makes the app easy to drive from tests. Low severity, real defect.

**How it was fixed.** Not fixed.

---

## 4. The scenarios where Battleship implementations commonly break

All four were run against the current code. All four **pass**. Reporting the passes in the same
detail as the failures, because "we tested for it and it holds" is the useful statement.

### 4.1 Legal placement flush against edges and corners — PASS

Every ship, at all four corners, in both orientations: 40/40 accepted. The corresponding
one-cell-past-the-edge placements: 10/10 rejected. Cells land exactly on the boundary — the
Carrier at `(5,9)` vertical occupies `(5,9)…(9,9)`, i.e. the bottom-right corner cell, not
`(10,9)`.

The stronger check is the total count of legal placements on an empty board, which catches an
off-by-one that corner spot-checks can miss (expected `2 × 10 × (11 − length)`):

| ship | length | legal placements | expected |
| --- | --- | --- | --- |
| Carrier | 5 | 120 | 120 |
| Battleship | 4 | 140 | 140 |
| Cruiser | 3 | 160 | 160 |
| Submarine | 3 | 160 | 160 |
| Destroyer | 2 | 180 | 180 |

`isInsideBoard` is applied to *every* generated cell rather than to the start plus a computed end,
which is why there is no off-by-one to find.

### 4.2 Two ships placed directly adjacent — PASS

Against a Carrier on `(4,0)…(4,4)`:

```
end-to-end, same row      (4,5) horizontal -> allowed
side-by-side, row below   (5,0) horizontal -> allowed
side-by-side, row above   (3,1) horizontal -> allowed
perpendicular, touching   (5,2) vertical   -> allowed
diagonal contact          (5,5) horizontal -> allowed
overlap by one cell       (4,4) horizontal -> rejected
perpendicular crossing    (1,3) vertical   -> rejected
```

Correct for standard rules: touching is legal, sharing a cell is not. Overlap detection compares
cell sets (`validatePlacement`), so it cannot be fooled by perpendicular crossings.

### 4.3 Sinking a ship whose cells touch another ship — PASS

Carrier `(4,0)…(4,4)`, Battleship `(5,0)…(5,3)` directly below it, Destroyer `(4,5)…(4,6)`
end-to-end with the Carrier. Firing the Carrier's five cells:

```
(4,0) hit   (4,1) hit   (4,2) hit   (4,3) hit   (4,4) sunk (Carrier)
```

After the sinking shot: Battleship hits `[]`, Destroyer hits `[]`, neither reported sunk,
`remainingShips` = `[Battleship, Destroyer]`, and the touching cells are still `ship` from the
owner's view and `empty` from the opponent's. Hits are attributed by locating the single ship that
owns the target cell (`fireAt`'s `findIndex`), and no adjacency or flood-fill logic exists to
bleed damage between hulls.

### 4.4 The win condition on the exact final shot — PASS

Five ships packed into rows 0–4, all 17 cells fired in order:

```
shot 5  sunk (Carrier)      allShipsSunk=false
shot 9  sunk (Battleship)   allShipsSunk=false
shot 12 sunk (Cruiser)      allShipsSunk=false
shot 15 sunk (Submarine)    allShipsSunk=false
shot 16 hit                 allShipsSunk=false
shot 17 game-over (Destroyer) allShipsSunk=true
```

Shots 1–16 never report `game-over` and never report `allShipsSunk`; shot 17 reports both, and
carries `sunkShip: 'Destroyer'` (a final shot is a sinking shot *and* the end of the game — the
UI needs both, and gets both). At the state layer the win fires on player shot **#17** exactly,
sets `winner: 'player'`, and after it both `playerFire` and `computerFire` return the identical
state object — so the computer gets no revenge shot after losing its last ship
(`playerBoard.shots` stayed at 0).

### 4.5 Whole-game invariants — PASS

200 full games driven through the real state machine (`createGame` → `placeRandomPlayerFleet` →
`playerFire`/`computerFire` until `game-over`):

```
player wins 102, computer wins 98, average 102.4 turns, longest 134 turns
```

Every game terminated, every game ended with a `winner` set and the loser's fleet actually all
sunk, no board ever recorded a duplicate shot, and no ship ever recorded more hits than its
length. The computer also never fires twice in one turn under `StrictMode` — the double-effect
mount was checked explicitly and the player's board accumulated exactly 1, 2, 3, 4, 5 marked
cells over five turns, because the effect's cleanup clears the pending timer.

---

## 5. Changes that suppress a symptom instead of fixing the cause

Stated plainly, including where the suppression is mine from the original build.

### 5.1 `allShipsSunk` was made fleet-size-aware to hide a vacuous-truth bug

`board.ships.every(isShipSunk)` is `true` for an empty board, so during the placement phase
`isGameOver` would have reported the game already over. Instead of fixing that at the cause — a
`ships.length > 0` guard, or simply not asking "is the game over" before the game starts — the
build added `isFleetComplete(board) &&` to `allShipsSunk` (`engine.ts:107`), hard-coding "a fleet
is exactly `SHIP_SPECS.length` ships" into the win condition.

Three things make this worse than it looks:

1. `isGameOver` (`state.ts:144`), the function that motivated the guard, is **dead code**. Nothing
   in the app or the tests calls it. The symptom being suppressed was never on a live path.
2. The suppression is silent and total: with a fleet of 1–4 ships, `fireAt` returns `sunk` on the
   shot that destroys the last ship and the game simply never ends (measured, finding B).
3. It is written into the test suite as intended behaviour —
   `engine.test.ts:251` "does not declare a win for an incomplete fleet whose ships are all sunk"
   asserts `allShipsSunk === false` for a fully destroyed one-ship fleet. The test locks the
   workaround in, so the cause-level fix now has to change a test, which is exactly the trap this
   kind of test creates. The PR description reinforced it: "`allShipsSunk` deliberately requires a
   *complete* fleet".

Resolved with finding B: the guard is now `ships.length > 0` and the locking test was inverted to
assert the correct semantics.

### 5.2 The Pages preview base-path problem was documented, not fixed

`package.json`'s `preview` script is plain `vite preview`, so it serves with `base: '/'` while the
Pages bundle it is serving was built with `base: '/devin-demo-battleship/'`. Measured on the real
build:

```
$ GITHUB_PAGES=true npm run build && npm run preview     # no env var on preview
GET /devin-demo-battleship/assets/index-Dz8jcJWC.js -> 200 text/html
<!doctype html><html lang="en">...          <-- index.html, not the module
```

HTTP 200 with `text/html`: the preview server's SPA fallback answers the asset request with
`index.html`, the module never executes, and the page renders blank. The response to this was to
write it into the skill file — "**Set `GITHUB_PAGES=true` for `npm run preview` too**, otherwise …
you get a blank white page that looks like an app bug but isn't" — and into the environment
blueprint notes, rather than to fix the script. The cause-level fix is a script that cannot be run
wrong, e.g. `"preview:pages": "GITHUB_PAGES=true vite preview"` (or reading the base from a single
source used by both build and preview). Documenting a trap for every future session is a
workaround, and the note itself admits the failure "looks like an app bug".

### 5.3 Two UI shortcomings were turned into testing instructions

The same skill file tells future sessions how to live with findings D and E instead of recording
them as defects:

- "Invalid placements (overflow/overlap) are silent no-ops: assert on the *status line* and the
  fleet panel ('not placed'), **not on an error message**." That is a test written to fit a
  missing feature (finding E), and it removes the pressure to add one.
- "Careful: 'Place randomly' re-randomises the **whole** fleet, discarding ships you placed
  manually." A known data-loss behaviour (finding D), documented as a hazard for the tester rather
  than as a bug for the developer.

### 5.4 The win-detection test skips the mechanism it claims to test

`state.test.ts:129` "declares the player the winner once every computer ship is sunk" reaches the
17th hit by overwriting the phase after every shot:

```ts
game = playerFire(game, target);
if (game.phase === 'computer-turn') {
  // Keep the computer from ever hitting: it fires into its own random cells,
  // but the game only ends when a full fleet is destroyed.
  game = { ...game, phase: 'player-turn' };
}
```

Two problems. The comment is wrong about how the code works: `computerFire` fires at
`state.playerBoard` via `chooseShot(state.playerBoard, …)` — the computer does not "fire into its
own random cells", it fires at the player, which is precisely why the test has to skip its turn.
And the mutation means the assertion never exercises the real alternating turn loop; it exercises
`playerFire` 17 times in a row. (My probe in section 4.4 does the same skipping, deliberately and
labelled as such, to isolate the boundary — the difference is that the repository's suite has no
other test that plays a full alternating game, so nothing covers the loop.)

A second test in the same file, `state.test.ts:168` "does not end the game when only some ships
are sunk", is vacuous: it mutates `computerBoard` by calling `fireAt` directly and then asserts
`phase === 'player-turn'` and `winner === undefined`. Since `playerFire` was never called, those
assertions hold no matter what the win logic does. It would pass against a completely broken win
condition.

The misleading comment was corrected alongside the A–G fixes; the phase-skipping shortcut and the
vacuous partial-sink test remain as-is (rewriting them is test-suite work beyond the bug fixes).

### 5.5 The PR's "no application defects found" claim was overstated

PR #1 carries two end-to-end reports concluding "No application defects found" and "All checks
passed". Both exercised golden paths — play to a win, play to a loss, reject an invalid placement,
confirm assets load under the Pages subpath — and every one of those claims reproduces. But that
conclusion was stated more broadly than the evidence supports: no check compared the enemy fleet
panel against the rules of the game (finding A, visible in the very screenshots attached to that
comment, where the enemy panel reads `Carrier 4/5` for a ship that had not been sunk), and none
probed adjacency attribution, the fleet-size coupling, or the unguarded paths. "The golden paths
work" was the finding; "no defects" was the claim.

---

## 6. Reproducing the measurements

The probes were throwaway files, deleted after collection. To rebuild them, drop a `*.test.ts`
next to the modules and run `npx vitest run <file>` on Node 22. The load-bearing pieces:

```ts
// 4.1 flush placement + total legal placements
for (const spec of SHIP_SPECS) {
  for (const [row, col, o] of [[0, 0, 'horizontal'], [0, 10 - spec.length, 'horizontal'],
                               [9, 0, 'horizontal'], [10 - spec.length, 9, 'vertical']] as const) {
    expect(canPlaceShip(createEmptyBoard(), spec.name, { row, col }, o)).toBe(true);
  }
  const legal = allCoordinates().flatMap((start) =>
    (['horizontal', 'vertical'] as const).filter((o) => canPlaceShip(createEmptyBoard(), spec.name, start, o)));
  expect(legal).toHaveLength(2 * 10 * (11 - spec.length));       // 120/140/160/160/180
}

// 4.3 sinking a flanked ship leaves its neighbours untouched
let b = placeShip(createEmptyBoard(), 'Carrier', { row: 4, col: 0 }, 'horizontal');
b = placeShip(b, 'Battleship', { row: 5, col: 0 }, 'horizontal');   // touching, below
b = placeShip(b, 'Destroyer', { row: 4, col: 5 }, 'horizontal');    // touching, end-to-end
for (const cell of b.ships[0].cells) b = fireAt(b, cell).board;
expect(remainingShips(b).map((s) => s.name)).toEqual(['Battleship', 'Destroyer']);

// 4.4 game-over fires on hit 17 and not before
let board = SHIP_SPECS.reduce((acc, spec, i) => placeShip(acc, spec.name, { row: i, col: 0 }, 'horizontal'),
                              createEmptyBoard());
board.ships.flatMap((s) => s.cells).forEach((cell, i, cells) => {
  const r = fireAt(board, cell); board = r.board;
  expect(r.outcome === 'game-over').toBe(i === cells.length - 1);
});

// B: a destroyed fleet of four ships never ends the game
let four = SHIP_SPECS.slice(0, 4).reduce((acc, spec, i) => placeShip(acc, spec.name, { row: i, col: 0 }, 'horizontal'),
                                         createEmptyBoard());
let last = ''; for (const c of four.ships.flatMap((s) => s.cells)) { const r = fireAt(four, c); four = r.board; last = r.outcome; }
expect(four.ships.every(isShipSunk)).toBe(true);
expect(last).toBe('sunk');            // not 'game-over'
expect(allShipsSunk(four)).toBe(false);

// A: the leak, from the DOM (jsdom + Testing Library, real timers)
await user.click(screen.getByRole('button', { name: 'Place randomly' }));
// fire enemy cells until the log says "hit!", then read the panel under the "Enemy ships" heading:
//   Submarine (3)1/3     <- identity + remaining length, before the ship is sunk
```

For the whole-game statistics, loop `createGame`/`placeRandomPlayerFleet`/`playerFire`/
`computerFire` with a seeded LCG (`state = (state * 1103515245 + 12345) % 2147483648`) and assert
termination, `winner`, duplicate-shot and hit-count invariants each turn.

---

## 7. Ranked list

| # | Finding | Severity | Reachable in the shipped UI | Status |
| --- | --- | --- | --- | --- |
| A | Enemy fleet panel reveals which ship was hit, ~6.1 shots early | Medium (rules fidelity; ~0 shots of real advantage) | Yes | Fixed |
| E | Rejected placements/repeat shots give no feedback; fired cells stay clickable | Low/Medium (UX) | Yes | Fixed |
| D | "Place randomly" silently discards manual placements | Low (UX, data loss) | Yes | Fixed |
| B | `allShipsSunk` hard-codes the five-ship fleet; other fleet sizes never end | Low now, latent | No | Fixed |
| C | `placeRandomPlayerFleet` has no phase guard | Low now, latent | No (JSX-gated) | Fixed |
| F | `computerFire` unguarded inside a `setTimeout` | Low now, latent | No | Fixed |
| H | `role="grid"` without `gridcell`; headers `aria-hidden` | Low (a11y) | Yes | Open |
| G | `pick` indexes out of bounds when an injected `Random` returns 1 | Low | No | Fixed |

Test-suite issues (5.1, 5.4) are not ranked as product defects, but they are the reason A–H
survived a green suite: 43 passing tests, and none of them look at the opponent fleet panel, play
a full alternating game, or exercise a non-standard fleet.
