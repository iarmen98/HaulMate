import { describeLocationCode, describeSystemFromContractName } from '../data/places';
import type { Place } from '../data/places';
import { findBodyPosition } from '../data/quantum-travel';
import { findShipModel } from '../data/ships';
import { readBaseTaskId } from '../routing';
import type { CargoTask, RouteRequest, Stop, TravelTiming } from '../routing';
import { buildCargoLegs } from '../state/cargo-legs';
import type { CargoLeg, LegInputs } from '../state/cargo-legs';
import { listActiveHaulingContracts, listCompletedHaulingContracts } from '../state/hauling-state';
import type { Contract, HaulingState } from '../state/hauling-state';

export interface ContractView {
  contract: Contract;
  label: string;
  legs: CargoLeg[];
  totalScu: number;
  hasUnknownScu: boolean;
  crossesSystems: boolean;
  rewardAuec: number | null;
}

export interface ShipCapacity {
  shipName: string | null;
  capacityScu: number | null;
  usableScu: number | null;
}

export interface EarningEntry {
  missionId: string;
  title: string;
  summary: string;
  completedAtMs: number;
  amountAuec: number | null;
}

export interface PlannerSettings {
  shipOverride: string | null;
  customCapacityScu: Readonly<Record<string, number>>;
  usableCapacityPercent: number;
  timing: TravelTiming;
}

const UNCONSTRAINED_CAPACITY_SCU = 1_000_000;

export function describeStop(place: Place): Stop {
  return {
    placeKey: place.name,
    bodyKey: place.bodyId ?? `place:${place.name}`,
    systemKey: place.systemId ?? 'unknown',
    position: findBodyPosition(place.systemId, place.bodyId),
  };
}

export function buildContractViews(
  state: HaulingState,
  inputs: LegInputs,
  rewardsAuec: Readonly<Record<string, number>>,
): ContractView[] {
  return listActiveHaulingContracts(state).map((contract, index) => {
    const legs = buildCargoLegs(contract, inputs);
    const systems = new Set(
      legs.flatMap((leg) => [leg.pickup?.systemId, leg.dropoff.systemId]).filter((system) => system !== null),
    );
    const contractSystem = describeSystemFromContractName(contract.contractName);
    if (contractSystem) {
      systems.add(contractSystem);
    }
    return {
      contract,
      label: `C${index + 1}`,
      legs,
      totalScu: legs.reduce((sum, leg) => sum + (leg.scu ?? 0), 0),
      hasUnknownScu: legs.some((leg) => leg.scu === null),
      crossesSystems: systems.size > 1,
      rewardAuec: contract.payoutAuec ?? rewardsAuec[contract.missionId] ?? null,
    };
  });
}

export function resolveShipCapacity(state: HaulingState, settings: PlannerSettings): ShipCapacity {
  const shipName = settings.shipOverride ?? state.shipName;
  if (shipName === null) {
    return { shipName: null, capacityScu: null, usableScu: null };
  }
  const capacityScu = settings.customCapacityScu[shipName] ?? findShipModel(shipName)?.cargoScu ?? null;
  return {
    shipName,
    capacityScu,
    usableScu: capacityScu === null ? null : Math.floor((capacityScu * settings.usableCapacityPercent) / 100),
  };
}

export function resolveCurrentPlace(state: HaulingState): Place | null {
  return state.locationCode === null ? null : describeLocationCode(state.locationCode);
}

export function buildRouteRequest(
  views: readonly ContractView[],
  start: Place | null,
  capacity: ShipCapacity,
  timing: TravelTiming,
): RouteRequest {
  const tasks: CargoTask[] = views.flatMap((view) =>
    view.legs
      .filter((leg) => leg.status !== 'delivered')
      .map((leg) => ({
        taskId: leg.legId,
        scu: leg.scu ?? 0,
        pickup: leg.status === 'onBoard' || leg.pickup === null ? null : describeStop(leg.pickup),
        dropoff: describeStop(leg.dropoff),
      })),
  );
  return {
    tasks,
    start: start ? describeStop(start) : null,
    capacityScu: capacity.usableScu ?? UNCONSTRAINED_CAPACITY_SCU,
    timing,
  };
}

export function indexLegsByTaskId(
  views: readonly ContractView[],
): Map<string, { leg: CargoLeg; label: string }> {
  const index = new Map<string, { leg: CargoLeg; label: string }>();
  for (const view of views) {
    for (const leg of view.legs) {
      index.set(leg.legId, { leg, label: view.label });
    }
  }
  return index;
}

export function findLeg(
  index: ReadonlyMap<string, { leg: CargoLeg; label: string }>,
  taskId: string,
): { leg: CargoLeg; label: string } | null {
  return index.get(readBaseTaskId(taskId)) ?? null;
}

export function listSessionEarnings(
  state: HaulingState,
  rewardsAuec: Readonly<Record<string, number>>,
): EarningEntry[] {
  return listCompletedHaulingContracts(state).map((contract) => {
    const legs = buildCargoLegs(contract, {
      scuOverrides: {},
      loadedLegIds: new Set(),
      deliveredLegIds: new Set(),
    });
    const commodity = legs[0]?.commodity ?? contract.title;
    const destinations = [...new Set(legs.map((leg) => leg.dropoff.shortName))];
    return {
      missionId: contract.missionId,
      title: contract.title,
      summary: destinations.length > 0 ? `${commodity} → ${destinations.join(', ')}` : contract.title,
      completedAtMs: contract.endedAtMs ?? 0,
      amountAuec: contract.payoutAuec ?? rewardsAuec[contract.missionId] ?? null,
    };
  });
}

export function countFailedContracts(state: HaulingState): number {
  return Object.values(state.contracts).filter(
    (contract) => contract.accepted && contract.status === 'failed',
  ).length;
}
