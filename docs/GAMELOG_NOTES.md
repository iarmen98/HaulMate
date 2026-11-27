# Game.log notes

What is known about the Star Citizen `Game.log` for Haulmate. These are hypotheses taken from an existing open-source parser ([NOVA AI](https://github.com/0zzyt0/NOVA-AI), MIT, `core/gamelog.py`) and community tools. Confirm every pattern against real fixtures before relying on it.

## File and lifecycle

- Location: `<install>\StarCitizen\LIVE\Game.log` (also `PTU`, `TECH-PREVIEW`). Default install is under `C:\Program Files\Roberts Space Industries\`.
- The game starts a new `Game.log` on each launch; previous logs go to `LIVE\logbackups\`.
- Each record starts with an ISO timestamp: `^<YYYY-MM-DDTHH:MM:SS(.fff)Z?>`. A record can span several lines; a new record starts at the next timestamp.
- The game writes while you read: the last line can be half-written. Buffer until a newline.
- Contracts accepted in a previous game session live in the backups, not the current log.

## Notifications

Most gameplay messages arrive as HUD notifications:

```text
Added notification "<text>" [<id>]
```

NOVA extracts the text with `Added notification\s+"(.*?)(?:"\s*\[\d+\]|"\s*MissionId\b|"\s*$|$)` (dot matches newlines).

Known notification texts (English client):

| Pattern                                                  | Meaning                    |
| -------------------------------------------------------- | -------------------------- |
| `^Contract Accepted:\s*(.*)`                             | Contract accepted, title   |
| `^Contract Complete:\s*(.*)`                             | Contract completed         |
| `^Contract Failed:\s*(.*)`                               | Contract failed            |
| `^Contract Withdrawn:\s*(.*)`                            | Contract withdrawn         |
| `^Contract Shared:\s*(.*)`                               | Contract shared with party |
| `^New Objective:\s*(.*)`                                 | New objective text         |
| `^Objective Complete:\s*(.*)`                            | Objective completed        |
| `^Quantum Travel Calibration Complete$`                  | QT calibration done        |
| `^(?:A )?Refinery Work Order has been Completed at (.+)` | Refinery order ready       |

Hauling objectives are expected to look like `Deliver 0/6 SCU of Ship Ammunition to Stanton System` (seen on the HUD). Whether pickups and counter updates (`3/6`) are logged is an open question.

## Location, ship and travel

| Pattern                                                                         | Meaning                                                                                |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `requested inventory for Location\[([^\]]+)\]`                                  | Current location (inventory request)                                                   |
| `Location\[([^\]]+)\]`                                                          | Location id in other records                                                           |
| `selected point (\S+) as their destination`                                     | Quantum travel destination selected                                                    |
| `Vehicle: (?P<cls>[A-Za-z0-9_]+?)_(?P<vid>\d{9,}), Interactor: (?P<who>\d{9,})` | Boarded or interacted with a ship; `cls` is the internal ship class (e.g. `CRUS_C2_…`) |
| `\b([A-Z]{3,5}_[A-Za-z0-9_]+?)_(\d{9,})\b`                                      | Generic vehicle class + id                                                             |
| `(?i)^(?:loc_)?rs_ext_([a-z]+)-([a-z]+)_jp\d*$`                                 | Jump point id between two systems                                                      |
| `(?i)^rr_jp_([a-z]+?)(stanton\|pyro\|nyx\|castra\|magnus\|terra)$`              | Jump point station                                                                     |
| `<CSCItemDockingTube::OnSetTubeState> …Station_DockingTube… Tube opened:`       | Docking tube opened (docked at a station)                                              |
| `Loading screen for (\w+) : \w+ closed after ([\d.]+) seconds`                  | Loading finished                                                                       |

## Money

- Contract payouts: confirm with fixtures whether the paid amount appears in the log (for example in a notification after `Contract Complete`).
- Shop purchases: `SendShopBuyRequest>.*?client_price\[([\d.]+)\].*?itemName\[([^\]]+)\]` and `RmShopFlowResponse>.*?result\[(\w+)\]`.

## Localisation

With a translated client the notification texts are translated. Match through the keys in `global.ini` (as NOVA does) rather than English text, after English support works.

## Privacy

The log contains other players' names and ids. Anonymise fixtures and never send log content anywhere.
