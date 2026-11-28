import { describe, expect, it } from 'vitest';
import { parseRecord } from '../../src/parser';

const AT = '<2026-11-28T12:44:10.314Z>';
const AT_MS = Date.parse('2026-11-28T12:44:10.314Z');
const MISSION_ID = '25b3acc2-98fe-4328-8ee6-afa76aa425c0';
const OBJECTIVE_ID = 'pickup_2e196fe7-0294-4c09-8dcc-e6dde1d03d0f_1';

describe('progress events', () => {
  it('reads arriving at an objective location', () => {
    const record = `${AT} [Notice] <CObjectiveMarkerComponent::RemovePlayer> MissionObjectiveMarker_16783[16783] - RemovePlayer - Player1[100000000000] added to removed player list (autoAddPlayers=true) - OnDisconnect: 0, missionId[${MISSION_ID}], objectiveId[${OBJECTIVE_ID}] [Team_MissionFeatures][Missions]`;

    expect(parseRecord(record)).toEqual({
      type: 'ObjectiveAreaEntered',
      atMs: AT_MS,
      missionId: MISSION_ID,
      objectiveId: OBJECTIVE_ID,
    });
  });

  it('ignores marker removals caused by a disconnect', () => {
    const record = `${AT} [Notice] <CObjectiveMarkerComponent::RemovePlayer> MissionObjectiveMarker_1[1] - RemovePlayer - Player1[100000000000] added to removed player list (autoAddPlayers=true) - OnDisconnect: 1, missionId[${MISSION_ID}], objectiveId[${OBJECTIVE_ID}]`;

    expect(parseRecord(record)).toBeNull();
  });

  it('reads leaving an objective location', () => {
    const record = `${AT} [Notice] <CObjectiveMarkerComponent::AddPlayer> MissionObjectiveMarker_16783[16783] - AddPlayer - Player1[100000000000] removed from removed player list (autoAddPlayers=true), missionId[${MISSION_ID}], objectiveId[${OBJECTIVE_ID}] [Team_MissionFeatures][Missions]`;

    expect(parseRecord(record)).toMatchObject({ type: 'ObjectiveAreaLeft', objectiveId: OBJECTIVE_ID });
  });

  it('reads freight elevator use and pickup progress', () => {
    expect(
      parseRecord(
        `${AT} [Notice] <CEntityComponentFreightElevatorUIProvider::FillUnstowRequest> [FreightElevatorKioskUIProvider] LoadingPlatform_FreightElevator_Util_Exterior_Kiosk_Stanton[100000000000] - Processed bindings into transfer request - Entities: 0`,
      ),
    ).toEqual({ type: 'FreightElevatorUsed', atMs: AT_MS });
    expect(
      parseRecord(
        `${AT} [Notice] <ObjectiveUpserted> Received ObjectiveUpserted push message for: mission_id ${MISSION_ID} - objective_id ${OBJECTIVE_ID} - state MISSION_OBJECTIVE_STATE_INPROGRESS - created 0 - flags=ShowInLog| [Team_GameServices][Missions]`,
      ),
    ).toMatchObject({ type: 'ObjectiveProgressed', objectiveId: OBJECTIVE_ID });
  });

  it('does not treat hidden pickup updates as progress', () => {
    expect(
      parseRecord(
        `${AT} [Notice] <ObjectiveUpserted> Received ObjectiveUpserted push message for: mission_id ${MISSION_ID} - objective_id ${OBJECTIVE_ID} - state MISSION_OBJECTIVE_STATE_INPROGRESS - created 0 - flags=Hidden| [Team_GameServices][Missions]`,
      ),
    ).toBeNull();
  });

  it('strips reputation markup from new contract titles', () => {
    const record = `${AT} [Notice] <SHUDEvent_OnNotification> Added notification "Contract Accepted:  Experienced | Stellar Medium Haul | to Ruin Station <EM4>[50/200/250/500/1000/2000/4000 Rep]</EM4>: " [15] to queue. New queue size: 1, MissionId: [${MISSION_ID}], ObjectiveId: [] [Team_CoreGameplayFeatures][Missions][Comms]`;

    expect(parseRecord(record)).toMatchObject({
      type: 'ContractAccepted',
      title: 'Experienced | Stellar Medium Haul | to Ruin Station',
    });
  });
});
