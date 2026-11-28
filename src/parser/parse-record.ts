import type { HaulmateEvent, ObjectiveKind } from './events';

const TIMESTAMP_PATTERN = /^<(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)>/;
const NOTIFICATION_PATTERN =
  /<SHUDEvent_OnNotification> Added notification "([\s\S]*?)" \[\d+\] to queue\.[\s\S]*?MissionId: \[([0-9a-f-]*)\], ObjectiveId: \[([^\]]*)\]/;
const MARKER_PATTERN =
  /<CLocalMissionPhaseMarker::CreateMarker> Creating objective marker: missionId \[([0-9a-f-]+)\], generator name \[([^\]]*)\], contract \[([^\]]*)\][\s\S]*?objectiveId \[((pickup|dropoff)_[^\]]+)\][\s\S]*?position \[x: (-?[\d.]+), y: (-?[\d.]+), z: (-?[\d.]+)\]/;
const OBJECTIVE_UPSERTED_PATTERN =
  /<ObjectiveUpserted> Received ObjectiveUpserted push message for: mission_id ([0-9a-f-]+) - objective_id (dropoff_\S+) - state MISSION_OBJECTIVE_STATE_COMPLETED/;
const OBJECTIVE_PROGRESSED_PATTERN =
  /<ObjectiveUpserted> Received ObjectiveUpserted push message for: mission_id ([0-9a-f-]+) - objective_id (pickup_\S+) - state MISSION_OBJECTIVE_STATE_(?:INPROGRESS|COMPLETED) - created \d+ - flags=ShowInLog/;
const MARKER_AREA_PATTERN =
  /<CObjectiveMarkerComponent::(RemovePlayer|AddPlayer)> [\s\S]*?(added to|removed from) removed player list[\s\S]*?missionId\[([0-9a-f-]+)\], objectiveId\[([^\]]+)\]/;
const FREIGHT_ELEVATOR_PATTERN = /<CEntityComponentFreightElevatorUIProvider::FillUnstowRequest>/;
const END_MISSION_PATTERN =
  /<EndMission> Ending mission for player\. MissionId\[([0-9a-f-]+)\][\s\S]*?CompletionType\[(\w+)\]/;
const LOCATION_PATTERN = /requested inventory for Location\[([^\]]+)\]/;
const CHARACTER_PATTERN = /<AccountLoginCharacterStatus_Character> Character: [\s\S]*? - name (\S+) - state/;
const QUANTUM_DESTINATION_PATTERN = /selected point (\S+) as their destination/;

const CONTRACT_ACCEPTED_PATTERN = /^Contract Accepted:\s*([\s\S]*?)\s*:?\s*$/;
const MARKUP_PATTERN = /<[A-Za-z0-9]+>[\s\S]*?<\/[A-Za-z0-9]+>|<\/?[A-Za-z0-9]+>/g;
const NEW_DELIVERY_PATTERN = /^New Objective: Deliver (\d+)\/(\d+) SCU of ([\s\S]+?) to ([\s\S]+?)\s*:?\s*$/;
const DELIVERY_COMPLETE_PATTERN = /^Objective Complete: Deliver \d+\/\d+ SCU of /;
const PAYOUT_PATTERN = /^Awarded ([\d,]+) aUEC/;
const CHANNEL_PATTERN = /^You have (joined|left the) channel '(.+) : ([^']+)'\.?$/;
const HAULING_HINT_PATTERN = /\bSCU\b|Hauler|Cargo Haul|Shipment/;

const EMPTY_MISSION_ID = '00000000-0000-0000-0000-000000000000';

export function parseTimestamp(record: string): number | null {
  const match = TIMESTAMP_PATTERN.exec(record);
  if (!match?.[1]) {
    return null;
  }
  const iso = match[1].endsWith('Z') ? match[1] : `${match[1]}Z`;
  const atMs = Date.parse(iso);
  return Number.isNaN(atMs) ? null : atMs;
}

function normaliseText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/, '')
    .trim();
}

function parseNotification(
  atMs: number,
  rawText: string,
  missionId: string,
  objectiveId: string,
): HaulmateEvent | null {
  const text = normaliseText(rawText);
  const hasMission = missionId.length > 0 && missionId !== EMPTY_MISSION_ID;

  const accepted = CONTRACT_ACCEPTED_PATTERN.exec(text);
  if (accepted && hasMission) {
    const title = (accepted[1] ?? '').replace(MARKUP_PATTERN, '').replace(/\s+/g, ' ').trim();
    return { type: 'ContractAccepted', atMs, missionId, title };
  }

  const delivery = NEW_DELIVERY_PATTERN.exec(text);
  if (delivery && hasMission && objectiveId) {
    return {
      type: 'ObjectiveAdded',
      atMs,
      missionId,
      objectiveId,
      deliveredScu: Number(delivery[1]),
      totalScu: Number(delivery[2]),
      commodity: delivery[3]?.trim() ?? '',
      destination: delivery[4]?.trim() ?? '',
    };
  }

  if (DELIVERY_COMPLETE_PATTERN.test(text) && hasMission && objectiveId) {
    return { type: 'ObjectiveCompleted', atMs, missionId, objectiveId };
  }

  if (text.startsWith('Contract Complete:') && hasMission) {
    return { type: 'ContractCompleted', atMs, missionId };
  }

  if (text.startsWith('Contract Failed:') && hasMission) {
    return { type: 'ContractFailed', atMs, missionId };
  }

  if (text.startsWith('Contract Withdrawn:') && hasMission) {
    return { type: 'ContractAbandoned', atMs, missionId };
  }

  const payout = PAYOUT_PATTERN.exec(text);
  if (payout?.[1]) {
    return { type: 'PayoutReceived', atMs, amountAuec: Number(payout[1].replace(/,/g, '')) };
  }

  const channel = CHANNEL_PATTERN.exec(text);
  if (channel?.[2] && channel[3]) {
    return {
      type: channel[1] === 'joined' ? 'ShipBoarded' : 'ShipLeft',
      atMs,
      shipName: channel[2].trim(),
      ownerName: channel[3].trim(),
    };
  }

  if (HAULING_HINT_PATTERN.test(text) && !text.startsWith('Contract Shared:')) {
    return { type: 'UnknownHaulingLineFound', atMs, text };
  }

  return null;
}

function parseEndMission(atMs: number, missionId: string, completionType: string): HaulmateEvent | null {
  switch (completionType) {
    case 'Complete':
      return { type: 'ContractCompleted', atMs, missionId };
    case 'Fail':
      return { type: 'ContractFailed', atMs, missionId };
    case 'Abandon':
    case 'Deactivate':
    case 'Withdraw':
      return { type: 'ContractAbandoned', atMs, missionId };
    default:
      return null;
  }
}

export function parseRecord(record: string): HaulmateEvent | null {
  const atMs = parseTimestamp(record);
  if (atMs === null) {
    return null;
  }

  const notification = NOTIFICATION_PATTERN.exec(record);
  if (notification) {
    return parseNotification(atMs, notification[1] ?? '', notification[2] ?? '', notification[3] ?? '');
  }

  const marker = MARKER_PATTERN.exec(record);
  if (marker) {
    return {
      type: 'ObjectiveMarkerCreated',
      atMs,
      missionId: marker[1] ?? '',
      generatorName: marker[2] ?? '',
      contractName: marker[3] ?? '',
      objectiveId: marker[4] ?? '',
      kind: marker[5] as ObjectiveKind,
      position: { x: Number(marker[6]), y: Number(marker[7]), z: Number(marker[8]) },
    };
  }

  const upserted = OBJECTIVE_UPSERTED_PATTERN.exec(record);
  if (upserted?.[1] && upserted[2]) {
    return { type: 'ObjectiveCompleted', atMs, missionId: upserted[1], objectiveId: upserted[2] };
  }

  const progressed = OBJECTIVE_PROGRESSED_PATTERN.exec(record);
  if (progressed?.[1] && progressed[2]) {
    return { type: 'ObjectiveProgressed', atMs, missionId: progressed[1], objectiveId: progressed[2] };
  }

  const markerArea = MARKER_AREA_PATTERN.exec(record);
  if (markerArea?.[3] && markerArea[4] && !/OnDisconnect: 1/.test(record)) {
    return {
      type: markerArea[2] === 'added to' ? 'ObjectiveAreaEntered' : 'ObjectiveAreaLeft',
      atMs,
      missionId: markerArea[3],
      objectiveId: markerArea[4],
    };
  }

  if (FREIGHT_ELEVATOR_PATTERN.test(record)) {
    return { type: 'FreightElevatorUsed', atMs };
  }

  const endMission = END_MISSION_PATTERN.exec(record);
  if (endMission?.[1] && endMission[2]) {
    return parseEndMission(atMs, endMission[1], endMission[2]);
  }

  const location = LOCATION_PATTERN.exec(record);
  if (location?.[1]) {
    return { type: 'LocationChanged', atMs, locationCode: location[1] };
  }

  const character = CHARACTER_PATTERN.exec(record);
  if (character?.[1]) {
    return { type: 'PlayerIdentified', atMs, playerName: character[1] };
  }

  const quantum = QUANTUM_DESTINATION_PATTERN.exec(record);
  if (quantum?.[1]) {
    return { type: 'QuantumDestinationSelected', atMs, pointId: quantum[1] };
  }

  return null;
}
