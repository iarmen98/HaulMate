import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/parser';
import { DEFAULT_TRAVEL_TIMING, solveRoute } from '../../src/routing';
import { buildState } from '../../src/state/hauling-state';
import {
  buildContractViews,
  buildRouteRequest,
  listSessionEarnings,
  resolveCurrentPlace,
  resolveShipCapacity,
} from '../../src/ui/planner-model';

const state = buildState(
  parseLog(readFileSync(new URL('../../src/demo/demo-session.log', import.meta.url), 'utf8')),
);
const settings = {
  shipOverride: null,
  customCapacityScu: {},
  usableCapacityPercent: 100,
  timing: DEFAULT_TRAVEL_TIMING,
};
const noInputs = { scuOverrides: {}, loadedLegIds: new Set<string>(), deliveredLegIds: new Set<string>() };

describe('demo session', () => {
  it('reads the player, ship and location', () => {
    expect(state.playerName).toBe('Pilot');
    expect(resolveShipCapacity(state, settings)).toEqual({
      shipName: 'Gatac Railen',
      capacityScu: 320,
      usableScu: 320,
    });
    expect(resolveCurrentPlace(state)?.shortName).toBe('Ruin Station');
  });

  it('labels active contracts in acceptance order', () => {
    const views = buildContractViews(state, noInputs, {});

    expect(views.map((view) => view.label)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5']);
    expect(views.map((view) => view.totalScu)).toEqual([128, 96, 64, 48, 0]);
    expect(views[4]?.hasUnknownScu).toBe(true);
  });

  it('counts the completed contract and its payout', () => {
    expect(listSessionEarnings(state, {})).toMatchObject([
      { amountAuec: 70000, summary: 'Scrap → Patch City' },
    ]);
  });

  it('plans a route that starts where the player is and respects the hold', () => {
    const views = buildContractViews(state, noInputs, {});
    const plan = solveRoute(
      buildRouteRequest(
        views,
        resolveCurrentPlace(state),
        resolveShipCapacity(state, settings),
        DEFAULT_TRAVEL_TIMING,
      ),
    );

    expect(plan.status).toBe('ok');
    expect(plan.visits[0]?.stop.placeKey).toBe('Ruin Station above Pyro VI');
    expect(plan.peakScu).toBeLessThanOrEqual(320);
  });

  it('treats confirmed cargo as on board and drops delivered legs', () => {
    const views = buildContractViews(state, noInputs, {});
    const firstLeg = views[0]?.legs[0];
    const secondLeg = views[1]?.legs[0];
    const confirmed = buildContractViews(
      state,
      {
        ...noInputs,
        loadedLegIds: new Set([firstLeg?.legId ?? '']),
        deliveredLegIds: new Set([secondLeg?.legId ?? '']),
      },
      {},
    );
    const request = buildRouteRequest(
      confirmed,
      null,
      { shipName: null, capacityScu: null, usableScu: null },
      DEFAULT_TRAVEL_TIMING,
    );

    expect(request.tasks.find((task) => task.taskId === firstLeg?.legId)?.pickup).toBeNull();
    expect(request.tasks.some((task) => task.taskId === secondLeg?.legId)).toBe(false);
  });
});
