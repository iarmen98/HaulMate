import { measureSequenceMs } from './route-model';
import type { RouteModel } from './route-model';

const DEFAULT_TIME_BUDGET_MS = 300;
const MIN_RESTARTS = 8;
const MAX_RESTARTS = 500;

interface TaskNodes {
  pickup: number | null;
  dropoff: number;
}

function groupNodesByTask(model: RouteModel): TaskNodes[] {
  const tasks = new Map<number, TaskNodes>();
  model.nodes.forEach((node, index) => {
    const entry = tasks.get(node.taskIndex) ?? { pickup: null, dropoff: -1 };
    if (node.kind === 'pickup') {
      entry.pickup = index;
    } else {
      entry.dropoff = index;
    }
    tasks.set(node.taskIndex, entry);
  });
  return [...tasks.values()];
}

function insertTaskAtBestPosition(
  model: RouteModel,
  sequence: readonly number[],
  task: TaskNodes,
): { sequence: number[]; costMs: number } {
  let best: number[] = [];
  let bestCostMs = Number.POSITIVE_INFINITY;
  const length = sequence.length;

  if (task.pickup === null) {
    for (let position = 0; position <= length; position += 1) {
      const candidate = [...sequence.slice(0, position), task.dropoff, ...sequence.slice(position)];
      const costMs = measureSequenceMs(model, candidate);
      if (costMs < bestCostMs) {
        bestCostMs = costMs;
        best = candidate;
      }
    }
    return { sequence: best, costMs: bestCostMs };
  }

  for (let pickupPosition = 0; pickupPosition <= length; pickupPosition += 1) {
    for (let dropoffPosition = pickupPosition; dropoffPosition <= length; dropoffPosition += 1) {
      const candidate = [
        ...sequence.slice(0, pickupPosition),
        task.pickup,
        ...sequence.slice(pickupPosition, dropoffPosition),
        task.dropoff,
        ...sequence.slice(dropoffPosition),
      ];
      const costMs = measureSequenceMs(model, candidate);
      if (costMs < bestCostMs) {
        bestCostMs = costMs;
        best = candidate;
      }
    }
  }
  return { sequence: best, costMs: bestCostMs };
}

function removeTask(sequence: readonly number[], task: TaskNodes): number[] {
  return sequence.filter((node) => node !== task.pickup && node !== task.dropoff);
}

function buildSequentialSequence(tasks: readonly TaskNodes[]): number[] {
  const deliveriesFirst = tasks.filter((task) => task.pickup === null).map((task) => task.dropoff);
  const pairs = tasks.flatMap((task) => (task.pickup === null ? [] : [task.pickup, task.dropoff]));
  return [...deliveriesFirst, ...pairs];
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index] as T;
    result[index] = result[swapIndex] as T;
    result[swapIndex] = current;
  }
  return result;
}

function improveByReinsertion(
  model: RouteModel,
  tasks: readonly TaskNodes[],
  initial: number[],
  deadline: number,
): { sequence: number[]; costMs: number } {
  let sequence = initial;
  let bestCostMs = measureSequenceMs(model, sequence);
  let improved = true;
  while (improved && Date.now() < deadline) {
    improved = false;
    for (const task of tasks) {
      const reinserted = insertTaskAtBestPosition(model, removeTask(sequence, task), task);
      if (reinserted.costMs + 1e-6 < bestCostMs) {
        sequence = reinserted.sequence;
        bestCostMs = reinserted.costMs;
        improved = true;
      }
    }
  }
  return { sequence, costMs: bestCostMs };
}

function buildByInsertion(model: RouteModel, order: readonly TaskNodes[]): number[] {
  let sequence: number[] = [];
  for (const task of order) {
    const inserted = insertTaskAtBestPosition(model, sequence, task);
    if (inserted.costMs === Number.POSITIVE_INFINITY) {
      return buildSequentialSequence(order);
    }
    sequence = inserted.sequence;
  }
  return sequence;
}

export function solveHeuristically(
  model: RouteModel,
  timeBudgetMs = DEFAULT_TIME_BUDGET_MS,
): number[] | null {
  const deadline = Date.now() + timeBudgetMs;
  const tasks = groupNodesByTask(model).sort(
    (left, right) =>
      Math.abs(model.nodes[right.dropoff]?.deltaScu ?? 0) -
      Math.abs(model.nodes[left.dropoff]?.deltaScu ?? 0),
  );
  const random = createSeededRandom(model.nodes.length * 7919 + tasks.length);

  let best: { sequence: number[]; costMs: number } | null = null;
  for (let attempt = 0; attempt < MIN_RESTARTS || Date.now() < deadline; attempt += 1) {
    const order = attempt === 0 ? tasks : attempt === 1 ? [...tasks].reverse() : shuffle(tasks, random);
    const candidate = improveByReinsertion(model, tasks, buildByInsertion(model, order), deadline);
    if (best === null || candidate.costMs < best.costMs) {
      best = candidate;
    }
    if (attempt >= MAX_RESTARTS) {
      break;
    }
  }
  return best === null || best.costMs === Number.POSITIVE_INFINITY ? null : best.sequence;
}
