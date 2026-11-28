import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/parser';
import type { HaulmateEvent } from '../../src/parser';
import { buildCargoLegs } from '../../src/state/cargo-legs';
import { buildState } from '../../src/state/hauling-state';

const MISSION_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const NO_INPUTS = { scuOverrides: {}, loadedLegIds: new Set<string>(), deliveredLegIds: new Set<string>() };

const baseEvents: HaulmateEvent[] = [
  { type: 'ContractAccepted', atMs: 1, missionId: MISSION_ID, title: 'Haul' },
  {
    type: 'ObjectiveMarkerCreated',
    atMs: 1,
    missionId: MISSION_ID,
    objectiveId: 'pickup_u_0',
    kind: 'pickup',
    generatorName: 'RedWind_Hauling',
    contractName: 'RedWind_Pyro_Potassium_CargoHauling_AtoB',
    position: { x: 1, y: 0, z: 0 },
  },
  {
    type: 'ObjectiveMarkerCreated',
    atMs: 1,
    missionId: MISSION_ID,
    objectiveId: 'dropoff_u_0',
    kind: 'dropoff',
    generatorName: 'RedWind_Hauling',
    contractName: 'RedWind_Pyro_Potassium_CargoHauling_AtoB',
    position: { x: 2, y: 0, z: 0 },
  },
];

function readLegStatus(events: HaulmateEvent[]): string | undefined {
  const contract = buildState(events).contracts[MISSION_ID];
  return contract ? buildCargoLegs(contract, NO_INPUTS)[0]?.status : undefined;
}

describe('load detection', () => {
  it('marks cargo on board after using the freight elevator at the pickup and leaving', () => {
    const status = readLegStatus([
      ...baseEvents,
      { type: 'ObjectiveAreaEntered', atMs: 2, missionId: MISSION_ID, objectiveId: 'pickup_u_0' },
      { type: 'FreightElevatorUsed', atMs: 3 },
      { type: 'ObjectiveAreaLeft', atMs: 4, missionId: MISSION_ID, objectiveId: 'pickup_u_0' },
    ]);

    expect(status).toBe('onBoard');
  });

  it('does not mark cargo when the player passes by without using the elevator', () => {
    const status = readLegStatus([
      ...baseEvents,
      { type: 'ObjectiveAreaEntered', atMs: 2, missionId: MISSION_ID, objectiveId: 'pickup_u_0' },
      { type: 'ObjectiveAreaLeft', atMs: 4, missionId: MISSION_ID, objectiveId: 'pickup_u_0' },
    ]);

    expect(status).toBe('toLoad');
  });

  it('ignores elevator use somewhere else', () => {
    const status = readLegStatus([
      ...baseEvents,
      { type: 'FreightElevatorUsed', atMs: 2 },
      { type: 'ObjectiveAreaEntered', atMs: 3, missionId: MISSION_ID, objectiveId: 'pickup_u_0' },
      { type: 'ObjectiveAreaLeft', atMs: 4, missionId: MISSION_ID, objectiveId: 'pickup_u_0' },
    ]);

    expect(status).toBe('toLoad');
  });

  it('marks cargo on board when the game reports pickup progress', () => {
    const status = readLegStatus([
      ...baseEvents,
      { type: 'ObjectiveProgressed', atMs: 2, missionId: MISSION_ID, objectiveId: 'pickup_u_0' },
    ]);

    expect(status).toBe('onBoard');
  });

  it('detects the pickups the player visited in a real multi-pickup contract', () => {
    const events = parseLog(
      readFileSync(new URL('../fixtures/pyro-4-2-session.log', import.meta.url), 'utf8'),
    );
    const missionId = events.flatMap((event) =>
      event.type === 'ContractAccepted' && event.missionId.startsWith('46c7ac2d') ? [event.missionId] : [],
    )[0];
    const completedAtMs = events.flatMap((event) =>
      event.type === 'ObjectiveCompleted' && event.missionId === missionId ? [event.atMs] : [],
    )[0];
    const state = buildState(events.filter((event) => event.atMs < (completedAtMs ?? 0)));
    const contract = missionId ? state.contracts[missionId] : undefined;

    const legs = contract ? buildCargoLegs(contract, NO_INPUTS) : [];

    const visitedLegs = legs.filter((leg) => /pickup_[^/]+_[123]\//.test(leg.legId));

    expect(legs).toHaveLength(4);
    expect(visitedLegs.map((leg) => leg.status)).toEqual(['onBoard', 'onBoard', 'onBoard']);
  });
});
