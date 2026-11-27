import type { Vector3 } from '../parser/events';
import knownPlaces from './known-places.json';

export interface Place {
  name: string;
  shortName: string;
  systemId: string | null;
  bodyId: string | null;
}

const ROMAN_NUMERALS: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
const STANTON_BODY_CODES: Record<string, number> = { HUR: 1, CRU: 2, ARC: 3, MIC: 4 };
const POSITION_MATCH_TOLERANCE_M = 50;

const PLACE_BODIES: Record<string, { systemId: string; bodyId: string | null }> = {
  'Canard View': { systemId: 'pyro', bodyId: 'pyro-6' },
  'Last Landings': { systemId: 'pyro', bodyId: 'pyro-6' },
  'Bueno Ravine': { systemId: 'pyro', bodyId: 'pyro-3' },
  "Shepherd's Rest": { systemId: 'pyro', bodyId: 'pyro-3' },
  'The Golden Riviera': { systemId: 'pyro', bodyId: 'pyro-3' },
  "Chawla's Beach": { systemId: 'pyro', bodyId: 'pyro-4' },
  'Fallow Field': { systemId: 'pyro', bodyId: 'pyro-4' },
  "Sacren's Plot": { systemId: 'pyro', bodyId: 'pyro-4' },
  "Jackson's Swap": { systemId: 'pyro', bodyId: 'pyro-2' },
  'Sunset Mesa': { systemId: 'pyro', bodyId: 'pyro-2' },
  Rustville: { systemId: 'pyro', bodyId: 'pyro-1' },
  Ashland: { systemId: 'pyro', bodyId: null },
  "Seer's Canyon": { systemId: 'pyro', bodyId: null },
  'Starlight Service Station': { systemId: 'pyro', bodyId: null },
  'Stanton Gateway': { systemId: 'pyro', bodyId: 'pyro-jp-stanton' },
  'Pyro Gateway': { systemId: 'stanton', bodyId: 'stanton-jp-pyro' },
  'Everus Harbor': { systemId: 'stanton', bodyId: 'stanton-1' },
  'Teasa Spaceport': { systemId: 'stanton', bodyId: 'stanton-1' },
  'HDPC-Cassillo': { systemId: 'stanton', bodyId: 'stanton-1' },
  'Sakura Sun Magnolia Workcenter': { systemId: 'stanton', bodyId: 'stanton-1' },
  'Seraphim Station': { systemId: 'stanton', bodyId: 'stanton-2' },
  'Baijini Point': { systemId: 'stanton', bodyId: 'stanton-3' },
  'Riker Memorial Spaceport': { systemId: 'stanton', bodyId: 'stanton-3' },
  'Port Tressler': { systemId: 'stanton', bodyId: 'stanton-4' },
  'NB Int. Spaceport': { systemId: 'stanton', bodyId: 'stanton-4' },
};

const LOCATION_PLACE_NAMES: Record<string, string> = {
  RR_P6_LEO: 'Ruin Station above Pyro VI',
  RR_P3_LEO: 'Orbituary above Pyro III',
  RR_P2_L4: 'Checkmate at the L4 Lagrange of Pyro II',
  RR_P3_L3: 'Patch City at the L3 Lagrange of Pyro III',
  RR_P5_L2: 'Gaslight at the L2 Lagrange of Pyro V',
  RR_P5_L4: "Rod's Fuel 'N Supplies at the L4 Lagrange of Pyro V",
  RR_P5_L5: "Rat's Nest at the L5 Lagrange of Pyro V",
  RR_P6_L3: 'Endgame at the L3 Lagrange of Pyro VI',
  RR_P6_L4: 'Dudley & Daughters at the L4 Lagrange of Pyro VI',
  RR_P6_L5: 'Megumi Refueling at the L5 Lagrange of Pyro VI',
  RR_JP_PyroStanton: 'Stanton Gateway',
  RR_JP_StantonPyro: 'Pyro Gateway',
  RR_HUR_LEO: 'Everus Harbor',
  RR_CRU_LEO: 'Seraphim Station',
  RR_ARC_LEO: 'Baijini Point',
  RR_MIC_LEO: 'Port Tressler',
  RR_CRU_L5: 'CRU-L5 Beautiful Glen Station',
  RR_MIC_L2: 'MIC-L2 Long Forest Station',
  RR_MIC_L5: 'MIC-L5 Modern Icarus Station',
  Stanton1_Lorville: 'Teasa Spaceport',
  Stanton3_Area18: 'Riker Memorial Spaceport',
  Stanton4_NewBabbage: 'NB Int. Spaceport',
  Stanton1_DistributionCentre_Hurston_Cassillo: 'HDPC-Cassillo',
  Stanton1_DistributionCentre_SakuraSun_Magnolia: 'Sakura Sun Magnolia Workcenter',
  Pyro1_Outpost_col_m_scrp_otlw_001: 'Rustville',
  Pyro2_Outpost_col_m_scrp_indy_001: 'Sunset Mesa',
  Pyro4_Outpost_col_m_scrp_indy_001: "Chawla's Beach",
  Pyro6_Outpost_col_m_scrp_otlw_001: 'Last Landings',
};

const KNOWN_PLACE_POSITIONS: { name: string; position: readonly number[] }[] = Object.entries(
  knownPlaces.places as Record<string, number[][]>,
).flatMap(([name, positions]) => positions.map((position) => ({ name, position })));

function parseRomanNumeral(numeral: string): number | null {
  return ROMAN_NUMERALS[numeral] ?? null;
}

function shortenPlaceName(name: string): string {
  return name
    .replace(/ above (Pyro|Stanton|Nyx) [IVX]+$/, '')
    .replace(/ at the L\d Lagrange of (Pyro|Stanton|Nyx) [IVX]+$/, '')
    .trim();
}

function describePlaceBody(name: string): { systemId: string | null; bodyId: string | null } {
  const curated = PLACE_BODIES[name];
  if (curated) {
    return curated;
  }
  const above = / above (Pyro|Stanton|Nyx) ([IVX]+)$/.exec(name);
  if (above?.[1] && above[2]) {
    const systemId = above[1].toLowerCase();
    return { systemId, bodyId: `${systemId}-${parseRomanNumeral(above[2]) ?? above[2]}` };
  }
  const lagrange = / at the L(\d) Lagrange of (Pyro|Stanton|Nyx) ([IVX]+)$/.exec(name);
  if (lagrange?.[1] && lagrange[2] && lagrange[3]) {
    const systemId = lagrange[2].toLowerCase();
    return {
      systemId,
      bodyId: `${systemId}-${parseRomanNumeral(lagrange[3]) ?? lagrange[3]}-l${lagrange[1]}`,
    };
  }
  const stantonLagrange = /^(HUR|CRU|ARC|MIC)-L(\d) /.exec(name);
  if (stantonLagrange?.[1] && stantonLagrange[2]) {
    return {
      systemId: 'stanton',
      bodyId: `stanton-${STANTON_BODY_CODES[stantonLagrange[1]]}-l${stantonLagrange[2]}`,
    };
  }
  return { systemId: null, bodyId: null };
}

export function describePlace(name: string): Place {
  return { name, shortName: shortenPlaceName(name), ...describePlaceBody(name) };
}

export function findPlaceNameAt(position: Vector3): string | null {
  const match = KNOWN_PLACE_POSITIONS.find(
    ({ position: known }) =>
      Math.abs((known[0] ?? 0) - position.x) < POSITION_MATCH_TOLERANCE_M &&
      Math.abs((known[1] ?? 0) - position.y) < POSITION_MATCH_TOLERANCE_M &&
      Math.abs((known[2] ?? 0) - position.z) < POSITION_MATCH_TOLERANCE_M,
  );
  return match?.name ?? null;
}

export function describeLocationCode(code: string): Place {
  const placeName = LOCATION_PLACE_NAMES[code];
  if (placeName) {
    const place = describePlace(placeName);
    if (place.bodyId !== null) {
      return place;
    }
  }

  const restStop = /^RR_P(\d)_(LEO|L\d)$/.exec(code);
  if (restStop?.[1] && restStop[2]) {
    const bodyId =
      restStop[2] === 'LEO' ? `pyro-${restStop[1]}` : `pyro-${restStop[1]}-${restStop[2].toLowerCase()}`;
    return {
      name: placeName ?? code,
      shortName: shortenPlaceName(placeName ?? code),
      systemId: 'pyro',
      bodyId,
    };
  }
  const stantonRestStop = /^RR_(HUR|CRU|ARC|MIC)_(LEO|L\d)$/.exec(code);
  if (stantonRestStop?.[1] && stantonRestStop[2]) {
    const planet = STANTON_BODY_CODES[stantonRestStop[1]];
    const bodyId =
      stantonRestStop[2] === 'LEO'
        ? `stanton-${planet}`
        : `stanton-${planet}-${stantonRestStop[2].toLowerCase()}`;
    return { name: placeName ?? code, shortName: placeName ?? code, systemId: 'stanton', bodyId };
  }
  const jumpPoint = /^RR_JP_([A-Z][a-z]+)([A-Z][a-z]+)$/.exec(code);
  if (jumpPoint?.[1] && jumpPoint[2]) {
    const systemId = jumpPoint[1].toLowerCase();
    const name = placeName ?? `${jumpPoint[2]} Gateway`;
    return { name, shortName: name, systemId, bodyId: `${systemId}-jp-${jumpPoint[2].toLowerCase()}` };
  }
  const surface = /^(Pyro|Stanton|Nyx)(\d?)([a-f]?)_/.exec(code);
  if (surface?.[1]) {
    const systemId = surface[1].toLowerCase();
    const bodyId = surface[2] ? `${systemId}-${surface[2]}${surface[3] ?? ''}` : null;
    const name = placeName ?? code;
    return { name, shortName: shortenPlaceName(name), systemId, bodyId };
  }
  const nyx = /_Nyx_/.test(code);
  return {
    name: placeName ?? code,
    shortName: placeName ?? code,
    systemId: nyx ? 'nyx' : null,
    bodyId: null,
  };
}

export function describeSystemFromContractName(contractName: string): string | null {
  const match = /(?:^|_)(Pyro|Stanton|Nyx)(?:\d|_|$)/.exec(contractName);
  return match?.[1]?.toLowerCase() ?? null;
}
