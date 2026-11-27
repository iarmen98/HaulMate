export interface Stop {
  placeKey: string;
  bodyKey: string;
  systemKey: string;
}

export interface CargoTask {
  taskId: string;
  scu: number;
  pickup: Stop | null;
  dropoff: Stop;
}

export interface TravelTiming {
  localHopMs: number;
  quantumHopMs: number;
  jumpMs: number;
  stopOverheadMs: number;
  handlingMsPerScu: number;
}

export interface RouteRequest {
  tasks: readonly CargoTask[];
  start: Stop | null;
  capacityScu: number;
  timing: TravelTiming;
  timeBudgetMs?: number;
}

export type HopKind = 'none' | 'local' | 'quantum' | 'jump';

export interface TaskAmount {
  taskId: string;
  scu: number;
}

export interface RouteVisit {
  stop: Stop;
  loads: TaskAmount[];
  unloads: TaskAmount[];
  loadedScu: number;
  unloadedScu: number;
  onboardScuAfter: number;
  hop: HopKind;
  arrivalMs: number;
}

export type RouteStatus = 'ok' | 'empty' | 'overCapacity';

export interface RoutePlan {
  status: RouteStatus;
  method: 'exact' | 'heuristic' | 'none';
  visits: RouteVisit[];
  totalMs: number;
  quantumHopCount: number;
  jumpCount: number;
  peakScu: number;
  splitTaskIds: string[];
}

export const DEFAULT_TRAVEL_TIMING: TravelTiming = {
  localHopMs: 4 * 60_000,
  quantumHopMs: 8 * 60_000,
  jumpMs: 15 * 60_000,
  stopOverheadMs: 4 * 60_000,
  handlingMsPerScu: 3_000,
};
