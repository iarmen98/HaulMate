import { guessCommodityFromContractName } from '../data/commodities';
import { describePlace, describeSystemFromContractName, findPlaceNameAt } from '../data/places';
import type { Place } from '../data/places';
import type { Contract, ContractObjective } from './hauling-state';

export type LegStatus = 'toLoad' | 'onBoard' | 'delivered';

export interface CargoLeg {
  legId: string;
  missionId: string;
  dropoffObjectiveId: string;
  commodity: string;
  scu: number | null;
  scuSource: 'log' | 'player' | 'unknown';
  pickup: Place | null;
  dropoff: Place;
  status: LegStatus;
}

export interface LegInputs {
  scuOverrides: Readonly<Record<string, number>>;
  loadedLegIds: ReadonlySet<string>;
  deliveredLegIds: ReadonlySet<string>;
}

const UNKNOWN_PLACE_PREFIX = 'Unknown';

function compareObjectiveIds(left: ContractObjective, right: ContractObjective): number {
  return left.objectiveId.localeCompare(right.objectiveId, 'en', { numeric: true });
}

function resolveObjectivePlace(objective: ContractObjective, systemId: string | null, label: string): Place {
  const name = objective.destinationName ?? (objective.position ? findPlaceNameAt(objective.position) : null);
  if (name) {
    const place = describePlace(name);
    return place.systemId === null ? { ...place, systemId } : place;
  }
  const shortName = `${UNKNOWN_PLACE_PREFIX} ${label}`;
  return { name: `${shortName} · ${objective.objectiveId}`, shortName, systemId, bodyId: null };
}

export function isUnknownPlace(place: Place): boolean {
  return place.name.startsWith(`${UNKNOWN_PLACE_PREFIX} `);
}

function splitEvenly(totalScu: number | null, parts: number): (number | null)[] {
  if (totalScu === null) {
    return Array.from({ length: parts }, () => null);
  }
  const base = Math.floor(totalScu / parts);
  return Array.from({ length: parts }, (_, index) =>
    index === parts - 1 ? totalScu - base * (parts - 1) : base,
  );
}

export function buildCargoLegs(contract: Contract, inputs: LegInputs): CargoLeg[] {
  const objectives = Object.values(contract.objectives).sort(compareObjectiveIds);
  const pickups = objectives.filter((objective) => objective.kind === 'pickup');
  const dropoffs = objectives.filter((objective) => objective.kind === 'dropoff');
  const systemId = describeSystemFromContractName(contract.contractName);
  const contractCommodity = guessCommodityFromContractName(contract.contractName);

  return dropoffs.flatMap((dropoff, dropoffIndex) => {
    const overrideScu = inputs.scuOverrides[`${contract.missionId}/${dropoff.objectiveId}`];
    const totalScu = dropoff.totalScu ?? overrideScu ?? null;
    const scuSource = dropoff.totalScu !== null ? 'log' : overrideScu !== undefined ? 'player' : 'unknown';
    const sources =
      pickups.length === 0
        ? [null]
        : pickups.length === 1 || dropoffs.length > 1
          ? [pickups[dropoffIndex % pickups.length] ?? null]
          : pickups;
    const amounts = splitEvenly(totalScu, sources.length);
    const dropoffPlace = resolveObjectivePlace(dropoff, systemId, 'drop-off');

    return sources.map((pickup, sourceIndex): CargoLeg => {
      const legId = `${contract.missionId}/${pickup?.objectiveId ?? 'none'}/${dropoff.objectiveId}`;
      const delivered = dropoff.completed || inputs.deliveredLegIds.has(legId);
      return {
        legId,
        missionId: contract.missionId,
        dropoffObjectiveId: dropoff.objectiveId,
        commodity: dropoff.commodity ?? contractCommodity ?? 'Cargo',
        scu: amounts[sourceIndex] ?? null,
        scuSource,
        pickup: pickup ? resolveObjectivePlace(pickup, systemId, 'pickup') : null,
        dropoff: dropoffPlace,
        status: delivered ? 'delivered' : inputs.loadedLegIds.has(legId) ? 'onBoard' : 'toLoad',
      };
    });
  });
}
