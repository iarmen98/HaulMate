import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLog, splitRecords } from '../../src/parser';
import type { HaulmateEvent, HaulmateEventType } from '../../src/parser';

const FIXTURES = ['pyro-4-2-session.log', 'stanton-4-0-session.log'] as const;
const HAULING_NOTIFICATION_PATTERN =
  /Added notification "(Contract (Accepted|Complete|Failed|Withdrawn)|New Objective: Deliver|Objective Complete: Deliver|Awarded)/;

function readFixture(name: string): string {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
}

function countByType(events: HaulmateEvent[]): Partial<Record<HaulmateEventType, number>> {
  const counts: Partial<Record<HaulmateEventType, number>> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }
  return counts;
}

describe.each(FIXTURES)('fixture %s', (fixture) => {
  const text = readFixture(fixture);
  const events = parseLog(text);

  it('has no unknown hauling lines', () => {
    expect(events.filter((event) => event.type === 'UnknownHaulingLineFound')).toEqual([]);
  });

  it('maps every hauling notification to an event', () => {
    const haulingRecords = splitRecords(text).filter((record) => HAULING_NOTIFICATION_PATTERN.test(record));
    const haulingEvents = events.filter((event) =>
      [
        'ContractAccepted',
        'ObjectiveAdded',
        'ObjectiveCompleted',
        'ContractCompleted',
        'ContractFailed',
        'ContractAbandoned',
        'PayoutReceived',
      ].includes(event.type),
    );

    expect(haulingRecords.length).toBeGreaterThan(0);
    expect(haulingEvents.length).toBeGreaterThanOrEqual(haulingRecords.length);
  });

  it('identifies the player and the ship they boarded', () => {
    const counts = countByType(events);

    expect(counts.PlayerIdentified).toBe(1);
    expect(counts.ShipBoarded).toBeGreaterThan(0);
  });

  it('emits events in timestamp order', () => {
    const timestamps = events.map((event) => event.atMs);

    expect(timestamps).toEqual([...timestamps].sort((left, right) => left - right));
  });
});

describe('pyro-4-2-session.log', () => {
  const events = parseLog(readFixture('pyro-4-2-session.log'));

  it('reads markers for every accepted hauling contract', () => {
    const accepted = new Set(
      events.flatMap((event) =>
        event.type === 'ContractAccepted' && /Haul|Shipment/.test(event.title) ? [event.missionId] : [],
      ),
    );
    const withMarkers = new Set(
      events.flatMap((event) => (event.type === 'ObjectiveMarkerCreated' ? [event.missionId] : [])),
    );

    expect(accepted.size).toBe(17);
    expect([...accepted].filter((missionId) => !withMarkers.has(missionId))).toEqual([]);
  });
});

describe('stanton-4-0-session.log', () => {
  const events = parseLog(readFixture('stanton-4-0-session.log'));

  it('reads every payout', () => {
    const payouts = events.flatMap((event) => (event.type === 'PayoutReceived' ? [event.amountAuec] : []));

    expect(payouts).toHaveLength(16);
    expect(payouts.every((amountAuec) => amountAuec > 0)).toBe(true);
  });
});
