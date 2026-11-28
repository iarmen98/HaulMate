import quantumTravel from './quantum-travel.json';

type Position = readonly [number, number, number];

interface SystemTravelData {
  positions: Record<string, number[]>;
}

const SYSTEMS = quantumTravel.systems as Record<string, SystemTravelData>;

export const QUANTUM_TIMING = {
  quantumBaseMs: quantumTravel.quantumTime.baseMs,
  quantumMsPerFuel: quantumTravel.quantumTime.msPerFuelUnit,
};

export function findBodyPosition(systemId: string | null, bodyId: string | null): Position | null {
  if (systemId === null || bodyId === null) {
    return null;
  }
  const position = SYSTEMS[systemId]?.positions[bodyId];
  return position && position.length === 3 ? [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0] : null;
}
