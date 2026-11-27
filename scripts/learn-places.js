import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const OUTPUT_PATH = new URL('../src/data/known-places.json', import.meta.url);
const OBJECTIVE_PATTERN =
  /Added notification "New Objective: Deliver \d+\/\d+ SCU of .+? to (.+?): " \[\d+\][^\n]*MissionId: \[([0-9a-f-]+)\], ObjectiveId: \[([^\]]+)\]/;
const MARKER_PATTERN =
  /CreateMarker> Creating objective marker: missionId \[([0-9a-f-]+)\][^\n]*?objectiveId \[([^\]]+)\][^\n]*?position \[x: (-?[\d.]+), y: (-?[\d.]+), z: (-?[\d.]+)\]/;
const MIN_DISTANCE_FROM_ORIGIN_M = 1000;
const SYSTEM_WIDE_PLACE_PATTERN = / System$/;

const liveFolder = process.argv[2];
if (!liveFolder) {
  console.error('Usage: node scripts/learn-places.js "<install>/StarCitizen/LIVE"');
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

const existing = existsSync(OUTPUT_PATH) ? JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')) : { places: {} };
const places = new Map(Object.entries(existing.places).map(([name, positions]) => [name, positions]));

function addPosition(name, position) {
  if (SYSTEM_WIDE_PLACE_PATTERN.test(name)) {
    return;
  }
  const positions = places.get(name) ?? [];
  const isKnown = positions.some((known) =>
    known.every((value, axis) => Math.abs(value - position[axis]) < 50),
  );
  if (!isKnown) {
    positions.push(position);
    places.set(name, positions);
  }
}

for (const path of logPaths) {
  const markers = new Map();
  const objectives = [];
  const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    const marker = MARKER_PATTERN.exec(line);
    if (marker) {
      const position = [marker[3], marker[4], marker[5]].map((value) => Math.round(Number(value)));
      markers.set(`${marker[1]}/${marker[2]}`, position);
      continue;
    }
    const objective = OBJECTIVE_PATTERN.exec(line);
    if (objective) {
      objectives.push({ name: objective[1].trim(), key: `${objective[2]}/${objective[3]}` });
    }
  }
  for (const { name, key } of objectives) {
    const position = markers.get(key);
    if (position && Math.hypot(...position) > MIN_DISTANCE_FROM_ORIGIN_M) {
      addPosition(name, position);
    }
  }
}

const sorted = Object.fromEntries([...places.entries()].sort(([left], [right]) => left.localeCompare(right)));
writeFileSync(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      source: 'Positions of named drop-off markers in Game.log files, learnt with scripts/learn-places.js',
      updatedAt: new Date().toISOString().slice(0, 10),
      places: sorted,
    },
    null,
    2,
  )}\n`,
);
console.warn(`Read ${logPaths.length} log(s); ${places.size} places known.`);
