# Haulmate design

Mockups with example data (Pyro, Gatac Railen 320 SCU). Numbers, station services and contracts are invented for the mockup.

| File | What |
| --- | --- |
| `main.png`, `Main.html` | Desktop planner: contracts and earnings (left), optimal route and cargo chart (centre), next stop with cargo confirmation and station services (right) |
| `overlay.png`, `Overlay.html` | In-game overlay panel, 380 px wide |
| `ingame.png`, `InGame.html` | The overlay over a cockpit screenshot, bottom-left |
| `architecture.png` | Data flow between modules |
| `roadmap.png` | Phases and the v0.1 gate |

The HTML files are static renders (open them in a browser; fonts are in `fonts/`). Use them as the visual reference, not as code to copy.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `bg` | `#06080C` | Page background, with faint 48 px grid and orange radial glows |
| `accent` | `#FF7A1A` | Orange: primary actions, route, money still to earn |
| `accent-soft` | `#FFD2AE` | Text on orange tints, loads (▲) |
| `earned` | `#4ADE80` (text `#BBF7D0`) | Money already earned and the LIVE indicator only |
| `text` | `#F3F4F7` | Primary text |
| `text-muted` | `#A7AFBD` | Labels and secondary text |
| `glass` | `linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))` + `1px solid rgba(255,255,255,0.12)` + `backdrop-filter: blur(18px) saturate(140%)` | Panels |
| `glass-inner` | `rgba(8,10,14,0.45)` + `1px solid rgba(255,255,255,0.10)` | Cards inside panels |
| `radius` | 22 px panels, 16 px cards, 999 px chips | |
| `overlay-panel` | `rgba(8,10,14,0.38)` + `1px solid rgba(255,255,255,0.24)` + `blur(6px)` + text-shadow | In-game overlay, mostly transparent |

## Type

- Unbounded 500–700: headings, station names, big figures.
- Hanken Grotesk 400–700: body and labels.
- Martian Mono 400–500: SCU counts, distances, timestamps.

## Rules

- Green means money earned, nothing else. Confirmed cargo uses white.
- Unloads (▼) in neutral text, loads (▲) in `accent-soft`.
- The overlay is click-through in game: it shows hotkey hints (e.g. `F8 confirm cargo`) instead of buttons.
