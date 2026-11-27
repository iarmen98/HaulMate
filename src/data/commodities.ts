const COMMODITY_NAMES: Record<string, string> = {
  AgriculturalSupplies: 'Agricultural Supplies',
  Agricium: 'Agricium',
  Aluminum: 'Aluminum',
  Ammonia: 'Ammonia',
  Astatine: 'Astatine',
  Beryl: 'Beryl',
  Carbon: 'Carbon',
  Chlorine: 'Chlorine',
  Copper: 'Copper',
  Corundum: 'Corundum',
  Diamond: 'Diamond',
  DistilledSpirits: 'Distilled Spirits',
  Fluorine: 'Fluorine',
  Gold: 'Gold',
  Helium: 'Helium',
  Hydrogen: 'Hydrogen',
  Iodine: 'Iodine',
  Iron: 'Iron',
  Laranite: 'Laranite',
  MedicalSupplies: 'Medical Supplies',
  Methane: 'Methane',
  Nitrogen: 'Nitrogen',
  PartySupplies: 'Party Supplies',
  Potassium: 'Potassium',
  PressurizedIce: 'Pressurized Ice',
  ProcessedFood: 'Processed Food',
  Quartz: 'Quartz',
  Scrap: 'Scrap',
  Silicon: 'Silicon',
  Stims: 'Stims',
  Tin: 'Tin',
  Titanium: 'Titanium',
  Tungsten: 'Tungsten',
  Waste: 'Waste',
};

export function guessCommodityFromContractName(contractName: string): string | null {
  const tokens = contractName.split('_');
  if (tokens.includes('Mixed')) {
    return null;
  }
  for (const token of tokens) {
    const name = COMMODITY_NAMES[token];
    if (name) {
      return name;
    }
  }
  return null;
}
