# Haulmate

Windows desktop app (Electron) that reads the Star Citizen `Game.log` and plans the best hauling route. The same UI also runs as a web page. Unofficial fan project.

## Read first

- `docs/PLAN.md` — scope, stack, architecture, route algorithm, phases and their gates.
- `docs/GAMELOG_NOTES.md` — what is known about the log format. Treat it as hypotheses until confirmed by fixtures.
- `docs/design/` — mockups (`main.png`, `overlay.png`, `ingame.png`), static HTML versions and design tokens in `docs/design/README.md`.

## Current phase

Work one phase at a time, as listed in `docs/PLAN.md`. Do not start the next phase until the current gate passes. Update this line when a phase is done: **Phase 4 — UI and v0.1: built; waiting for the gate (one full hauling session played with Haulmate open).**

## Stack

TypeScript (strict, `noUncheckedIndexedAccess`), Vite, Preact, Electron + electron-builder (`desktop/`, CommonJS), Vitest, fast-check, ESLint (typescript-eslint), Prettier, pnpm, lefthook.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm desktop   # build and open the desktop app
pnpm package   # NSIS installer in release/
```

The pre-commit hook runs `lint`, `typecheck` and `test`. Every change must pass all four checks before it is committed.

## Rules

- Code, identifiers, commits and docs in English. UI strings in English and Spanish through the i18n module, never hard-coded.
- No code comments or docstrings. Names carry the meaning.
- Naming: files kebab-case, functions and variables camelCase starting with a verb for functions, types PascalCase, constants UPPER_SNAKE_CASE, events PascalCase in past tense (`ContractAccepted`). Units in names: `capacityScu`, `distanceGm`, `payoutAuec`, `durationMs`.
- Conventional Commits (`feat(parser): …`, `fix(routing): …`), small focused commits.
- `src/parser`, `src/state` and `src/routing` are pure TypeScript: no DOM, no browser APIs, fully unit-tested.
- State is derived from events only. Never mutate state outside the reducer.
- The route solver runs in a Web Worker.
- Only the `Game.log` is read. Never read game memory, inject into the game, capture the screen, or send input to the game.
- No CIG/RSI logos or images. Keep the fan-project notice in the README and the UI footer.
- Nothing leaves the user's machine: no analytics, no network calls except loading bundled static data.
- The Electron renderer stays sandboxed; the preload exposes only folder selection, log chunks, overlay toggling and the hotkey event.
- Global hotkeys only listen; they never send input to the game.
- No GitHub Actions until phase 5.
- Log fixtures in `tests/fixtures/` must be anonymised: replace other players' names and IDs.

## Design

Dark UI with glass panels and orange accent. Earned money is green, money still to earn is orange; green is used for nothing else. Fonts: Unbounded (headings and figures), Hanken Grotesk (text), Martian Mono (small numbers). See `docs/design/README.md` for tokens.
