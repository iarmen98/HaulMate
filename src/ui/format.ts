import type { Place } from '../data/places';
import type { Translate } from '../i18n/translate';
import { isUnknownPlace } from '../state/cargo-legs';

export function formatPlace(place: Place | null, kind: 'pickup' | 'dropoff', t: Translate): string {
  if (place === null) {
    return t('contractOnBoard');
  }
  if (isUnknownPlace(place)) {
    return t(kind === 'pickup' ? 'unknownPickup' : 'unknownDropoff');
  }
  return place.shortName;
}

export function formatDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function formatSystemName(systemId: string | null): string | null {
  return systemId === null ? null : systemId.charAt(0).toUpperCase() + systemId.slice(1);
}
