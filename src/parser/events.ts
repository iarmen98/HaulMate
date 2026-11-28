export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type ObjectiveKind = 'pickup' | 'dropoff';

interface EventBase {
  atMs: number;
}

export interface PlayerIdentified extends EventBase {
  type: 'PlayerIdentified';
  playerName: string;
}

export interface ContractAccepted extends EventBase {
  type: 'ContractAccepted';
  missionId: string;
  title: string;
}

export interface ContractCompleted extends EventBase {
  type: 'ContractCompleted';
  missionId: string;
}

export interface ContractFailed extends EventBase {
  type: 'ContractFailed';
  missionId: string;
}

export interface ContractAbandoned extends EventBase {
  type: 'ContractAbandoned';
  missionId: string;
}

export interface ObjectiveMarkerCreated extends EventBase {
  type: 'ObjectiveMarkerCreated';
  missionId: string;
  objectiveId: string;
  kind: ObjectiveKind;
  generatorName: string;
  contractName: string;
  position: Vector3;
}

export interface ObjectiveAdded extends EventBase {
  type: 'ObjectiveAdded';
  missionId: string;
  objectiveId: string;
  commodity: string;
  deliveredScu: number;
  totalScu: number;
  destination: string;
}

export interface ObjectiveCompleted extends EventBase {
  type: 'ObjectiveCompleted';
  missionId: string;
  objectiveId: string;
}

export interface PayoutReceived extends EventBase {
  type: 'PayoutReceived';
  amountAuec: number;
}

export interface LocationChanged extends EventBase {
  type: 'LocationChanged';
  locationCode: string;
}

export interface ShipBoarded extends EventBase {
  type: 'ShipBoarded';
  shipName: string;
  ownerName: string;
}

export interface ShipLeft extends EventBase {
  type: 'ShipLeft';
  shipName: string;
  ownerName: string;
}

export interface QuantumDestinationSelected extends EventBase {
  type: 'QuantumDestinationSelected';
  pointId: string;
}

export interface ObjectiveAreaEntered extends EventBase {
  type: 'ObjectiveAreaEntered';
  missionId: string;
  objectiveId: string;
}

export interface ObjectiveAreaLeft extends EventBase {
  type: 'ObjectiveAreaLeft';
  missionId: string;
  objectiveId: string;
}

export interface ObjectiveProgressed extends EventBase {
  type: 'ObjectiveProgressed';
  missionId: string;
  objectiveId: string;
}

export interface FreightElevatorUsed extends EventBase {
  type: 'FreightElevatorUsed';
}

export interface UnknownHaulingLineFound extends EventBase {
  type: 'UnknownHaulingLineFound';
  text: string;
}

export type HaulmateEvent =
  | PlayerIdentified
  | ContractAccepted
  | ContractCompleted
  | ContractFailed
  | ContractAbandoned
  | ObjectiveMarkerCreated
  | ObjectiveAdded
  | ObjectiveCompleted
  | PayoutReceived
  | LocationChanged
  | ShipBoarded
  | ShipLeft
  | QuantumDestinationSelected
  | ObjectiveAreaEntered
  | ObjectiveAreaLeft
  | ObjectiveProgressed
  | FreightElevatorUsed
  | UnknownHaulingLineFound;

export type HaulmateEventType = HaulmateEvent['type'];
