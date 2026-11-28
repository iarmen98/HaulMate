import { EXACT_NODE_LIMIT, solveExactly } from './exact-solver';
import { solveHeuristically } from './heuristic-solver';
import { buildRouteModel, classifyHop, measureMoveMs, measureTravelMs } from './route-model';
import type { RouteModel } from './route-model';
import type { CargoTask, RoutePlan, RouteRequest, RouteVisit, Stop } from './types';

const SPLIT_SEPARATOR = '#';

export function readBaseTaskId(taskId: string): string {
  const separatorIndex = taskId.indexOf(SPLIT_SEPARATOR);
  return separatorIndex < 0 ? taskId : taskId.slice(0, separatorIndex);
}

export function splitOversizedTasks(
  tasks: readonly CargoTask[],
  capacityScu: number,
): { tasks: CargoTask[]; splitTaskIds: string[] } {
  const result: CargoTask[] = [];
  const splitTaskIds: string[] = [];
  for (const task of tasks) {
    if (task.pickup === null || task.scu <= capacityScu || capacityScu <= 0) {
      result.push(task);
      continue;
    }
    splitTaskIds.push(task.taskId);
    const batchCount = Math.ceil(task.scu / capacityScu);
    for (let batch = 0; batch < batchCount; batch += 1) {
      const scu = batch === batchCount - 1 ? task.scu - capacityScu * (batchCount - 1) : capacityScu;
      result.push({ ...task, taskId: `${task.taskId}${SPLIT_SEPARATOR}${batch + 1}`, scu });
    }
  }
  return { tasks: result, splitTaskIds };
}

function describeVisits(
  model: RouteModel,
  tasks: readonly CargoTask[],
  sequence: readonly number[],
  start: Stop | null,
  request: RouteRequest,
): RouteVisit[] {
  const visits: RouteVisit[] = [];
  let onboardScu = model.initialScu;
  let elapsedMs = 0;
  let previousStop = start;
  sequence.forEach((nodeIndex, position) => {
    const node = model.nodes[nodeIndex];
    const task = node ? tasks[node.taskIndex] : undefined;
    if (!node || !task) {
      return;
    }
    elapsedMs += measureMoveMs(previousStop, node.stop, request.timing, position === 0);
    elapsedMs += task.scu * request.timing.handlingMsPerScu;
    onboardScu += node.deltaScu;
    const last = visits.at(-1);
    const visit =
      last && last.stop.placeKey === node.stop.placeKey
        ? last
        : {
            stop: node.stop,
            loads: [],
            unloads: [],
            loadedScu: 0,
            unloadedScu: 0,
            onboardScuAfter: 0,
            hop: classifyHop(previousStop, node.stop),
            travelMs: measureTravelMs(previousStop, node.stop, request.timing),
            arrivalMs: 0,
          };
    if (visit !== last) {
      visits.push(visit);
    }
    if (node.kind === 'pickup') {
      visit.loads.push({ taskId: task.taskId, scu: task.scu });
      visit.loadedScu += task.scu;
    } else {
      visit.unloads.push({ taskId: task.taskId, scu: task.scu });
      visit.unloadedScu += task.scu;
    }
    visit.onboardScuAfter = onboardScu;
    visit.arrivalMs = elapsedMs;
    previousStop = node.stop;
  });
  return visits;
}

export function solveRoute(request: RouteRequest): RoutePlan {
  const onboardScu = request.tasks.reduce((sum, task) => sum + (task.pickup === null ? task.scu : 0), 0);
  const isOverCapacity = onboardScu > request.capacityScu;
  const capacityScu = isOverCapacity ? onboardScu : request.capacityScu;
  const { tasks, splitTaskIds } = splitOversizedTasks(request.tasks, capacityScu);

  if (tasks.length === 0) {
    return {
      status: 'empty',
      method: 'none',
      visits: [],
      totalMs: 0,
      quantumHopCount: 0,
      jumpCount: 0,
      peakScu: 0,
      splitTaskIds,
    };
  }

  const model = buildRouteModel(tasks, request.start, capacityScu, request.timing);
  const method = model.nodes.length <= EXACT_NODE_LIMIT ? 'exact' : 'heuristic';
  const sequence =
    (method === 'exact' ? solveExactly(model) : solveHeuristically(model, request.timeBudgetMs)) ??
    model.nodes.map((_, index) => index);
  const visits = describeVisits(model, tasks, sequence, request.start, request);

  return {
    status: isOverCapacity ? 'overCapacity' : 'ok',
    method,
    visits,
    totalMs: visits.at(-1)?.arrivalMs ?? 0,
    quantumHopCount: visits.filter((visit) => visit.hop === 'quantum' || visit.hop === 'jump').length,
    jumpCount: visits.filter((visit) => visit.hop === 'jump').length,
    peakScu: Math.max(onboardScu, ...visits.map((visit) => visit.onboardScuAfter)),
    splitTaskIds,
  };
}
