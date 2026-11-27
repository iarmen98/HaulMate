import { readFileSync, writeFileSync } from 'node:fs';

const RECORD_START_PATTERN = /^<\d{4}-\d\d-\d\dT[^>]*> (?:\[|<)/;
const QUEUE_DUMP_PATTERN = /^<\d{4}-\d\d-\d\dT[^>]*> {4}"/;
const KEPT_RECORD_PATTERN =
  /<(CLocalMissionPhaseMarker::CreateMarker|EndMission|MissionEnded|ObjectiveUpserted|ObjectiveComplete|AccountLoginCharacterStatus_Character)>|requested inventory for Location\[|joined channel '|left the channel '|as their destination/;
const KEPT_NOTIFICATION_PATTERN =
  /SHUDEvent_OnNotification> Added notification "(Contract (Accepted|Complete|Failed|Withdrawn)|New Objective|Objective (Complete|Withdrawn|Failed)|Awarded \d[\d,]* aUEC|Entering Armistice|Leaving Armistice|Hangar Request Completed)/;

const [, , sourcePath, targetPath] = process.argv;
if (!sourcePath || !targetPath) {
  console.error('Usage: node scripts/anonymise-log.js <Game.log> <tests/fixtures/name.log>');
  process.exit(1);
}

const playerNames = new Map();
const entityIds = new Map();

function anonymisePlayer(name) {
  if ([...playerNames.values()].includes(name)) {
    return name;
  }
  if (!playerNames.has(name)) {
    playerNames.set(name, `Player${playerNames.size + 1}`);
  }
  return playerNames.get(name);
}

function anonymiseId(id) {
  if (!entityIds.has(id)) {
    entityIds.set(id, String(100000000000 + entityIds.size * 7919));
  }
  return entityIds.get(id);
}

const records = [];
for (const rawLine of readFileSync(sourcePath, 'utf8').split('\n')) {
  const line = rawLine.replace(/\r$/, '');
  if (QUEUE_DUMP_PATTERN.test(line)) {
    continue;
  }
  if (RECORD_START_PATTERN.test(line)) {
    records.push([line]);
  } else if (records.length > 0) {
    records.at(-1).push(line);
  }
}

const ownName = records
  .map((record) => /Character: .*? - name (\S+) - state/.exec(record[0])?.[1])
  .find((name) => name !== undefined);

const output = records
  .filter(([head]) => KEPT_RECORD_PATTERN.test(head) || KEPT_NOTIFICATION_PATTERN.test(head))
  .map((record) => {
    let text = record.join('\n');
    if (ownName) {
      text = text.replaceAll(ownName, anonymisePlayer(ownName));
    }
    return text
      .replace(
        /(joined channel '|left the channel ')([^:']+) : ([^']+)'/g,
        (_, prefix, ship, owner) => `${prefix}${ship} : ${anonymisePlayer(owner)}'`,
      )
      .replace(/Player: ([\w-]+)\[/g, (_, name) => `Player: ${anonymisePlayer(name)}[`)
      .replace(/Player\[([\w-]+)\]/g, (_, name) => `Player[${anonymisePlayer(name)}]`)
      .replace(/(createdAt|updatedAt|geid|accountId) \d+/g, '$1 0')
      .replace(/(?<![\w.-])\d{9,}(?![\w.-])/g, anonymiseId);
  });

writeFileSync(targetPath, `${output.join('\n')}\n`, 'utf8');
console.warn(`Wrote ${output.length} records, ${playerNames.size} player name(s) replaced.`);
console.warn('Review the file before committing: search it for your handle and any other names.');
