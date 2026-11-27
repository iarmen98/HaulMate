export interface ShipModel {
  name: string;
  cargoScu: number;
}

export const SHIP_MODELS: readonly ShipModel[] = [
  { name: 'Aegis Reclaimer', cargoScu: 420 },
  { name: 'Anvil Asgard', cargoScu: 180 },
  { name: 'Anvil Carrack', cargoScu: 456 },
  { name: 'Argo RAFT', cargoScu: 192 },
  { name: 'Crusader C1 Spirit', cargoScu: 64 },
  { name: 'Crusader C2 Hercules Starlifter', cargoScu: 696 },
  { name: 'Crusader M2 Hercules Starlifter', cargoScu: 522 },
  { name: 'Crusader Mercury Star Runner', cargoScu: 114 },
  { name: 'C.O. Nomad', cargoScu: 24 },
  { name: 'Drake Caterpillar', cargoScu: 576 },
  { name: 'Drake Corsair', cargoScu: 72 },
  { name: 'Drake Cutlass Black', cargoScu: 46 },
  { name: 'Gatac Railen', cargoScu: 320 },
  { name: 'MISC Freelancer', cargoScu: 66 },
  { name: 'MISC Freelancer MAX', cargoScu: 120 },
  { name: 'MISC Hull A', cargoScu: 64 },
  { name: 'MISC Hull C', cargoScu: 4608 },
  { name: 'MISC Starfarer', cargoScu: 291 },
  { name: 'Origin 400i', cargoScu: 42 },
  { name: 'RSI Constellation Andromeda', cargoScu: 96 },
  { name: 'RSI Constellation Taurus', cargoScu: 174 },
  { name: 'RSI Zeus Mk II CL', cargoScu: 128 },
];

export function findShipModel(shipName: string): ShipModel | null {
  const normalised = shipName.trim().toLowerCase();
  return SHIP_MODELS.find((model) => model.name.toLowerCase() === normalised) ?? null;
}
