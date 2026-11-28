import { createReadStream, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const OUTPUT_PATH = new URL('../src/data/quantum-travel.json', import.meta.url);
const REFERENCE_SHIP = 'CRUS_Starlifter_C2';
const MIN_FUEL = 1000;
const EMBEDDING_DIMENSIONS = 3;
const EMBEDDING_ITERATIONS = 4000;
const EMBEDDING_STEP = 0.05;
const MIN_QT_SECONDS = 20;
const MAX_QT_SECONDS = 1200;

const START_PATTERN =
  /\| ([A-Z]{3,5}_[A-Za-z0-9_]+?)_\d{9,}\[\d+\]\|CSCItemNavigation::CalculateRoute\|Projected Start Location is (.+?) for route to destination (\S+)/;
const FUEL_PATTERN =
  /^<([^>]+)> .*?\| ([A-Z]{3,5}_[A-Za-z0-9_]+?)_\d{9,}\[\d+\]\|CSCItemNavigation::CalculateRoute\|Successfully calculated route to (\S+) fuel estimate ([\d.]+)/;
const ARRIVED_PATTERN = /^<([^>]+)> .*Quantum Drive Arrived - Arrived at Final Destination/;

const START_BODIES = {
  'Ruin Station': 'pyro-6',
  Terminus: 'pyro-6',
  'Pyro VI': 'pyro-6',
  Orbituary: 'pyro-3',
  Bloom: 'pyro-3',
  'Pyro III': 'pyro-3',
  'Pyro IV': 'pyro-4',
  'Pyro I': 'pyro-1',
  Checkmate: 'pyro-2-l4',
  Gaslight: 'pyro-5-l2',
  "Rod's Fuel 'N Supplies": 'pyro-5-l4',
  "Rat's Nest": 'pyro-5-l5',
  Endgame: 'pyro-6-l3',
  'Dudley & Daughters': 'pyro-6-l4',
  'Megumi Refueling': 'pyro-6-l5',
  'Patch City': 'pyro-3-l3',
  'Starlight Service Station': 'pyro-3-l1',
  'Stanton Gateway': 'pyro-jp-stanton',
  'Nyx Gateway': 'pyro-jp-nyx',
  'Pyro Gateway': 'stanton-jp-pyro',
  Hurston: 'stanton-1',
  'Everus Harbor': 'stanton-1',
  Lorville: 'stanton-1',
  Crusader: 'stanton-2',
  'Seraphim Station': 'stanton-2',
  Orison: 'stanton-2',
  ArcCorp: 'stanton-3',
  Area18: 'stanton-3',
  'Baijini Point': 'stanton-3',
  microTech: 'stanton-4',
  'Port Tressler': 'stanton-4',
  'New Babbage': 'stanton-4',
};

const DESTINATION_BODIES = {
  'rs_ext_pyro-stan_jp1': 'pyro-jp-stanton',
  'rs_ext_pyro-nyx_jp': 'pyro-jp-nyx',
  'LOC_rs_ext_stan-pyro_jp1': 'stanton-jp-pyro',
  Area18_City_objectContainer: 'stanton-3',
  OOC_Stanton_3_ArcCorp: 'stanton-3',
  ObjectContainer_Lorville_City: 'stanton-1',
  OOC_Stanton_1_Hurston: 'stanton-1',
  OOC_Stanton_2_Crusader: 'stanton-2',
  OOC_Stanton_4_Microtech: 'stanton-4',
};

const STANTON_PLANETS = ['hur', 'cru', 'arc', 'mic'];

function describeStartBody(name) {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (START_BODIES[trimmed]) {
    return START_BODIES[trimmed];
  }
  const pyroLagrange = /^PYR(\d) L(\d)$/.exec(trimmed);
  if (pyroLagrange) {
    return `pyro-${pyroLagrange[1]}-l${pyroLagrange[2]}`;
  }
  const stantonLagrange = /^(HUR|CRU|ARC|MIC) L(\d)$/.exec(trimmed);
  if (stantonLagrange) {
    return `stanton-${STANTON_PLANETS.indexOf(stantonLagrange[1].toLowerCase()) + 1}-l${stantonLagrange[2]}`;
  }
  return null;
}

function describeDestinationBody(code) {
  if (DESTINATION_BODIES[code]) {
    return DESTINATION_BODIES[code];
  }
  const pyro = /^(?:LOC_)?rs_ext_pyro(\d)_(leo|l\d)$/.exec(code);
  if (pyro) {
    return pyro[2] === 'leo' ? `pyro-${pyro[1]}` : `pyro-${pyro[1]}-${pyro[2]}`;
  }
  const stanton = /^(?:LOC_)?rs_ext_(hur|cru|arc|mic)-(leo|l\d)\d*$/.exec(code);
  if (stanton) {
    const planet = STANTON_PLANETS.indexOf(stanton[1]) + 1;
    return stanton[2] === 'leo' ? `stanton-${planet}` : `stanton-${planet}-${stanton[2]}`;
  }
  const stantonRestStop = /^LOC_RR_S(\d)_L(\d)$/.exec(code);
  return stantonRestStop ? `stanton-${stantonRestStop[1]}-l${stantonRestStop[2]}` : null;
}

function readSystem(bodyId) {
  return bodyId.split('-')[0];
}

function computeMedian(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function readRoutes(path) {
  const routes = [];
  let pending = null;
  let lastRoute = null;
  const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('ItemNavigation')) {
      continue;
    }
    const start = START_PATTERN.exec(line);
    if (start) {
      pending = { ship: start[1], startName: start[2], destination: start[3] };
      continue;
    }
    const fuel = FUEL_PATTERN.exec(line);
    if (fuel && pending && pending.destination === fuel[3]) {
      lastRoute = { ...pending, fuel: Number(fuel[4]), selectedAtMs: Date.parse(fuel[1]), durationS: null };
      routes.push(lastRoute);
      pending = null;
      continue;
    }
    const arrived = ARRIVED_PATTERN.exec(line);
    if (arrived && lastRoute && lastRoute.durationS === null) {
      lastRoute.durationS = (Date.parse(arrived[1]) - lastRoute.selectedAtMs) / 1000;
    }
  }
  return routes;
}

function estimateShipScales(samples) {
  const byPair = new Map();
  for (const sample of samples) {
    const entry = byPair.get(sample.pairKey) ?? new Map();
    entry.set(sample.ship, [...(entry.get(sample.ship) ?? []), sample.fuel]);
    byPair.set(sample.pairKey, entry);
  }
  const scales = new Map([[REFERENCE_SHIP, 1]]);
  const ships = new Set(samples.map((sample) => sample.ship));
  for (const ship of ships) {
    if (ship === REFERENCE_SHIP) {
      continue;
    }
    const ratios = [...byPair.values()]
      .filter((entry) => entry.has(REFERENCE_SHIP) && entry.has(ship))
      .map((entry) => computeMedian(entry.get(REFERENCE_SHIP)) / computeMedian(entry.get(ship)));
    if (ratios.length > 0) {
      scales.set(ship, computeMedian(ratios));
    }
  }
  return scales;
}

function embedSystem(nodes, distances) {
  const index = new Map(nodes.map((node, position) => [node, position]));
  let seed = 7;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000 - 0.5;
  };
  const scale = computeMedian([...distances.values()]);
  const points = nodes.map(() => Array.from({ length: EMBEDDING_DIMENSIONS }, () => random() * scale));
  const pairs = [...distances.entries()].map(([key, distance]) => {
    const [left, right] = key.split('|');
    return [index.get(left), index.get(right), distance];
  });
  for (let iteration = 0; iteration < EMBEDDING_ITERATIONS; iteration += 1) {
    const gradients = nodes.map(() => new Array(EMBEDDING_DIMENSIONS).fill(0));
    for (const [left, right, target] of pairs) {
      const delta = points[left].map((value, axis) => value - points[right][axis]);
      const current = Math.hypot(...delta) || 1;
      const factor = (current - target) / current;
      for (let axis = 0; axis < EMBEDDING_DIMENSIONS; axis += 1) {
        gradients[left][axis] += factor * delta[axis];
        gradients[right][axis] -= factor * delta[axis];
      }
    }
    points.forEach((point, position) => {
      for (let axis = 0; axis < EMBEDDING_DIMENSIONS; axis += 1) {
        point[axis] -= EMBEDDING_STEP * gradients[position][axis];
      }
    });
  }
  const errors = pairs.map(
    ([left, right, target]) =>
      Math.abs(Math.hypot(...points[left].map((value, axis) => value - points[right][axis])) - target) /
      target,
  );
  return {
    points: Object.fromEntries(nodes.map((node, position) => [node, points[position].map(Math.round)])),
    errors,
  };
}

function fitLinear(points) {
  const count = points.length;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / count;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / count;
  const slope =
    points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0) /
    points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  return { intercept: meanY - slope * meanX, slope };
}

const liveFolder = process.argv[2];
if (!liveFolder) {
  console.error('Usage: node scripts/learn-travel.js "<install>/StarCitizen/LIVE"');
  process.exit(1);
}

const logPaths = [
  join(liveFolder, 'Game.log'),
  ...(existsSync(join(liveFolder, 'logbackups'))
    ? readdirSync(join(liveFolder, 'logbackups'))
        .filter((name) => name.endsWith('.log'))
        .map((name) => join(liveFolder, 'logbackups', name))
    : []),
].filter((path) => existsSync(path));

const routes = (await Promise.all(logPaths.map(readRoutes))).flat();
const samples = routes.flatMap((route) => {
  const from = describeStartBody(route.startName);
  const to = describeDestinationBody(route.destination);
  if (!from || !to || from === to || readSystem(from) !== readSystem(to) || route.fuel < MIN_FUEL) {
    return [];
  }
  return [{ ...route, pairKey: [from, to].sort().join('|') }];
});
const scales = estimateShipScales(samples);
const normalised = samples
  .filter((sample) => scales.has(sample.ship))
  .map((sample) => ({ ...sample, fuel: sample.fuel * scales.get(sample.ship) }));

const fuelByPair = new Map();
for (const sample of normalised) {
  fuelByPair.set(sample.pairKey, [...(fuelByPair.get(sample.pairKey) ?? []), sample.fuel]);
}
const distances = new Map([...fuelByPair.entries()].map(([key, values]) => [key, computeMedian(values)]));

const systems = {};
for (const system of new Set([...distances.keys()].map((key) => readSystem(key.split('|')[0])))) {
  const systemDistances = new Map([...distances.entries()].filter(([key]) => key.startsWith(`${system}-`)));
  const nodes = [...new Set([...systemDistances.keys()].flatMap((key) => key.split('|')))].sort();
  const { points, errors } = embedSystem(nodes, systemDistances);
  systems[system] = {
    measuredPairCount: systemDistances.size,
    medianEmbeddingError: Number(computeMedian(errors).toFixed(4)),
    positions: points,
    measured: Object.fromEntries(
      [...systemDistances.entries()].map(([key, value]) => [key, Math.round(value)]),
    ),
  };
  console.warn(
    `${system}: ${nodes.length} places, ${systemDistances.size} measured pairs, median fit error ${(computeMedian(errors) * 100).toFixed(1)} %`,
  );
}

const timed = normalised
  .filter((sample) => sample.ship === REFERENCE_SHIP && sample.durationS !== null)
  .filter((sample) => sample.durationS > MIN_QT_SECONDS && sample.durationS < MAX_QT_SECONDS)
  .map((sample) => [sample.fuel, sample.durationS * 1000]);
const { intercept, slope } = fitLinear(timed);

writeFileSync(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      source:
        'Quantum travel fuel estimates and durations in Game.log files, learnt with scripts/learn-travel.js. Distances are in fuel units of a Crusader C2.',
      updatedAt: new Date().toISOString().slice(0, 10),
      sampleCount: normalised.length,
      quantumTime: {
        baseMs: Math.round(intercept),
        msPerFuelUnit: Number(slope.toFixed(8)),
        sampleCount: timed.length,
      },
      systems,
    },
    null,
    2,
  )}\n`,
);
console.warn(
  `Read ${routes.length} routes from ${logPaths.length} logs; quantum time = ${(intercept / 60000).toFixed(2)} min + ${((slope * 1e6) / 60000).toFixed(2)} min per million fuel.`,
);
