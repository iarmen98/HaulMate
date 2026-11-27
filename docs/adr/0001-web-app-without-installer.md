# 1. Web app without installer

- Status: accepted
- Date: 2026-11-27

## Context

Haulmate needs to read the Star Citizen `Game.log` while the game runs and show a hauling plan. A desktop executable needs an installer or a portable `.exe`, and an unsigned `.exe` triggers SmartScreen warnings. Free code signing (SignPath Foundation) requires a release history and CI, which a new project does not have yet.

Chromium browsers (Chrome, Edge) expose the File System Access API, which can open a local folder with the user's permission and re-read files in it.

## Decision

Ship Haulmate as a static web app (TypeScript, Vite, Preact) that reads `Game.log` through the File System Access API. During development it runs locally with `pnpm dev`; the release target is GitHub Pages.

The parser, state reducer and route solver are pure TypeScript with no browser dependencies, so a later desktop shell (phase 6, Tauri) can reuse them unchanged.

## Consequences

- No installer, no `.exe`, nothing to sign for v1.
- Live reading works only in Chromium browsers. Other browsers can still load a picked `Game.log` once, without live updates.
- The folder permission may need one click to re-grant per visit; the handle is kept in IndexedDB.
- A transparent in-game overlay is not possible from a browser tab. It is deferred to phase 6.
