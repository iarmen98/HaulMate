# Contributing to Haulmate

Thanks for helping. Haulmate is a small project, so the process is light.

## Setup

Requirements: Node.js 20+ and pnpm 9 (`corepack enable` or `npm i -g pnpm`).

```bash
pnpm install
pnpm dev
```

`pnpm install` also installs the [lefthook](https://github.com/evilmartians/lefthook) git hooks.

## Checks

Every change must pass the same four checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm check` runs all of them. The pre-commit hook runs the first three.

## Branches

- `main` is always releasable.
- Work on a short-lived branch named `type/short-description`, for example `feat/route-solver` or `fix/half-written-lines`.
- Open a pull request into `main` and keep it focused on one change.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), checked by a `commit-msg` hook:

```text
feat(routing): add capacity check
fix(parser): ignore half-written records
docs(adr): record web app decision
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `style`, `build`, `chore`, `ci`, `revert`. Scopes match the source folders: `log`, `parser`, `state`, `routing`, `data`, `ui`, `i18n`.

## Code style

- Code, identifiers, commits and docs in English. UI strings go through `src/i18n`, in English and Spanish.
- Files kebab-case, functions camelCase starting with a verb, types PascalCase, constants UPPER_SNAKE_CASE, events PascalCase in past tense.
- Units in names: `capacityScu`, `distanceGm`, `payoutAuec`, `durationMs`.
- `src/parser`, `src/state` and `src/routing` stay free of browser APIs and are fully unit-tested.

## Log fixtures

Fixtures in `tests/fixtures/` must be anonymised: replace player names, account ids and entity ids before committing. Never attach a raw `Game.log` to an issue.

## Ground rules

- Only the `Game.log` is read. No game memory reading, injection, screen capture or input sent to the game.
- No CIG/RSI logos or images.
- Nothing leaves the user's browser.
