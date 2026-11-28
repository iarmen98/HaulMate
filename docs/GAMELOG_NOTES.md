# Game.log notes

What is known about the Star Citizen `Game.log` for Haulmate. Patterns marked **confirmed** were checked against real logs from builds 11135423 (Feb 2026) to 13220821 (Nov 2026), about 140 sessions. The fixtures in `tests/fixtures/` are anonymised excerpts of two of them. The first hypotheses came from [NOVA AI](https://github.com/0zzyt0/NOVA-AI) (MIT, `core/gamelog.py`).

## File and lifecycle

- Location: `<install>\StarCitizen\LIVE\Game.log` (also `PTU`, `TECH-PREVIEW`). Previous logs go to `LIVE\logbackups\` as `Game Build(<build>) <date> (<time>).log`. **Confirmed.**
- The game starts a new `Game.log` on each launch. Haulmate detects this when the file shrinks or its first 256 bytes change.
- The game writes while you read: the last line can be half-written. Haulmate buffers until a newline.
- Contracts accepted in a previous game session live in the backups, not the current log.

## Records

**Confirmed:** every physical line starts with a timestamp `<YYYY-MM-DDTHH:MM:SS.fffZ>`, including the continuation lines of a multi-line record. A record starts when the timestamp is followed by ` [Level]` or ` <Tag>`. Anything else after the timestamp is a continuation:

```text
<2026-07-14T16:22:44.620Z> [Notice] <SHUDEvent_OnNotification> Added notification "You have joined channel 'Argo RAFT : Player1'.
<2026-07-14T16:22:44.620Z> : " [28] to queue. New queue size: 1, MissionId: [00000000-…], ObjectiveId: [] [Team_CoreGameplayFeatures][Missions][Comms]
<2026-07-14T16:22:44.620Z>    "You have joined channel 'Argo RAFT : Player1'.
```

The third line is a dump of the notification queue, repeated many times. It is not a new record and must not be parsed as one.

## Notifications

```text
Added notification "<text>" [<id>] to queue. New queue size: <n>, MissionId: [<uuid>], ObjectiveId: [<id>]
```

**Confirmed:** `MissionId` and `ObjectiveId` are on the same record, which ties notifications to contracts. Non-mission notifications use the all-zero UUID.

| Text                                                                    | Event                | Status                                                         |
| ----------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------- |
| `Contract Accepted:  <title>: ` (two spaces)                            | `ContractAccepted`   | confirmed                                                      |
| `Contract Complete: <title>: `                                          | `ContractCompleted`  | confirmed                                                      |
| `Contract Failed: <title>: `                                            | `ContractFailed`     | not seen for hauling                                           |
| `Contract Withdrawn: <title>: `                                         | `ContractAbandoned`  | not seen for hauling                                           |
| `New Objective: Deliver <done>/<total> SCU of <commodity> to <place>: ` | `ObjectiveAdded`     | confirmed, but see below                                       |
| `Objective Complete: Deliver 3/3 SCU of Carbon to Everus Harbor`        | `ObjectiveCompleted` | confirmed in older builds                                      |
| `Awarded <n> aUEC: `                                                    | `PayoutReceived`     | confirmed until build 11218823; **not logged in newer builds** |
| `You have joined channel '<ship> : <owner>'.`                           | `ShipBoarded`        | confirmed                                                      |
| `You have left the channel '<ship> : <owner>'.`                         | `ShipLeft`           | confirmed                                                      |

### Objective notifications are incomplete

**Confirmed:** `New Objective: Deliver …` is only logged for some contracts, apparently the one being tracked in the HUD. Across all sessions, only 76 of 181 completed hauling contracts had one. Pickups are never logged as text, and partial counters (`3/6`) are not logged either.

So the SCU amount of a contract is often not in the log. Haulmate shows it when the log has it and asks the player otherwise.

## Mission records

These come with every contract and are the reliable source.

| Pattern                                                                                                                                                                     | Event                                                        | Status    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------- |
| `<CLocalMissionPhaseMarker::CreateMarker> … missionId [<uuid>], generator name [<gen>], contract [<name>], … objectiveId [pickup_<uuid>_<n>] … position [x: …, y: …, z: …]` | `ObjectiveMarkerCreated`                                     | confirmed |
| `<ObjectiveUpserted> … mission_id <uuid> - objective_id dropoff_… - state MISSION_OBJECTIVE_STATE_COMPLETED`                                                                | `ObjectiveCompleted`                                         | confirmed |
| `<EndMission> Ending mission for player. MissionId[<uuid>] … CompletionType[Complete\|Fail\|Abandon\|Deactivate]`                                                           | `ContractCompleted` / `ContractFailed` / `ContractAbandoned` | confirmed |

- Objective ids are `pickup_<uuid>_<n>` and `dropoff_<uuid>_<n>` (older builds: `dropoff_<uuid>_<n>_<m>`).
- The contract name encodes the shape: `…_AtoB`, `…_SingleToMulti4`, `…_Multi3ToSingle`, and usually the commodity, e.g. `RedWind_Pyro_SmallGrade_Solar_CFP_StationToOutpost_Hydrogen_CargoHauling_SingleToMulti4`.
- Hauling generators seen: `RedWind_Hauling`, `Covalex_Hauling`, `LingFamilyHauling_Hauling`, `VisitingIasi` (Iasi contracts with `HaulCargo` in the name).
- Marker positions are relative to the body or station zone. **Confirmed** stable across sessions for the same place, so a position identifies a place. Haulmate keeps a table of positions seen at named drop-offs (`src/data/known-places.json`) to name pickups, which have no text. With the current table about 91 % of pickups resolve.

## Progress at a stop

**Confirmed** in sessions from builds 12122953 and 13220821:

| Pattern                                                                                                                    | Event                  | Meaning                                                           |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- |
| `<CObjectiveMarkerComponent::RemovePlayer> … added to removed player list … OnDisconnect: 0, missionId[…], objectiveId[…]` | `ObjectiveAreaEntered` | The player reached the place of that objective (its marker hides) |
| `<CObjectiveMarkerComponent::AddPlayer> … removed from removed player list …, missionId[…], objectiveId[…]`                | `ObjectiveAreaLeft`    | The player left that place                                        |
| `<CEntityComponentFreightElevatorUIProvider::FillUnstowRequest>`                                                           | `FreightElevatorUsed`  | The player asked the freight elevator for cargo                   |
| `<ObjectiveUpserted> … objective_id pickup_… - state MISSION_OBJECTIVE_STATE_INPROGRESS … flags=ShowInLog`                 | `ObjectiveProgressed`  | Cargo for that pickup was taken                                   |

Haulmate marks a pickup as loaded when the player uses the freight elevator while at that pickup and then leaves, or when the game reports progress on it. Every pickup of a `Multi…ToSingle` contract is required (confirmed by the player). One logged contract completed without a recorded visit to one of its pickups, so a visit can go unlogged; the manual confirm covers that case.

## Contract titles

Build 13220821 adds tiers and reputation markup: `Contract Accepted:  Experienced | Stellar Medium Haul | to Ruin Station <EM4>[50/…/4000 Rep]</EM4>`. Haulmate drops the markup. The reward in aUEC is not logged anywhere.

## Quantum travel

**Confirmed:** selecting a destination logs the start, the target and the fuel estimate, and arrival is logged too:

```text
<CSCItemNavigation::CalculateRoute> Projected Start Location is Checkmate for route to destination rs_ext_pyro5_l2
<CSCItemNavigation::CalculateRoute> Successfully calculated route to rs_ext_pyro5_l2 fuel estimate 1258120.250000
<Quantum Drive Arrived - Arrived at Final Destination>
```

Fuel scales with distance and with the ship's drive. `scripts/learn-travel.js` normalises fuel per ship against a Crusader C2, takes the median per pair of places, rebuilds positions for each system from the measured pairs (median error 0.3 % in Pyro) and fits quantum time to fuel. The result is `src/data/quantum-travel.json`, which the route planner uses.

## Location, ship and travel

| Pattern                                                                      | Event                        | Status    |
| ---------------------------------------------------------------------------- | ---------------------------- | --------- |
| `requested inventory for Location[<code>]`                                   | `LocationChanged`            | confirmed |
| `<AccountLoginCharacterStatus_Character> Character: … name <handle> - state` | `PlayerIdentified`           | confirmed |
| `selected point <id> as their destination`                                   | `QuantumDestinationSelected` | confirmed |

Location codes are structured: `RR_P6_LEO` (rest stop in low orbit of Pyro VI, Ruin Station), `RR_P2_L4` (Pyro II L4, Checkmate), `RR_JP_PyroStanton` (Stanton Gateway in Pyro), `Pyro4_Outpost_…`, `Stanton1_Lorville`, `Stanton3b_ArcCorp_Area056`. The body can be read from the code.

The ship comes from the party voice channel the game opens when you board: `'<Manufacturer> <Model> : <owner>'`. Only channels owned by the local player count as the current ship.

## Localisation

With a translated client the notification texts are translated. Match through the keys in `global.ini` (as NOVA does) rather than English text, after English support works.

## Privacy

The log contains player handles, account ids and entity ids. `scripts/anonymise-log.js` keeps only the records Haulmate needs and replaces names and ids. Review its output before committing a fixture.
