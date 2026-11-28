# Haulmate

**Hauling routes from your Star Citizen `Game.log`.**

Haulmate reads your `Game.log` live while you play, picks up the hauling contracts you accept and works out the fastest order to load and deliver them without going over your ship's cargo capacity. It is a desktop app for Windows that runs next to the game: no account, and the log never leaves your PC.

[Leer en español](README.es.md)

> **Unofficial fan project.** Haulmate is not affiliated with or endorsed by Cloud Imperium Games or Roberts Space Industries. Star Citizen®, Roberts Space Industries® and Cloud Imperium® are trademarks of Cloud Imperium Rights LLC.

![Desktop planner mockup](docs/design/main.png)

## Features

- **Live log reading** — follows `Game.log` as the game writes it and picks up a new log when the game restarts.
- **Contracts and objectives** — accepted, completed, failed and withdrawn contracts, with their pickup and delivery objectives.
- **Best route** — exact solver for up to 16 stops, heuristic beyond that; respects pick-up-before-delivery and your ship's SCU.
- **Cargo confirmation** — tick off cargo as it lands in your hold.
- **Session earnings** — money earned this session and in total.
- **English and Spanish** interface.

## Status

Early development (`0.x`). The log format is undocumented and changes between patches, so expect rough edges. See [the project plan](docs/PLAN.md) for the roadmap.

## Install

Download `Haulmate-Setup-<version>.exe` from [Releases](https://github.com/iarmen98/HaulMate/releases) and run it. Builds are not code-signed yet, so Windows SmartScreen shows a warning: choose **More info → Run anyway**. Signing through SignPath Foundation is planned (see [ADR 3](docs/adr/0003-desktop-app-with-electron.md)).

## Build from source

Requirements: [Node.js](https://nodejs.org/) 20 or newer and pnpm (`corepack enable` or `npm install -g pnpm`).

```bash
git clone https://github.com/iarmen98/HaulMate.git
cd HaulMate
pnpm install
pnpm desktop     # build and open the desktop app
pnpm package     # build the installer into release/
pnpm dev         # web version in Chrome or Edge, for development
```

## How to use

1. Open Haulmate. It finds `StarCitizen\LIVE` on any drive by itself; if not, click **Open game folder** and pick it, for example `C:\Program Files\Roberts Space Industries\StarCitizen\LIVE`.
2. Accept hauling contracts in game. They show up in Haulmate as they appear in the log.
3. Pick your ship in **Settings** if Haulmate has not detected it, and follow the route.
4. Confirm cargo when it is in your hold, and copy the next stop into the starmap search.

The game does not log the SCU of every contract. When a contract card asks for it, copy the amount from your mobiGlas. Rewards are optional; add them to see the route payout and your earnings, since recent game builds no longer log payouts.

In the web version, **Try the demo** loads a sample session, and **Open Game.log file** reads a log once when the browser cannot open the folder.

## In-game overlay

The desktop app can show a small transparent panel over the game, bottom left: next stop, cargo to load or deliver, the stops after it and your earnings. It never takes mouse clicks, so the game keeps working underneath.

- **Shift+F8** shows or hides it (or use the button in the app).
- **F8** confirms the cargo at the next stop as loaded.
- Set Star Citizen to **Borderless** window mode; exclusive fullscreen draws over every other window.

## Limitations

- Windows only for now. The web version needs Chrome or Edge for live reading.
- Only English game text is recognised for now.
- Contracts accepted before the current game launch are in older logs and are not picked up.
- Pickups are named from places Haulmate has seen before; new ones show as "Unknown pickup".
- Travel times are estimates by hop type (same body, quantum travel, jump), not real distances. Tune them in **Settings**.

## Privacy and fair play

Haulmate only reads `Game.log`. It never reads game memory, injects anything, captures your screen or sends input to the game. See [PRIVACY.md](PRIVACY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) and report security issues as described in [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE). Fonts (Unbounded, Hanken Grotesk, Martian Mono) are under the SIL Open Font License 1.1.
