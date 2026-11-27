import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/parser';
import type { HaulmateEvent } from '../../src/parser';
import { buildCargoLegs } from '../../src/state/cargo-legs';
import {
  buildState,
  listActiveHaulingContracts,
  listCompletedHaulingContracts,
} from '../../src/state/hauling-state';

const MISSION_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NO_INPUTS = { scuOverrides: {}, loadedLegIds: new Set<string>(), deliveredLegIds: new Set<string>() };

function readFixtureEvents(name: string): HaulmateEvent[] {
  return parseLog(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
}

function marker(objectiveId: string, x: number, atMs = 1): HaulmateEvent {
  return {
    type: 'ObjectiveMarkerCreated',
    atMs,
    missionId: MISSION_ID,
    objectiveId,
    kind: objectiveId.startsWith('pickup') ? 'pickup' : 'dropoff',
    generatorName: 'RedWind_Hauling',
    contractName: 'RedWind_Pyro_SmallGrade_Solar_CFP_StationToOutpost_Hydrogen_CargoHauling_SingleToMulti2',
    position: { x, y: 0, z: 0 },
  };
}

describe('buildState', () => {
  it('tracks a contract from acceptance to completion', () => {
    const state = buildState([
      marker('pickup_u_0', 10),
      marker('dropoff_u_0', 20),
      { type: 'ContractAccepted', atMs: 2, missionId: MISSION_ID, title: 'Member Hauler Needed' },
      { type: 'ContractCompleted', atMs: 10, missionId: MISSION_ID },
      { type: 'ContractCompleted', atMs: 11, missionId: MISSION_ID },
      { type: 'PayoutReceived', atMs: 12, amountAuec: 28250 },
    ]);

    const contract = state.contracts[MISSION_ID];
    expect(contract?.status).toBe('completed');
    expect(contract?.endedAtMs).toBe(10);
    expect(contract?.payoutAuec).toBe(28250);
    expect(state.payouts).toEqual([{ atMs: 12, amountAuec: 28250, missionId: MISSION_ID }]);
  });

  it('only takes ships owned by the local player', () => {
    const state = buildState([
      { type: 'PlayerIdentified', atMs: 1, playerName: 'Player1' },
      { type: 'ShipBoarded', atMs: 2, shipName: 'Gatac Railen', ownerName: 'Player1' },
      { type: 'ShipBoarded', atMs: 3, shipName: 'Anvil Asgard', ownerName: 'Player2' },
    ]);

    expect(state.shipName).toBe('Gatac Railen');
  });

  it('does not reopen an ended contract on a late duplicate event', () => {
    const state = buildState([
      { type: 'ContractAccepted', atMs: 1, missionId: MISSION_ID, title: 'Haul' },
      { type: 'ContractAbandoned', atMs: 2, missionId: MISSION_ID },
      { type: 'ContractCompleted', atMs: 3, missionId: MISSION_ID },
    ]);

    expect(state.contracts[MISSION_ID]?.status).toBe('abandoned');
  });

  it('rebuilds the same state from the same events', () => {
    const events = readFixtureEvents('pyro-4-2-session.log');

    expect(buildState(events)).toEqual(buildState(events));
  });
});

describe('fixture sessions', () => {
  it('finds the completed Pyro contracts and the ship', () => {
    const state = buildState(readFixtureEvents('pyro-4-2-session.log'));

    expect(state.playerName).toBe('Player1');
    expect(state.shipName).toBe('Crusader C2 Hercules Starlifter');
    expect(listCompletedHaulingContracts(state).length).toBeGreaterThan(0);
  });

  it('links Stanton payouts to their contracts', () => {
    const state = buildState(readFixtureEvents('stanton-4-0-session.log'));
    const completed = listCompletedHaulingContracts(state);

    expect(completed.filter((contract) => contract.payoutAuec !== null).length).toBe(state.payouts.length);
  });
});

describe('buildCargoLegs', () => {
  it('names drop-offs and pickups from known marker positions', () => {
    const events = readFixtureEvents('pyro-4-2-session.log');
    const atMs = events.find(
      (event) => event.type === 'ContractAccepted' && event.missionId.startsWith('46c7ac2d'),
    )?.atMs;
    const state = buildState(events.filter((event) => event.atMs <= (atMs ?? 0) + 1));
    const contract = listActiveHaulingContracts(state).find((candidate) =>
      candidate.missionId.startsWith('46c7ac2d'),
    );

    const legs = buildCargoLegs(contract ?? (undefined as never), NO_INPUTS);

    expect(legs.length).toBeGreaterThan(1);
    expect(new Set(legs.map((leg) => leg.dropoff.shortName))).toEqual(new Set(['Ruin Station']));
    expect(legs.every((leg) => leg.commodity === 'Potassium')).toBe(true);
  });

  it('splits one drop-off evenly between several pickups', () => {
    const state = buildState([
      { type: 'ContractAccepted', atMs: 1, missionId: MISSION_ID, title: 'Haul' },
      marker('pickup_u_0', 1),
      marker('pickup_u_1', 2),
      marker('dropoff_u_0', 3),
      {
        type: 'ObjectiveAdded',
        atMs: 2,
        missionId: MISSION_ID,
        objectiveId: 'dropoff_u_0',
        commodity: 'Carbon',
        deliveredScu: 0,
        totalScu: 33,
        destination: 'Ruin Station above Pyro VI',
      },
    ]);

    const legs = buildCargoLegs(state.contracts[MISSION_ID] ?? (undefined as never), NO_INPUTS);

    expect(legs.map((leg) => leg.scu)).toEqual([16, 17]);
    expect(legs.every((leg) => leg.scuSource === 'log')).toBe(true);
  });

  it('uses the SCU the player entered when the log has none', () => {
    const state = buildState([marker('pickup_u_0', 1), marker('dropoff_u_0', 2), marker('dropoff_u_1', 3)]);
    const contract = state.contracts[MISSION_ID] ?? (undefined as never);

    const legs = buildCargoLegs(contract, {
      ...NO_INPUTS,
      scuOverrides: { [`${MISSION_ID}/dropoff_u_1`]: 12 },
    });

    expect(legs.map((leg) => [leg.scu, leg.scuSource])).toEqual([
      [null, 'unknown'],
      [12, 'player'],
    ]);
    expect(legs[0]?.commodity).toBe('Hydrogen');
  });
});
