import { describe, expect, it } from 'vitest';
import { describePlace, describeQuantumTargetBody } from '../../src/data/places';
import { findBodyPosition, QUANTUM_TIMING } from '../../src/data/quantum-travel';
import { DEFAULT_TRAVEL_TIMING, measureTravelMs, solveRoute } from '../../src/routing';
import type { Stop } from '../../src/routing';
import { describeStop } from '../../src/ui/planner-model';

const TIMING = { ...DEFAULT_TRAVEL_TIMING, ...QUANTUM_TIMING };

function stopFor(name: string): Stop {
  return describeStop(describePlace(name));
}

describe('quantum travel data', () => {
  it('has positions for the main Pyro stations', () => {
    for (const bodyId of ['pyro-6', 'pyro-3', 'pyro-2-l4', 'pyro-5-l2', 'pyro-jp-stanton']) {
      expect(findBodyPosition('pyro', bodyId)).not.toBeNull();
    }
  });

  it('gives quantum times in a realistic range', () => {
    const ruin = stopFor('Ruin Station above Pyro VI');
    const gaslight = stopFor('Gaslight at the L2 Lagrange of Pyro V');
    const minutes = measureTravelMs(ruin, gaslight, TIMING) / 60_000;

    expect(minutes).toBeGreaterThan(3);
    expect(minutes).toBeLessThan(12);
  });

  it('prefers the nearer station when the order is otherwise free', () => {
    const start = stopFor('Stanton Gateway');
    const near = stopFor('Orbituary above Pyro III');
    const far = stopFor('Gaslight at the L2 Lagrange of Pyro V');
    const farFromNear = measureTravelMs(near, far, TIMING);
    const nearFromFar = measureTravelMs(far, near, TIMING);
    const plan = solveRoute({
      tasks: [
        { taskId: 'A', scu: 10, pickup: null, dropoff: near },
        { taskId: 'B', scu: 10, pickup: null, dropoff: far },
      ],
      start,
      capacityScu: 320,
      timing: TIMING,
    });
    const expectedFirst =
      measureTravelMs(start, near, TIMING) + farFromNear <= measureTravelMs(start, far, TIMING) + nearFromFar
        ? near
        : far;

    expect(plan.visits[0]?.stop.placeKey).toBe(expectedFirst.placeKey);
    expect(plan.visits[0]?.travelMs).toBeGreaterThan(0);
  });
});

describe('describeQuantumTargetBody', () => {
  it.each([
    ['rs_ext_pyro6_l3', 'pyro-6-l3'],
    ['rs_ext_pyro6_leo', 'pyro-6'],
    ['rs_ext_pyro-stan_jp1', 'pyro-jp-stanton'],
    ['LOC_rs_ext_stan-pyro_jp1', 'stanton-jp-pyro'],
    ['rs_ext_cru-leo1', 'stanton-2'],
    ['NavPoint_Dynamic_1', null],
  ])('maps %s', (pointId, bodyId) => {
    expect(describeQuantumTargetBody(pointId)).toBe(bodyId);
  });
});
