import { useEffect, useMemo } from 'preact/hooks';
import { createI18n, detectLanguage } from '../../i18n/translate';
import { DEFAULT_TRAVEL_TIMING, readBaseTaskId } from '../../routing';
import { isUnknownPlace } from '../../state/cargo-legs';
import type { AppSettings } from '../components/settings-panel';
import { formatPlace } from '../format';
import {
  buildContractViews,
  buildRouteRequest,
  countFailedContracts,
  describeStop,
  indexLegsByTaskId,
  listSessionEarnings,
  resolveCurrentPlace,
  resolveShipCapacity,
} from '../planner-model';
import { useHaulingSession } from './use-hauling-session';
import { usePersistentState } from './use-persistent-state';
import { useRoutePlan } from './use-route-plan';

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

export interface PlannerOptions {
  recordsHistory: boolean;
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

function addIds(current: readonly string[], ids: readonly string[]): string[] {
  return [...new Set([...current, ...ids])];
}

export function usePlanner({ recordsHistory }: PlannerOptions) {
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
  const plan = useRoutePlan(buildRouteRequest(views, currentPlace, capacity, settings.timing));
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

  useEffect(() => {
    if (!recordsHistory || (session.mode !== 'live' && session.mode !== 'file')) {
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
  }, [earnings, history, session.mode, recordsHistory, updateHistory]);

  const sessionEarnedAuec = earnings.reduce((sum, entry) => sum + (entry.amountAuec ?? 0), 0);
  const remainingRewards = views.map((view) => view.rewardAuec);
  const remainingPayoutAuec = remainingRewards.some((reward) => reward !== null)
    ? remainingRewards.reduce<number>((sum, reward) => sum + (reward ?? 0), 0)
    : null;
  const historyEntries = Object.values(history.entries);
  const isDemo = session.mode === 'demo';
  const errorText =
    session.error === null
      ? null
      : session.error === 'errorNoGameLog'
        ? t('errorNoGameLog')
        : t('errorGeneric', { message: session.error });

  function confirmLoaded(legIds: readonly string[]) {
    updateLogInputs((current) => ({ ...current, loadedLegIds: addIds(current.loadedLegIds, legIds) }));
  }

  return {
    session,
    state,
    settings,
    updateSettings,
    i18n,
    views,
    capacity,
    currentPlace,
    plan,
    legIndex,
    earnings,
    errorText,
    sessionEarnedAuec,
    remainingPayoutAuec,
    allTimeAuec: isDemo
      ? sessionEarnedAuec
      : historyEntries.reduce((sum, entry) => sum + (entry.amountAuec ?? 0), 0),
    allTimeJobCount: isDemo ? earnings.length : historyEntries.length,
    failedCount: countFailedContracts(state),
    sessionDurationMs:
      state.firstEventAtMs !== null && state.lastEventAtMs !== null
        ? state.lastEventAtMs - state.firstEventAtMs
        : 0,
    unknownScuCount: views
      .flatMap((view) => view.legs)
      .filter((leg) => leg.status !== 'delivered' && leg.scu === null).length,
    unknownPlaceCount: new Set(
      views
        .flatMap((view) => view.legs.flatMap((leg) => [leg.pickup, leg.dropoff]))
        .filter((place) => place !== null && isUnknownPlace(place))
        .map((place) => place?.name),
    ).size,
    isConnected: session.mode === 'live' || session.mode === 'file' || session.mode === 'demo',
    describeStopName: (placeKey: string) => placeNames.get(placeKey) ?? placeKey,
    setReward(missionId: string, rewardAuec: number | null) {
      updateLogInputs((current) => ({
        ...current,
        rewardsAuec: setOrRemoveEntry(current.rewardsAuec, missionId, rewardAuec),
      }));
    },
    setScu(missionId: string, objectiveId: string, scu: number | null) {
      updateLogInputs((current) => ({
        ...current,
        scuOverrides: setOrRemoveEntry(current.scuOverrides, `${missionId}/${objectiveId}`, scu),
      }));
    },
    confirmLoaded,
    confirmDelivered(legIds: readonly string[]) {
      updateLogInputs((current) => ({
        ...current,
        deliveredLegIds: addIds(current.deliveredLegIds, legIds),
      }));
    },
    confirmNextStopLoaded() {
      const loads = plan?.visits[0]?.loads ?? [];
      if (loads.length > 0) {
        confirmLoaded(loads.map((amount) => readBaseTaskId(amount.taskId)));
      }
    },
    resetConfirmations() {
      updateLogInputs(() => EMPTY_LOG_INPUTS);
    },
  };
}

export type Planner = ReturnType<typeof usePlanner>;
