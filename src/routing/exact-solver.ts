import type { RouteModel } from './route-model';

export const EXACT_NODE_LIMIT = 16;

export function solveExactly(model: RouteModel): number[] | null {
  const count = model.nodes.length;
  if (count === 0) {
    return [];
  }
  if (count > EXACT_NODE_LIMIT) {
    throw new RangeError(`Exact solver supports up to ${EXACT_NODE_LIMIT} nodes, got ${count}`);
  }

  const setCount = 1 << count;
  const loadScu = new Float64Array(setCount);
  const requiredMask = new Int32Array(count);
  model.nodes.forEach((node, index) => {
    requiredMask[index] = node.requiredNode === null ? 0 : 1 << node.requiredNode;
  });
  loadScu[0] = model.initialScu;
  for (let set = 1; set < setCount; set += 1) {
    const lowestBit = set & -set;
    const nodeIndex = 31 - Math.clz32(lowestBit);
    loadScu[set] = (loadScu[set ^ lowestBit] ?? 0) + (model.nodes[nodeIndex]?.deltaScu ?? 0);
  }

  const bestMs = new Float64Array(setCount * count).fill(Number.POSITIVE_INFINITY);
  const previousNode = new Int8Array(setCount * count).fill(-1);

  for (let node = 0; node < count; node += 1) {
    const set = 1 << node;
    if ((requiredMask[node] ?? 0) === 0 && (loadScu[set] ?? 0) <= model.capacityScu) {
      bestMs[set * count + node] = model.startCostMs[node] ?? 0;
    }
  }

  for (let set = 1; set < setCount; set += 1) {
    for (let last = 0; last < count; last += 1) {
      const current = bestMs[set * count + last] ?? Number.POSITIVE_INFINITY;
      if (current === Number.POSITIVE_INFINITY) {
        continue;
      }
      for (let next = 0; next < count; next += 1) {
        const nextBit = 1 << next;
        if ((set & nextBit) !== 0 || ((requiredMask[next] ?? 0) & set) !== (requiredMask[next] ?? 0)) {
          continue;
        }
        const nextSet = set | nextBit;
        if ((loadScu[nextSet] ?? 0) > model.capacityScu) {
          continue;
        }
        const candidate = current + (model.costMs[last * count + next] ?? 0);
        const slot = nextSet * count + next;
        if (candidate < (bestMs[slot] ?? Number.POSITIVE_INFINITY)) {
          bestMs[slot] = candidate;
          previousNode[slot] = last;
        }
      }
    }
  }

  const fullSet = setCount - 1;
  let bestLast = -1;
  let bestTotal = Number.POSITIVE_INFINITY;
  for (let last = 0; last < count; last += 1) {
    const total = bestMs[fullSet * count + last] ?? Number.POSITIVE_INFINITY;
    if (total < bestTotal) {
      bestTotal = total;
      bestLast = last;
    }
  }
  if (bestLast < 0) {
    return null;
  }

  const sequence: number[] = [];
  let set = fullSet;
  let node = bestLast;
  while (node >= 0) {
    sequence.push(node);
    const previous = previousNode[set * count + node] ?? -1;
    set ^= 1 << node;
    node = previous;
  }
  return sequence.reverse();
}
