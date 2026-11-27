import type { Place } from '../../data/places';
import { useI18n } from '../../i18n/translate';
import { formatSystemName } from '../format';
import type { ShipCapacity } from '../planner-model';
import type { SessionMode } from '../hooks/use-hauling-session';
import { BoxIcon, PinIcon, ShipIcon } from './icons';

interface HeaderProps {
  mode: SessionMode;
  place: Place | null;
  capacity: ShipCapacity;
}

export function Header({ mode, place, capacity }: HeaderProps) {
  const { t } = useI18n();
  const statusLabel =
    mode === 'live'
      ? t('statusLive')
      : mode === 'file'
        ? t('statusFile')
        : mode === 'demo'
          ? t('statusDemo')
          : t('statusOffline');
  const systemName = formatSystemName(place?.systemId ?? null);

  return (
    <header class="header">
      <div class="brand">
        <div class="brand-mark">
          <BoxIcon />
        </div>
        <div>
          <h1>HAULMATE</h1>
          <p>{t('appTagline')}</p>
        </div>
      </div>
      <div class="chips">
        <span class={`chip ${mode === 'live' ? 'live' : ''}`}>
          <span class="dot" aria-hidden="true" />
          <strong>{statusLabel}</strong>
          <span class="muted">Game.log</span>
        </span>
        {systemName && (
          <span class="chip">
            <span class="muted">{t('chipSystem')}</span>
            <strong>{systemName}</strong>
          </span>
        )}
        <span class="chip">
          <PinIcon />
          <strong>{place?.shortName ?? t('chipUnknownLocation')}</strong>
        </span>
        <span class="chip accent">
          <ShipIcon />
          <strong>{capacity.shipName ?? t('chipNoShip')}</strong>
          <span class="mono" style={{ fontSize: 12, color: 'var(--accent-soft)' }}>
            {capacity.capacityScu === null ? t('chipScuUnknown') : `${capacity.capacityScu} SCU`}
          </span>
        </span>
      </div>
    </header>
  );
}
