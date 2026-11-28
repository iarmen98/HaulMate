import type { CargoTask, HopKind, Stop, TravelTiming } from './types';

export interface RouteNode {
  taskIndex: number;
  kind: 'pickup' | 'dropoff';
  stop: Stop;
  deltaScu: number;
  requiredNode: number | null;
}

export interface RouteModel {
  nodes: RouteNode[];
  initialScu: number;
  capacityScu: number;
  startCostMs: Float64Array;
  costMs: Float64Array;
}

export function classifyHop(from: Stop | null, to: Stop): HopKind {
  if (from === null || from.placeKey === to.placeKey) {
    return 'none';
  }
  if (from.systemKey !== to.systemKey) {
    return 'jump';
  }
  return from.bodyKey === to.bodyKey ? 'local' : 'quantum';
}

export function measureQuantumMs(from: Stop, to: Stop, timing: TravelTiming): number {
  const hasModel = timing.quantumMsPerFuel > 0 && from.position && to.position;
  if (!hasModel || !from.position || !to.position) {
    return timing.quantumHopMs;
  }
  const [fromX, fromY, fromZ] = from.position;
  const [toX, toY, toZ] = to.position;
  return timing.quantumBaseMs + timing.quantumMsPerFuel * Math.hypot(fromX - toX, fromY - toY, fromZ - toZ);
}

export function measureTravelMs(from: Stop | null, to: Stop, timing: TravelTiming): number {
  if (from === null) {
    return 0;
  }
  switch (classifyHop(from, to)) {
    case 'none':
      return 0;
    case 'local':
      return timing.localHopMs;
    case 'quantum':
      return measureQuantumMs(from, to, timing);
    case 'jump':
      return timing.quantumHopMs + timing.jumpMs;
  }
}

export function measureMoveMs(
  from: Stop | null,
  to: Stop,
  timing: TravelTiming,
  isFirstMove: boolean,
): number {
  if (from === null && isFirstMove) {
    return timing.stopOverheadMs;
  }
  const hop = classifyHop(from, to);
  return hop === 'none' ? 0 : measureTravelMs(from, to, timing) + timing.stopOverheadMs;
}

export function buildRouteModel(
  tasks: readonly CargoTask[],
  start: Stop | null,
  capacityScu: number,
  timing: TravelTiming,
): RouteModel {
  const nodes: RouteNode[] = [];
  let initialScu = 0;
  tasks.forEach((task, taskIndex) => {
    if (task.pickup === null) {
      initialScu += task.scu;
      nodes.push({ taskIndex, kind: 'dropoff', stop: task.dropoff, deltaScu: -task.scu, requiredNode: null });
      return;
    }
    const pickupIndex = nodes.length;
    nodes.push({ taskIndex, kind: 'pickup', stop: task.pickup, deltaScu: task.scu, requiredNode: null });
    nodes.push({
      taskIndex,
      kind: 'dropoff',
      stop: task.dropoff,
      deltaScu: -task.scu,
      requiredNode: pickupIndex,
    });
  });

  const count = nodes.length;
  const startCostMs = new Float64Array(count);
  const costMs = new Float64Array(count * count);
  nodes.forEach((node, index) => {
    startCostMs[index] = measureMoveMs(start, node.stop, timing, true);
    nodes.forEach((other, otherIndex) => {
      costMs[index * count + otherIndex] = measureMoveMs(node.stop, other.stop, timing, false);
    });
  });

  return { nodes, initialScu, capacityScu, startCostMs, costMs };
}

export function measureSequenceMs(model: RouteModel, sequence: readonly number[]): number {
  let totalMs = 0;
  let previous = -1;
  let onboardScu = model.initialScu;
  const done = new Set<number>();
  for (const nodeIndex of sequence) {
    const node = model.nodes[nodeIndex];
    if (!node || (node.requiredNode !== null && !done.has(node.requiredNode))) {
      return Number.POSITIVE_INFINITY;
    }
    onboardScu += node.deltaScu;
    if (onboardScu > model.capacityScu) {
      return Number.POSITIVE_INFINITY;
    }
    totalMs +=
      previous < 0
        ? (model.startCostMs[nodeIndex] ?? 0)
        : (model.costMs[previous * model.nodes.length + nodeIndex] ?? 0);
    done.add(nodeIndex);
    previous = nodeIndex;
  }
  return totalMs;
}
