import { useEffect, useMemo } from 'preact/hooks';
import { createI18n, detectLanguage, I18nContext } from '../i18n/translate';
import { DEFAULT_TRAVEL_TIMING } from '../routing';
import { isUnknownPlace } from '../state/cargo-legs';
import { CargoChart } from './components/cargo-chart';
import { ConnectPanel } from './components/connect-panel';
import { ContractsPanel } from './components/contracts-panel';
import { EarningsPanel } from './components/earnings-panel';
import { Footer } from './components/footer';
import { Header } from './components/header';
import { NextStopPanel } from './components/next-stop-panel';
import { RoutePanel } from './components/route-panel';
import { SettingsPanel } from './components/settings-panel';
import type { AppSettings } from './components/settings-panel';
import { SummaryTiles } from './components/summary-tiles';
import { useHaulingSession } from './hooks/use-hauling-session';
import { usePersistentState } from './hooks/use-persistent-state';
import { useRoutePlan } from './hooks/use-route-plan';
import { formatPlace } from './format';
import {
  buildContractViews,
  buildRouteRequest,
  countFailedContracts,
  describeStop,
  indexLegsByTaskId,
  listSessionEarnings,
  resolveCurrentPlace,
  resolveShipCapacity,
} from './planner-model';

interface LogInputs {
  scuOverrides: Record<string, number>;
  loadedLegIds: string[];
  deliveredLegIds: string[];
  rewardsAuec: Record<string, number>;
}

interface HistoryEntry {
  summary: string;
  completedAtMs: number;
  amountAuec: number | null;
}

interface EarningsHistory {
  entries: Record<string, HistoryEntry>;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: detectLanguage(typeof navigator === 'undefined' ? [] : navigator.languages),
  shipOverride: null,
  customCapacityScu: {},
  usableCapacityPercent: 100,
  timing: DEFAULT_TRAVEL_TIMING,
};

const EMPTY_LOG_INPUTS: LogInputs = {
  scuOverrides: {},
  loadedLegIds: [],
  deliveredLegIds: [],
  rewardsAuec: {},
};

function setOrRemoveEntry(
  record: Readonly<Record<string, number>>,
  key: string,
  value: number | null,
): Record<string, number> {
  const remaining = Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
  return value === null ? remaining : { ...remaining, [key]: value };
}

function toggleIds(current: readonly string[], ids: readonly string[]): string[] {
  return [...new Set([...current, ...ids])];
}

export function App() {
  const session = useHaulingSession();
  const [settings, updateSettings] = usePersistentState<AppSettings>('settings', DEFAULT_SETTINGS);
  const [logInputs, updateLogInputs] = usePersistentState<LogInputs>(
    session.mode === 'demo' ? 'demo-inputs' : 'log-inputs',
    EMPTY_LOG_INPUTS,
  );
  const [history, updateHistory] = usePersistentState<EarningsHistory>('earnings-history', { entries: {} });
  const i18n = useMemo(() => createI18n(settings.language), [settings.language]);
  const { t } = i18n;
  const { state } = session;

  const legInputs = useMemo(
    () => ({
      scuOverrides: logInputs.scuOverrides,
      loadedLegIds: new Set(logInputs.loadedLegIds),
      deliveredLegIds: new Set(logInputs.deliveredLegIds),
    }),
    [logInputs],
  );
  const views = useMemo(
    () => buildContractViews(state, legInputs, logInputs.rewardsAuec),
    [state, legInputs, logInputs.rewardsAuec],
  );
  const capacity = resolveShipCapacity(state, settings);
  const currentPlace = resolveCurrentPlace(state);
  const request = buildRouteRequest(views, currentPlace, capacity, settings.timing);
  const plan = useRoutePlan(request);
  const legIndex = useMemo(() => indexLegsByTaskId(views), [views]);
  const earnings = useMemo(
    () => listSessionEarnings(state, logInputs.rewardsAuec),
    [state, logInputs.rewardsAuec],
  );

  const placeNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const view of views) {
      for (const leg of view.legs) {
        if (leg.pickup) {
          names.set(leg.pickup.name, formatPlace(leg.pickup, 'pickup', t));
        }
        names.set(leg.dropoff.name, formatPlace(leg.dropoff, 'dropoff', t));
      }
    }
    if (currentPlace) {
      names.set(describeStop(currentPlace).placeKey, currentPlace.shortName);
    }
    return names;
  }, [views, currentPlace, t]);
  const describeStopName = (placeKey: string) => placeNames.get(placeKey) ?? placeKey;

  useEffect(() => {
    if (session.mode !== 'live' && session.mode !== 'file') {
      return;
    }
    const missing = earnings.filter((entry) => {
      const stored = history.entries[entry.missionId];
      return !stored || stored.amountAuec !== entry.amountAuec;
    });
    if (missing.length > 0) {
      updateHistory((current) => ({
        entries: {
          ...current.entries,
          ...Object.fromEntries(
            missing.map((entry) => [
              entry.missionId,
              { summary: entry.summary, completedAtMs: entry.completedAtMs, amountAuec: entry.amountAuec },
            ]),
          ),
        },
      }));
    }
  }, [earnings, history, session.mode, updateHistory]);

  const sessionEarnedAuec = earnings.reduce((sum, entry) => sum + (entry.amountAuec ?? 0), 0);
  const remainingRewards = views.map((view) => view.rewardAuec);
  const remainingPayoutAuec = remainingRewards.some((reward) => reward !== null)
    ? remainingRewards.reduce<number>((sum, reward) => sum + (reward ?? 0), 0)
    : null;
  const historyEntries = Object.values(history.entries);
  const allTimeAuec =
    session.mode === 'demo'
      ? sessionEarnedAuec
      : historyEntries.reduce((sum, entry) => sum + (entry.amountAuec ?? 0), 0);
  const allTimeJobCount = session.mode === 'demo' ? earnings.length : historyEntries.length;
  const sessionDurationMs =
    state.firstEventAtMs !== null && state.lastEventAtMs !== null
      ? state.lastEventAtMs - state.firstEventAtMs
      : 0;
  const unknownScuCount = views
    .flatMap((view) => view.legs)
    .filter((leg) => leg.status !== 'delivered' && leg.scu === null).length;
  const unknownPlaceCount = new Set(
    views
      .flatMap((view) => view.legs.flatMap((leg) => [leg.pickup, leg.dropoff]))
      .filter((place) => place !== null && isUnknownPlace(place))
      .map((place) => place?.name),
  ).size;

  function setReward(missionId: string, rewardAuec: number | null) {
    updateLogInputs((current) => ({
      ...current,
      rewardsAuec: setOrRemoveEntry(current.rewardsAuec, missionId, rewardAuec),
    }));
  }

  const isConnected = session.mode === 'live' || session.mode === 'file' || session.mode === 'demo';
  const errorText =
    session.error === null
      ? null
      : session.error === 'errorNoGameLog'
        ? t('errorNoGameLog')
        : t('errorGeneric', { message: session.error });

  return (
    <I18nContext.Provider value={i18n}>
      <div class="glow" aria-hidden="true" />
      <main class="app">
        <Header mode={session.mode} place={currentPlace} capacity={capacity} />
        {errorText && <p class="warning">{errorText}</p>}
        {!isConnected ? (
          <ConnectPanel session={session} />
        ) : (
          <>
            <SummaryTiles
              plan={plan}
              remainingPayoutAuec={remainingPayoutAuec}
              sessionEarnedAuec={sessionEarnedAuec}
              sessionJobCount={earnings.length}
            />
            <div class="columns">
              <div class="column">
                <ContractsPanel
                  views={views}
                  onScuChange={(missionId, objectiveId, scu) =>
                    updateLogInputs((current) => ({
                      ...current,
                      scuOverrides: setOrRemoveEntry(
                        current.scuOverrides,
                        `${missionId}/${objectiveId}`,
                        scu,
                      ),
                    }))
                  }
                  onRewardChange={setReward}
                />
                <EarningsPanel
                  entries={earnings}
                  sessionDurationMs={sessionDurationMs}
                  failedCount={countFailedContracts(state)}
                  allTimeAuec={allTimeAuec}
                  allTimeJobCount={allTimeJobCount}
                  projectedAuec={
                    remainingPayoutAuec === null ? null : sessionEarnedAuec + remainingPayoutAuec
                  }
                  onRewardChange={setReward}
                />
              </div>
              <div class="column">
                <RoutePanel
                  plan={plan}
                  legIndex={legIndex}
                  capacityScu={capacity.usableScu}
                  startPlaceKey={currentPlace ? describeStop(currentPlace).placeKey : null}
                  unknownScuCount={unknownScuCount}
                  unknownPlaceCount={unknownPlaceCount}
                  describeStopName={describeStopName}
                />
                <CargoChart
                  plan={plan}
                  capacityScu={capacity.usableScu}
                  describeStopName={describeStopName}
                />
              </div>
              <div class="column">
                <NextStopPanel
                  plan={plan}
                  legIndex={legIndex}
                  describeStopName={describeStopName}
                  onConfirmLoaded={(legIds) =>
                    updateLogInputs((current) => ({
                      ...current,
                      loadedLegIds: toggleIds(current.loadedLegIds, legIds),
                    }))
                  }
                  onConfirmDelivered={(legIds) =>
                    updateLogInputs((current) => ({
                      ...current,
                      deliveredLegIds: toggleIds(current.deliveredLegIds, legIds),
                    }))
                  }
                />
                <SettingsPanel
                  settings={settings}
                  detectedShipName={state.shipName}
                  capacity={capacity}
                  onChange={updateSettings}
                  onResetConfirmations={() => updateLogInputs(() => EMPTY_LOG_INPUTS)}
                />
                <div class="row-start">
                  {session.mode === 'file' && (
                    <button class="button small" onClick={() => void session.openFile()}>
                      {t('reload')}
                    </button>
                  )}
                  <button class="button small" onClick={() => void session.disconnect()}>
                    {t('disconnect')}
                  </button>
                </div>
                {session.gameFolderPath && (
                  <p class="small-note mono" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                    {t('followingFolder', { path: session.gameFolderPath })}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
        <Footer unknownHaulingLineCount={state.unknownHaulingLineCount} />
      </main>
    </I18nContext.Provider>
  );
}
