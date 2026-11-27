import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { solveExactly } from '../../src/routing/exact-solver';
import { solveHeuristically } from '../../src/routing/heuristic-solver';
import { buildRouteModel, measureSequenceMs } from '../../src/routing/route-model';
import type { RouteModel } from '../../src/routing/route-model';
import { DEFAULT_TRAVEL_TIMING, readBaseTaskId, solveRoute } from '../../src/routing';
import type { CargoTask, Stop } from '../../src/routing';

const STOPS: Stop[] = [
  { placeKey: 'Ruin Station', bodyKey: 'pyro-6', systemKey: 'pyro' },
  { placeKey: 'Last Landings', bodyKey: 'pyro-6', systemKey: 'pyro' },
  { placeKey: 'Checkmate', bodyKey: 'pyro-2-l4', systemKey: 'pyro' },
  { placeKey: 'Orbituary', bodyKey: 'pyro-3', systemKey: 'pyro' },
  { placeKey: 'Patch City', bodyKey: 'pyro-3-l3', systemKey: 'pyro' },
  { placeKey: 'Everus Harbor', bodyKey: 'stanton-1', systemKey: 'stanton' },
];

function stopAt(index: number): Stop {
  return STOPS[index % STOPS.length] as Stop;
}

function findBestByBruteForce(model: RouteModel): number {
  const count = model.nodes.length;
  let best = Number.POSITIVE_INFINITY;
  const sequence: number[] = [];
  const used = new Array<boolean>(count).fill(false);
  const visit = () => {
    if (sequence.length === count) {
      best = Math.min(best, measureSequenceMs(model, sequence));
      return;
    }
    for (let node = 0; node < count; node += 1) {
      if (!used[node]) {
        used[node] = true;
        sequence.push(node);
        if (measureSequenceMs(model, sequence) < best) {
          visit();
        }
        sequence.pop();
        used[node] = false;
      }
    }
  };
  visit();
  return best;
}

const taskArbitrary = fc.record({
  scu: fc.integer({ min: 1, max: 120 }),
  pickupIndex: fc.option(fc.integer({ min: 0, max: STOPS.length - 1 }), { freq: 4 }),
  dropoffIndex: fc.integer({ min: 0, max: STOPS.length - 1 }),
});

function toTasks(raw: { scu: number; pickupIndex: number | null; dropoffIndex: number }[]): CargoTask[] {
  return raw.map((task, index) => ({
    taskId: `T${index}`,
    scu: task.scu,
    pickup: task.pickupIndex === null ? null : stopAt(task.pickupIndex),
    dropoff: stopAt(task.dropoffIndex),
  }));
}

describe('exact solver', () => {
  it('matches brute force on random instances up to 8 nodes', () => {
    fc.assert(
      fc.property(
        fc.array(taskArbitrary, { minLength: 1, maxLength: 4 }),
        fc.integer({ min: 0, max: STOPS.length - 1 }),
        fc.integer({ min: 120, max: 320 }),
        (rawTasks, startIndex, capacityScu) => {
          const tasks = toTasks(rawTasks);
          const initialScu = tasks.reduce((sum, task) => sum + (task.pickup === null ? task.scu : 0), 0);
          fc.pre(initialScu <= capacityScu);
          const model = buildRouteModel(tasks, stopAt(startIndex), capacityScu, DEFAULT_TRAVEL_TIMING);
          const sequence = solveExactly(model);
          const expected = findBestByBruteForce(model);

          if (expected === Number.POSITIVE_INFINITY) {
            expect(sequence).toBeNull();
          } else {
            expect(sequence).not.toBeNull();
            expect(measureSequenceMs(model, sequence ?? [])).toBe(expected);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('solves 16 nodes in under a second', () => {
    const tasks = Array.from({ length: 8 }, (_, index) => ({
      taskId: `T${index}`,
      scu: 40,
      pickup: stopAt(index),
      dropoff: stopAt(index + 3),
    }));
    const model = buildRouteModel(tasks, stopAt(0), 320, DEFAULT_TRAVEL_TIMING);
    const startedAt = performance.now();

    const sequence = solveExactly(model);

    expect(performance.now() - startedAt).toBeLessThan(1000);
    expect(sequence).toHaveLength(16);
  });
});

describe('heuristic solver', () => {
  it('always returns a valid route within 15 % of the optimum on small instances', () => {
    fc.assert(
      fc.property(fc.array(taskArbitrary, { minLength: 1, maxLength: 4 }), (rawTasks) => {
        const tasks = toTasks(rawTasks);
        const capacityScu = Math.max(
          320,
          tasks.reduce((sum, task) => sum + task.scu, 0),
        );
        const model = buildRouteModel(tasks, stopAt(0), capacityScu, DEFAULT_TRAVEL_TIMING);
        const optimum = measureSequenceMs(model, solveExactly(model) ?? []);
        const heuristic = measureSequenceMs(model, solveHeuristically(model, 50) ?? []);

        expect(heuristic).toBeLessThan(Number.POSITIVE_INFINITY);
        expect(heuristic).toBeLessThanOrEqual(optimum * 1.15);
      }),
      { numRuns: 100 },
    );
  });
});

describe('solveRoute', () => {
  const ruin = stopAt(0);
  const checkmate = stopAt(2);
  const orbituary = stopAt(3);

  it('groups contracts that share a station into one visit', () => {
    const plan = solveRoute({
      tasks: [
        { taskId: 'C1', scu: 128, pickup: ruin, dropoff: orbituary },
        { taskId: 'C3', scu: 64, pickup: ruin, dropoff: checkmate },
      ],
      start: ruin,
      capacityScu: 320,
      timing: DEFAULT_TRAVEL_TIMING,
    });

    expect(plan.visits[0]?.stop.placeKey).toBe('Ruin Station');
    expect(plan.visits[0]?.loadTaskIds.sort()).toEqual(['C1', 'C3']);
    expect(plan.visits).toHaveLength(3);
  });

  it('accepts a hold that is exactly full', () => {
    const plan = solveRoute({
      tasks: [
        { taskId: 'A', scu: 200, pickup: ruin, dropoff: checkmate },
        { taskId: 'B', scu: 120, pickup: ruin, dropoff: orbituary },
      ],
      start: ruin,
      capacityScu: 320,
      timing: DEFAULT_TRAVEL_TIMING,
    });

    expect(plan.status).toBe('ok');
    expect(plan.peakScu).toBe(320);
  });

  it('interleaves deliveries when contracts add up to more than the hold', () => {
    const plan = solveRoute({
      tasks: [
        { taskId: 'A', scu: 200, pickup: ruin, dropoff: checkmate },
        { taskId: 'B', scu: 200, pickup: ruin, dropoff: orbituary },
      ],
      start: ruin,
      capacityScu: 320,
      timing: DEFAULT_TRAVEL_TIMING,
    });

    expect(plan.status).toBe('ok');
    expect(plan.peakScu).toBeLessThanOrEqual(320);
    expect(plan.visits.map((visit) => visit.stop.placeKey)).toHaveLength(4);
  });

  it('splits a contract larger than the hold into batches', () => {
    const plan = solveRoute({
      tasks: [{ taskId: 'BIG', scu: 400, pickup: ruin, dropoff: checkmate }],
      start: ruin,
      capacityScu: 320,
      timing: DEFAULT_TRAVEL_TIMING,
    });

    expect(plan.splitTaskIds).toEqual(['BIG']);
    expect(plan.peakScu).toBe(320);
    const loaded = plan.visits.flatMap((visit) => visit.loadTaskIds);
    expect(loaded.map(readBaseTaskId)).toEqual(['BIG', 'BIG']);
  });

  it('counts a jump when the route crosses systems', () => {
    const plan = solveRoute({
      tasks: [{ taskId: 'X', scu: 10, pickup: ruin, dropoff: stopAt(5) }],
      start: ruin,
      capacityScu: 320,
      timing: DEFAULT_TRAVEL_TIMING,
    });

    expect(plan.jumpCount).toBe(1);
  });

  it('delivers cargo already on board without picking it up', () => {
    const plan = solveRoute({
      tasks: [{ taskId: 'ON', scu: 50, pickup: null, dropoff: checkmate }],
      start: ruin,
      capacityScu: 320,
      timing: DEFAULT_TRAVEL_TIMING,
    });

    expect(plan.visits).toHaveLength(1);
    expect(plan.visits[0]?.unloadTaskIds).toEqual(['ON']);
  });

  it('reports cargo on board above capacity', () => {
    const plan = solveRoute({
      tasks: [{ taskId: 'ON', scu: 400, pickup: null, dropoff: checkmate }],
      start: ruin,
      capacityScu: 320,
      timing: DEFAULT_TRAVEL_TIMING,
    });

    expect(plan.status).toBe('overCapacity');
  });

  it('uses the heuristic above 16 nodes and keeps every task', () => {
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      taskId: `T${index}`,
      scu: 30,
      pickup: stopAt(index),
      dropoff: stopAt(index + 2),
    }));
    const plan = solveRoute({
      tasks,
      start: ruin,
      capacityScu: 320,
      timing: DEFAULT_TRAVEL_TIMING,
      timeBudgetMs: 100,
    });

    expect(plan.method).toBe('heuristic');
    expect(plan.visits.flatMap((visit) => visit.unloadTaskIds).sort()).toEqual(
      tasks.map((task) => task.taskId).sort(),
    );
  });

  it('returns an empty plan with no tasks', () => {
    expect(
      solveRoute({ tasks: [], start: null, capacityScu: 320, timing: DEFAULT_TRAVEL_TIMING }).status,
    ).toBe('empty');
  });
});
