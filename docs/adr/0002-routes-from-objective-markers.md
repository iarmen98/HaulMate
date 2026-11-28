# 2. Routes from objective markers and a hop-based time model

- Status: accepted
- Date: 2026-11-27

## Context

The plan assumed the hauling objectives in `Game.log` would give the commodity, SCU and both ends of every contract. About 140 real sessions show otherwise:

- `New Objective: Deliver …` is logged for fewer than half of the hauling contracts, and pickups never have text.
- Every contract does log `CreateMarker` records with the pickup and drop-off objective ids and their positions relative to the body or station.
- `Awarded N aUEC` is no longer logged in recent builds.

No bundled source of station coordinates in Gm is available yet, so true distances are unknown.

## Decision

- Build each contract from its markers. Name places from the delivery text when present, otherwise from a table of positions learnt from named drop-offs (`src/data/known-places.json`, `scripts/learn-places.js`).
- When the log has no SCU for a drop-off, ask the player for it in the contract card. When the log has no payout, let the player enter the reward.
- Cost a route by time with a hop model: same place, same body, quantum travel inside a system, and jump between systems, plus a fixed time per stop and per SCU handled. All timings are settings.

## Consequences

- Routes are correct in order and capacity, but ETA is an estimate and the planner cannot prefer a near station over a far one in the same system.
- Pickups at places never seen as a drop-off show as "Unknown pickup" until the table learns them.
- Adding real coordinates later only changes the cost function in `src/routing/route-model.ts`.
- Update 2026-11-28: quantum travel fuel estimates in the log now give distances between stations (`src/data/quantum-travel.json`). The hop model remains as the fallback for places without data.
