# 3. Desktop app with Electron

- Status: accepted
- Date: 2026-11-28
- Amends: [ADR 1](0001-web-app-without-installer.md)

## Context

ADR 1 shipped Haulmate as a web page to avoid an unsigned executable. In practice the player wants an app they install and open next to the game, not a browser tab that asks for folder permission on every visit. The free signing route, SignPath Foundation, needs an open-source project that has already published an unsigned release and builds it in CI, so signing comes after a first release, not before.

The machine used for development has Node.js but no Rust toolchain or Visual Studio C++ Build Tools, which Tauri (the shell named for phase 6) needs.

## Decision

- Ship Haulmate as an Electron desktop app with an NSIS installer and uninstaller, built by electron-builder.
- The UI, parser, state and router stay the same code. Only the log source changes: the main process finds `StarCitizen\<channel>` on every drive, remembers the chosen folder, tails `Game.log` with Node's file APIs and pushes text to the renderer. The log worker parses it as before.
- The renderer is sandboxed (context isolation, no Node integration) and loaded from a private `app://` scheme. The preload exposes only folder selection and log chunks.
- The web build keeps working in Chrome and Edge for development and for people who prefer it.
- Releases are unsigned until SignPath Foundation accepts the project. Then the signing step is added to the release workflow.

## Consequences

- No permission prompt and no browser needed; the game folder is found automatically.
- The installer is about 120 MB instead of about 10 MB with Tauri.
- Windows SmartScreen warns on the unsigned installer until signing is in place.
- Phase 5 (CI) becomes a prerequisite for signing. Phase 6 keeps the transparent overlay as its remaining scope.
