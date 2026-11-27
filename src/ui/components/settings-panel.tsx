import { SHIP_MODELS } from '../../data/ships';
import { LANGUAGES } from '../../i18n/messages';
import type { Language } from '../../i18n/messages';
import { useI18n } from '../../i18n/translate';
import type { TravelTiming } from '../../routing';
import type { PlannerSettings, ShipCapacity } from '../planner-model';

export interface AppSettings extends PlannerSettings {
  language: Language;
}

interface SettingsPanelProps {
  settings: AppSettings;
  detectedShipName: string | null;
  capacity: ShipCapacity;
  onChange(update: (current: AppSettings) => AppSettings): void;
  onResetConfirmations(): void;
}

const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', es: 'Español' };
const TIMING_FIELDS: {
  key: keyof TravelTiming;
  label: 'settingsLocalHop' | 'settingsQuantumHop' | 'settingsJump' | 'settingsStop';
}[] = [
  { key: 'localHopMs', label: 'settingsLocalHop' },
  { key: 'quantumHopMs', label: 'settingsQuantumHop' },
  { key: 'jumpMs', label: 'settingsJump' },
  { key: 'stopOverheadMs', label: 'settingsStop' },
];
const AUTO_SHIP = '';

export function SettingsPanel({
  settings,
  detectedShipName,
  capacity,
  onChange,
  onResetConfirmations,
}: SettingsPanelProps) {
  const { t } = useI18n();
  const shipNames = [
    ...new Set([...(detectedShipName ? [detectedShipName] : []), ...SHIP_MODELS.map((model) => model.name)]),
  ];

  return (
    <details class="panel settings">
      <summary>{t('settingsTitle')}</summary>
      <div class="settings-grid">
        <label class="field">
          {t('settingsShip')}
          <select
            class="input"
            value={settings.shipOverride ?? AUTO_SHIP}
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange((current) => ({ ...current, shipOverride: value === AUTO_SHIP ? null : value }));
            }}
          >
            <option value={AUTO_SHIP}>{t('settingsShipAuto')}</option>
            {shipNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {detectedShipName && (
            <span class="small-note">{t('settingsShipDetected', { ship: detectedShipName })}</span>
          )}
        </label>
        <label class="field">
          {t('settingsCapacity')}
          <input
            class="input mono"
            inputMode="numeric"
            disabled={capacity.shipName === null}
            value={capacity.capacityScu === null ? '' : String(capacity.capacityScu)}
            onChange={(event) => {
              const shipName = capacity.shipName;
              const value = Number(event.currentTarget.value);
              if (shipName !== null && Number.isFinite(value) && value > 0) {
                onChange((current) => ({
                  ...current,
                  customCapacityScu: { ...current.customCapacityScu, [shipName]: value },
                }));
              }
            }}
          />
        </label>
        <label class="field">
          {t('settingsUsable')}
          <input
            class="input mono"
            type="number"
            min={50}
            max={100}
            value={settings.usableCapacityPercent}
            onChange={(event) => {
              const value = Number(event.currentTarget.value);
              if (value >= 50 && value <= 100) {
                onChange((current) => ({ ...current, usableCapacityPercent: value }));
              }
            }}
          />
          <span class="small-note">{t('settingsUsableHint')}</span>
        </label>
        <label class="field">
          {t('settingsLanguage')}
          <select
            class="input"
            value={settings.language}
            onChange={(event) => {
              const language = event.currentTarget.value as Language;
              onChange((current) => ({ ...current, language }));
            }}
          >
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {LANGUAGE_NAMES[language]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p class="small-note" style={{ marginTop: 18 }}>
        {t('settingsTiming')}
      </p>
      <div class="settings-grid" style={{ marginTop: 0 }}>
        {TIMING_FIELDS.map(({ key, label }) => (
          <label class="field" key={key}>
            {t(label)}
            <input
              class="input mono"
              type="number"
              min={0}
              step={0.5}
              value={settings.timing[key] / 60_000}
              onChange={(event) => {
                const minutes = Number(event.currentTarget.value);
                if (Number.isFinite(minutes) && minutes >= 0) {
                  onChange((current) => ({
                    ...current,
                    timing: { ...current.timing, [key]: minutes * 60_000 },
                  }));
                }
              }}
            />
          </label>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <button class="button small" onClick={onResetConfirmations}>
          {t('settingsReset')}
        </button>
      </div>
    </details>
  );
}
