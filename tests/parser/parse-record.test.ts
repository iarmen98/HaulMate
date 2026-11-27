import { describe, expect, it } from 'vitest';
import { parseLog, parseRecord } from '../../src/parser';

const AT = '<2026-07-14T16:20:05.414Z>';
const AT_MS = Date.parse('2026-07-14T16:20:05.414Z');
const MISSION_ID = '289539bc-3943-4c85-9db0-f38926cbef64';

function notification(text: string, missionId = MISSION_ID, objectiveId = ''): string {
  return `${AT} [Notice] <SHUDEvent_OnNotification> Added notification "${text}" [11] to queue. New queue size: 2, MissionId: [${missionId}], ObjectiveId: [${objectiveId}] [Team_CoreGameplayFeatures][Missions][Comms]`;
}

describe('parseRecord', () => {
  it('parses an accepted contract', () => {
    expect(
      parseRecord(notification('Contract Accepted:  Member Hauler Needed for Small Shipment: ')),
    ).toEqual({
      type: 'ContractAccepted',
      atMs: AT_MS,
      missionId: MISSION_ID,
      title: 'Member Hauler Needed for Small Shipment',
    });
  });

  it('parses a delivery objective', () => {
    const record = notification(
      "New Objective: Deliver 0/4 SCU of Hydrogen to Sacren's Plot: ",
      MISSION_ID,
      'dropoff_0657eb10-f1de-43fb-b00f-569a9665b3bc_0',
    );

    expect(parseRecord(record)).toEqual({
      type: 'ObjectiveAdded',
      atMs: AT_MS,
      missionId: MISSION_ID,
      objectiveId: 'dropoff_0657eb10-f1de-43fb-b00f-569a9665b3bc_0',
      deliveredScu: 0,
      totalScu: 4,
      commodity: 'Hydrogen',
      destination: "Sacren's Plot",
    });
  });

  it('parses a completed delivery split over two lines', () => {
    const [record] = parseLog(
      `${AT} [Notice] <SHUDEvent_OnNotification> Added notification "Objective Complete: Deliver 3/3 SCU of Carbon to Everus Harbor\n${AT} : " [80] to queue. New queue size: 1, MissionId: [${MISSION_ID}], ObjectiveId: [dropoff_a_0] [Team_CoreGameplayFeatures][Missions][Comms]\n`,
    );

    expect(record).toEqual({
      type: 'ObjectiveCompleted',
      atMs: AT_MS,
      missionId: MISSION_ID,
      objectiveId: 'dropoff_a_0',
    });
  });

  it('parses an objective marker with its position', () => {
    const record = `${AT} [Notice] <CLocalMissionPhaseMarker::CreateMarker> Creating objective marker: missionId [${MISSION_ID}], generator name [RedWind_Hauling], contract [RedWind_Pyro_SmallGrade_Solar_CFP_StationToOutpost_Hydrogen_CargoHauling_SingleToMulti4], contractDefinitionId[bce90397-ea56-430a-b88b-479ab1a12926], objectiveId [pickup_0657eb10-f1de-43fb-b00f-569a9665b3bc_0], markerEntityId [2385], zoneHostId [100000000000], position [x: -19162.107349, y: -37842.049299, z: 6727.802807] [Team_MissionFeatures][Missions]`;

    expect(parseRecord(record)).toEqual({
      type: 'ObjectiveMarkerCreated',
      atMs: AT_MS,
      missionId: MISSION_ID,
      objectiveId: 'pickup_0657eb10-f1de-43fb-b00f-569a9665b3bc_0',
      kind: 'pickup',
      generatorName: 'RedWind_Hauling',
      contractName: 'RedWind_Pyro_SmallGrade_Solar_CFP_StationToOutpost_Hydrogen_CargoHauling_SingleToMulti4',
      position: { x: -19162.107349, y: -37842.049299, z: 6727.802807 },
    });
  });

  it.each([
    ['Complete', 'ContractCompleted'],
    ['Fail', 'ContractFailed'],
    ['Abandon', 'ContractAbandoned'],
  ])('maps EndMission completion type %s to %s', (completionType, eventType) => {
    const record = `${AT} [Notice] <EndMission> Ending mission for player. MissionId[${MISSION_ID}] Player[Player1] PlayerId[100000000000] CompletionType[${completionType}] Reason[Mission Ended] [Team_MissionFeatures][Missions]`;

    expect(parseRecord(record)).toEqual({ type: eventType, atMs: AT_MS, missionId: MISSION_ID });
  });

  it('parses a completed dropoff objective push message', () => {
    const record = `${AT} [Notice] <ObjectiveUpserted> Received ObjectiveUpserted push message for: mission_id ${MISSION_ID} - objective_id dropoff_2e196fe7-0294-4c09-8dcc-e6dde1d03d0f_0 - state MISSION_OBJECTIVE_STATE_COMPLETED - created 0 - flags=ShowInLog| [Team_GameServices][Missions]`;

    expect(parseRecord(record)).toMatchObject({
      type: 'ObjectiveCompleted',
      objectiveId: 'dropoff_2e196fe7-0294-4c09-8dcc-e6dde1d03d0f_0',
    });
  });

  it('parses payouts with thousands separators', () => {
    expect(
      parseRecord(notification('Awarded 28,250 aUEC: ', '00000000-0000-0000-0000-000000000000')),
    ).toEqual({
      type: 'PayoutReceived',
      atMs: AT_MS,
      amountAuec: 28250,
    });
  });

  it('parses location, player, ship and quantum destination', () => {
    expect(
      parseRecord(
        `${AT} [Notice] <RequestLocationInventory> Player[Player1] requested inventory for Location[RR_P6_LEO]`,
      ),
    ).toMatchObject({ type: 'LocationChanged', locationCode: 'RR_P6_LEO' });
    expect(
      parseRecord(
        `${AT} [Notice] <AccountLoginCharacterStatus_Character> Character: createdAt 0 - updatedAt 0 - geid 0 - accountId 0 - name Player1 - state STATE_CURRENT [Team_GameServices][Login]`,
      ),
    ).toMatchObject({ type: 'PlayerIdentified', playerName: 'Player1' });
    expect(
      parseRecord(
        notification(
          "You have joined channel 'Gatac Railen : Player1'.",
          '00000000-0000-0000-0000-000000000000',
        ),
      ),
    ).toMatchObject({ type: 'ShipBoarded', shipName: 'Gatac Railen', ownerName: 'Player1' });
    expect(
      parseRecord(
        `${AT} [Notice] <Player Selected Quantum Target> Player1 selected point RR_P6_LEO as their destination`,
      ),
    ).toMatchObject({ type: 'QuantumDestinationSelected', pointId: 'RR_P6_LEO' });
  });

  it('flags hauling-looking notifications it does not understand', () => {
    expect(parseRecord(notification('Pick up 4 SCU of Hydrogen at Ruin Station: '))).toMatchObject({
      type: 'UnknownHaulingLineFound',
    });
  });

  it('ignores records without a timestamp or of no interest', () => {
    expect(parseRecord('no timestamp')).toBeNull();
    expect(
      parseRecord(`${AT} [Notice] <StatObjLoad 0x800 Format> 'data/objects/a.cgf' - File exists in P4K`),
    ).toBeNull();
    expect(parseRecord(notification('Entering Armistice Zone - Combat Prohibited: '))).toBeNull();
  });
});
