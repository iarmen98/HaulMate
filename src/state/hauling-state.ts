import type { HaulmateEvent, ObjectiveKind, Vector3 } from '../parser/events';

export type ContractStatus = 'active' | 'completed' | 'failed' | 'abandoned';

export interface ContractObjective {
  objectiveId: string;
  kind: ObjectiveKind;
  position: Vector3 | null;
  commodity: string | null;
  totalScu: number | null;
  destinationName: string | null;
  completed: boolean;
  isPlayerInside: boolean;
  usedElevatorInside: boolean;
  loadDetected: boolean;
}

export interface Contract {
  missionId: string;
  title: string;
  accepted: boolean;
  contractName: string;
  generatorName: string;
  status: ContractStatus;
  acceptedAtMs: number | null;
  endedAtMs: number | null;
  payoutAuec: number | null;
  objectives: Readonly<Record<string, ContractObjective>>;
}

export interface Payout {
  atMs: number;
  amountAuec: number;
  missionId: string | null;
}

export interface HaulingState {
  playerName: string | null;
  shipName: string | null;
  locationCode: string | null;
  quantumTargetId: string | null;
  contracts: Readonly<Record<string, Contract>>;
  payouts: readonly Payout[];
  unknownHaulingLineCount: number;
  firstEventAtMs: number | null;
  lastEventAtMs: number | null;
}

const PAYOUT_MATCH_WINDOW_MS = 15_000;

export const INITIAL_HAULING_STATE: HaulingState = {
  playerName: null,
  shipName: null,
  locationCode: null,
  quantumTargetId: null,
  contracts: {},
  payouts: [],
  unknownHaulingLineCount: 0,
  firstEventAtMs: null,
  lastEventAtMs: null,
};

function createContract(missionId: string): Contract {
  return {
    missionId,
    title: '',
    accepted: false,
    contractName: '',
    generatorName: '',
    status: 'active',
    acceptedAtMs: null,
    endedAtMs: null,
    payoutAuec: null,
    objectives: {},
  };
}

function createObjective(objectiveId: string): ContractObjective {
  return {
    objectiveId,
    kind: objectiveId.startsWith('pickup_') ? 'pickup' : 'dropoff',
    position: null,
    commodity: null,
    totalScu: null,
    destinationName: null,
    completed: false,
    isPlayerInside: false,
    usedElevatorInside: false,
    loadDetected: false,
  };
}

function updateContract(
  state: HaulingState,
  missionId: string,
  update: (contract: Contract) => Contract,
): HaulingState {
  const contract = state.contracts[missionId] ?? createContract(missionId);
  return { ...state, contracts: { ...state.contracts, [missionId]: update(contract) } };
}

function updateObjective(
  contract: Contract,
  objectiveId: string,
  update: (objective: ContractObjective) => ContractObjective,
): Contract {
  const objective = contract.objectives[objectiveId] ?? createObjective(objectiveId);
  return { ...contract, objectives: { ...contract.objectives, [objectiveId]: update(objective) } };
}

function updateObjectivesInside(
  state: HaulingState,
  update: (objective: ContractObjective) => ContractObjective,
): HaulingState {
  let contracts = state.contracts;
  for (const contract of Object.values(state.contracts)) {
    const inside = Object.values(contract.objectives).filter((objective) => objective.isPlayerInside);
    if (contract.status !== 'active' || inside.length === 0) {
      continue;
    }
    const objectives = { ...contract.objectives };
    for (const objective of inside) {
      objectives[objective.objectiveId] = update(objective);
    }
    contracts = { ...contracts, [contract.missionId]: { ...contract, objectives } };
  }
  return contracts === state.contracts ? state : { ...state, contracts };
}

function endContract(
  state: HaulingState,
  missionId: string,
  status: ContractStatus,
  atMs: number,
): HaulingState {
  const contract = state.contracts[missionId];
  if (!contract || contract.status !== 'active') {
    return state;
  }
  return updateContract(state, missionId, (current) => ({ ...current, status, endedAtMs: atMs }));
}

function findContractAwaitingPayout(state: HaulingState, atMs: number): Contract | null {
  let best: Contract | null = null;
  for (const contract of Object.values(state.contracts)) {
    const isCandidate =
      contract.status === 'completed' &&
      contract.payoutAuec === null &&
      contract.endedAtMs !== null &&
      atMs - contract.endedAtMs >= 0 &&
      atMs - contract.endedAtMs <= PAYOUT_MATCH_WINDOW_MS;
    if (isCandidate && (best === null || (contract.endedAtMs ?? 0) < (best.endedAtMs ?? 0))) {
      best = contract;
    }
  }
  return best;
}

function applyEvent(state: HaulingState, event: HaulmateEvent): HaulingState {
  switch (event.type) {
    case 'PlayerIdentified':
      return { ...state, playerName: event.playerName };
    case 'ContractAccepted':
      return updateContract(state, event.missionId, (contract) => ({
        ...contract,
        title: event.title,
        accepted: true,
        status: 'active',
        acceptedAtMs: event.atMs,
        endedAtMs: null,
      }));
    case 'ObjectiveMarkerCreated':
      return updateContract(state, event.missionId, (contract) =>
        updateObjective(
          { ...contract, contractName: event.contractName, generatorName: event.generatorName },
          event.objectiveId,
          (objective) => ({ ...objective, kind: event.kind, position: event.position }),
        ),
      );
    case 'ObjectiveAdded':
      return updateContract(state, event.missionId, (contract) =>
        updateObjective(contract, event.objectiveId, (objective) => ({
          ...objective,
          kind: 'dropoff',
          commodity: event.commodity,
          totalScu: event.totalScu,
          destinationName: event.destination,
        })),
      );
    case 'ObjectiveCompleted':
      return updateContract(state, event.missionId, (contract) =>
        updateObjective(contract, event.objectiveId, (objective) => ({ ...objective, completed: true })),
      );
    case 'ContractCompleted':
      return endContract(state, event.missionId, 'completed', event.atMs);
    case 'ContractFailed':
      return endContract(state, event.missionId, 'failed', event.atMs);
    case 'ContractAbandoned':
      return endContract(state, event.missionId, 'abandoned', event.atMs);
    case 'PayoutReceived': {
      const contract = findContractAwaitingPayout(state, event.atMs);
      const payout: Payout = {
        atMs: event.atMs,
        amountAuec: event.amountAuec,
        missionId: contract?.missionId ?? null,
      };
      const withPayout = { ...state, payouts: [...state.payouts, payout] };
      return contract
        ? updateContract(withPayout, contract.missionId, (current) => ({
            ...current,
            payoutAuec: event.amountAuec,
          }))
        : withPayout;
    }
    case 'LocationChanged':
      return { ...state, locationCode: event.locationCode };
    case 'ShipBoarded':
      return state.playerName === null || state.playerName === event.ownerName
        ? { ...state, shipName: event.shipName }
        : state;
    case 'ShipLeft':
      return state;
    case 'QuantumDestinationSelected':
      return { ...state, quantumTargetId: event.pointId };
    case 'ObjectiveAreaEntered':
      return updateContract(state, event.missionId, (contract) =>
        updateObjective(contract, event.objectiveId, (objective) => ({
          ...objective,
          isPlayerInside: true,
          usedElevatorInside: false,
        })),
      );
    case 'ObjectiveAreaLeft':
      return updateContract(state, event.missionId, (contract) =>
        updateObjective(contract, event.objectiveId, (objective) => ({
          ...objective,
          isPlayerInside: false,
          loadDetected:
            objective.loadDetected || (objective.kind === 'pickup' && objective.usedElevatorInside),
        })),
      );
    case 'ObjectiveProgressed':
      return updateContract(state, event.missionId, (contract) =>
        updateObjective(contract, event.objectiveId, (objective) => ({ ...objective, loadDetected: true })),
      );
    case 'FreightElevatorUsed':
      return updateObjectivesInside(state, (objective) =>
        objective.kind === 'pickup' ? { ...objective, usedElevatorInside: true } : objective,
      );
    case 'UnknownHaulingLineFound':
      return { ...state, unknownHaulingLineCount: state.unknownHaulingLineCount + 1 };
  }
}

export function reduceEvent(state: HaulingState, event: HaulmateEvent): HaulingState {
  const next = applyEvent(state, event);
  return {
    ...next,
    firstEventAtMs: next.firstEventAtMs ?? event.atMs,
    lastEventAtMs: event.atMs,
  };
}

export function buildState(
  events: Iterable<HaulmateEvent>,
  initial: HaulingState = INITIAL_HAULING_STATE,
): HaulingState {
  let state = initial;
  for (const event of events) {
    state = reduceEvent(state, event);
  }
  return state;
}

export function isHaulingContract(contract: Contract): boolean {
  return (
    /Haul/i.test(contract.generatorName) ||
    /Haul|Cargo/i.test(contract.contractName) ||
    Object.values(contract.objectives).some((objective) => objective.totalScu !== null)
  );
}

export function listActiveHaulingContracts(state: HaulingState): Contract[] {
  return Object.values(state.contracts)
    .filter((contract) => contract.accepted && contract.status === 'active' && isHaulingContract(contract))
    .sort((left, right) => (left.acceptedAtMs ?? 0) - (right.acceptedAtMs ?? 0));
}

export function listCompletedHaulingContracts(state: HaulingState): Contract[] {
  return Object.values(state.contracts)
    .filter((contract) => contract.status === 'completed' && isHaulingContract(contract))
    .sort((left, right) => (left.endedAtMs ?? 0) - (right.endedAtMs ?? 0));
}
