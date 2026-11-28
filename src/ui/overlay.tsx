import { I18nContext } from '../i18n/translate';
import type { Translate } from '../i18n/translate';
import type { HopKind } from '../routing';
import { describeCargoLine } from './components/route-panel';
import { formatSystemName } from './format';
import { findLeg } from './planner-model';
import { useDesktopHotkeys } from './hooks/use-desktop-hotkeys';
import { usePlanner } from './hooks/use-planner';

const MAX_UPCOMING_STOPS = 4;

function describeOverlayHop(hop: HopKind, systemKey: string, travelMs: number, t: Translate): string {
  switch (hop) {
    case 'jump':
      return t('overlayJumpTo', { system: formatSystemName(systemKey) ?? systemKey });
    case 'quantum':
      return t('routeHopMinutes', {
        label: t('routeHopQuantum'),
        minutes: Math.max(1, Math.round(travelMs / 60_000)),
      });
    case 'local':
      return t('routeHopLocal');
    case 'none':
      return '';
  }
}

export function Overlay() {
  const planner = usePlanner({ recordsHistory: false });
  const hotkeys = useDesktopHotkeys();
  const { i18n, plan, capacity, session } = planner;
  const { t, formatCompact } = i18n;
  const next = plan?.visits[0];
  const upcoming = plan?.visits.slice(1, 1 + MAX_UPCOMING_STOPS) ?? [];
  const confirmedScu =
    next?.loads
      .filter((amount) => findLeg(planner.legIndex, amount.taskId)?.leg.status === 'onBoard')
      .reduce((sum, amount) => sum + amount.scu, 0) ?? 0;
  const scale = Math.max(1, capacity.usableScu ?? plan?.peakScu ?? 1);

  return (
    <I18nContext.Provider value={i18n}>
      <div class="overlay-root">
        <section class="overlay-panel">
          <div class="overlay-head">
            <span class="display overlay-brand">{t('overlayTitle')}</span>
            <span class={`overlay-status ${session.mode === 'live' ? 'live' : ''}`}>
              <span class="dot" aria-hidden="true" />
              Game.log
            </span>
            <span class="mono overlay-ship">
              {capacity.shipName ?? t('chipNoShip')} · {capacity.capacityScu ?? '?'} SCU
            </span>
          </div>

          {next && plan ? (
            <div class="overlay-next">
              <span class="overlay-eyebrow">
                {t('overlayNextStop', { index: 1, count: plan.visits.length }).toUpperCase()}
              </span>
              <span class="display overlay-stop">{planner.describeStopName(next.stop.placeKey)}</span>
              {next.unloads.map((amount) => (
                <span class="overlay-line" key={`u-${amount.taskId}`}>
                  {describeCargoLine(amount, planner.legIndex, 'unload', t)}
                </span>
              ))}
              {next.loads.map((amount) => (
                <span class="overlay-line load" key={`l-${amount.taskId}`}>
                  {describeCargoLine(amount, planner.legIndex, 'load', t)}
                </span>
              ))}
              <div class="overlay-bar-row">
                <div class="bar overlay-bar">
                  <span style={{ width: `${Math.min(100, (next.onboardScuAfter / scale) * 100)}%` }} />
                </div>
                <span class="mono overlay-small">
                  {next.onboardScuAfter}/{capacity.usableScu ?? '?'}
                </span>
              </div>
              {next.loads.length > 0 && (
                <span class="overlay-hint">
                  <b class="mono overlay-key">{hotkeys.confirmLoaded}</b>{' '}
                  {t('overlayConfirmHint', { loaded: confirmedScu, total: next.loadedScu })}
                </span>
              )}
            </div>
          ) : (
            <div class="overlay-next">
              <span class="overlay-line">{t('overlayIdle')}</span>
            </div>
          )}

          {upcoming.length > 0 && (
            <ol class="overlay-stops">
              {upcoming.map((visit, index) => (
                <li key={`${visit.stop.placeKey}-${index}`}>
                  <span class="overlay-step">{index + 2}</span>
                  <span class="overlay-step-name">{planner.describeStopName(visit.stop.placeKey)}</span>
                  <span class={`mono overlay-small ${visit.hop === 'jump' ? 'load' : ''}`}>
                    {describeOverlayHop(visit.hop, visit.stop.systemKey, visit.travelMs, t)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div class="overlay-stats">
            <div>
              <span class="overlay-label">{t('overlaySession').toUpperCase()}</span>
              <span class="display overlay-figure earned-value">
                {formatCompact(planner.sessionEarnedAuec)}
              </span>
            </div>
            <div>
              <span class="overlay-label">{t('overlayToEarn').toUpperCase()}</span>
              <span class="display overlay-figure to-earn">
                {planner.remainingPayoutAuec === null ? '—' : formatCompact(planner.remainingPayoutAuec)}
              </span>
            </div>
            <div>
              <span class="overlay-label">{t('overlayEta').toUpperCase()}</span>
              <span class="display overlay-figure">~{Math.round((plan?.totalMs ?? 0) / 60_000)} min</span>
            </div>
          </div>
        </section>
      </div>
    </I18nContext.Provider>
  );
}
