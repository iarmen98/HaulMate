# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Versions stay at `0.y.z` until 1.0.

## [Unreleased]

### Added

- Live `Game.log` reading from the game folder (Chrome and Edge), with a one-click reconnect on later visits, and a one-off file mode for other browsers.
- Parser for contracts, objective markers, deliveries, payouts, location, ship and quantum destinations, checked against anonymised real sessions.
- Hauling state rebuilt from log events: active and completed contracts, current ship and location, session earnings.
- Pickup and drop-off names from objective marker positions, with 37 known places in Pyro and Stanton.
- Route planner: exact solver up to 16 stops, heuristic above, cargo capacity, usable-capacity margin and automatic batches for contracts larger than the hold.
- Desktop planner: active contracts, earnings, optimal route, cargo chart, next stop with cargo confirmation and copy-to-starmap.
- SCU and reward entry for contracts where the log does not carry them.
- English and Spanish interface.
- Demo mode with a sample session.
