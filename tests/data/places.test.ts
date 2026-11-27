import { describe, expect, it } from 'vitest';
import { guessCommodityFromContractName } from '../../src/data/commodities';
import {
  describeLocationCode,
  describePlace,
  describeSystemFromContractName,
  findPlaceNameAt,
} from '../../src/data/places';
import { findShipModel } from '../../src/data/ships';

describe('describePlace', () => {
  it.each([
    ['Ruin Station above Pyro VI', 'Ruin Station', 'pyro', 'pyro-6'],
    ['Checkmate at the L4 Lagrange of Pyro II', 'Checkmate', 'pyro', 'pyro-2-l4'],
    ['CRU-L5 Beautiful Glen Station', 'CRU-L5 Beautiful Glen Station', 'stanton', 'stanton-2-l5'],
    ["Sacren's Plot", "Sacren's Plot", 'pyro', 'pyro-4'],
    ['Somewhere New', 'Somewhere New', null, null],
  ])('describes %s', (name, shortName, systemId, bodyId) => {
    expect(describePlace(name)).toEqual({ name, shortName, systemId, bodyId });
  });
});

describe('describeLocationCode', () => {
  it.each([
    ['RR_P6_LEO', 'Ruin Station', 'pyro-6'],
    ['RR_P3_L1', 'RR_P3_L1', 'pyro-3-l1'],
    ['RR_HUR_LEO', 'Everus Harbor', 'stanton-1'],
    ['RR_JP_PyroStanton', 'Stanton Gateway', 'pyro-jp-stanton'],
    ['Pyro5a_Outpost_col_m_trdpst_otlw_001', 'Pyro5a_Outpost_col_m_trdpst_otlw_001', 'pyro-5a'],
    ['Stanton3b_ArcCorp_Area056', 'Stanton3b_ArcCorp_Area056', 'stanton-3b'],
  ])('describes %s', (code, shortName, bodyId) => {
    expect(describeLocationCode(code)).toMatchObject({ shortName, bodyId });
  });
});

describe('findPlaceNameAt', () => {
  it('names a known drop-off position with a small tolerance', () => {
    expect(findPlaceNameAt({ x: -245087.58, y: -85870.08, z: 189412.48 })).toBe("Chawla's Beach");
    expect(findPlaceNameAt({ x: -245060, y: -85870, z: 189412 })).toBe("Chawla's Beach");
    expect(findPlaceNameAt({ x: 1, y: 2, z: 3 })).toBeNull();
  });
});

describe('contract names', () => {
  it('reads the system and commodity', () => {
    const name =
      'RedWind_Pyro_SmallGrade_Solar_CFP_StationToOutpost_ProcessedFood_CargoHauling_SingleToMulti4';

    expect(describeSystemFromContractName(name)).toBe('pyro');
    expect(guessCommodityFromContractName(name)).toBe('Processed Food');
    expect(describeSystemFromContractName('HaulCargo_AToB_NonMetal_Silicon_Stanton3_SupplyGrade1')).toBe(
      'stanton',
    );
    expect(
      guessCommodityFromContractName('HaulCargo_AToB_Processed_Mixed_PressIceProcFood_Stanton2'),
    ).toBeNull();
  });
});

describe('findShipModel', () => {
  it('finds ships by the name used in their party channel', () => {
    expect(findShipModel('Gatac Railen')?.cargoScu).toBe(320);
    expect(findShipModel('argo raft')?.cargoScu).toBe(192);
    expect(findShipModel('Unknown Ship')).toBeNull();
  });
});
