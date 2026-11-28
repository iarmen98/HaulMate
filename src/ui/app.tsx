import { useEffect, useRef } from 'preact/hooks';
import { I18nContext } from '../i18n/translate';
import { CargoChart } from './components/cargo-chart';
import { ConnectPanel } from './components/connect-panel';
import { ContractsPanel } from './components/contracts-panel';
import { EarningsPanel } from './components/earnings-panel';
import { Footer } from './components/footer';
import { Header } from './components/header';
import { NextStopPanel } from './components/next-stop-panel';
import { RoutePanel } from './components/route-panel';
import { SettingsPanel } from './components/settings-panel';
import { SummaryTiles } from './components/summary-tiles';
import { useDesktopHotkeys } from './hooks/use-desktop-hotkeys';
import { usePlanner } from './hooks/use-planner';
import { describeStop } from './planner-model';

export function App() {
  const planner = usePlanner({ recordsHistory: true });
  const { session, state, i18n, plan, capacity, currentPlace } = planner;
  const { t } = i18n;
  const desktop = typeof window === 'undefined' ? undefined : window.haulmateDesktop;
  const hotkeys = useDesktopHotkeys();

  const plannerRef = useRef(planner);
  plannerRef.current = planner;

  useEffect(() => desktop?.onConfirmNextStop(() => plannerRef.current.confirmNextStopLoaded()), [desktop]);

  return (
    <I18nContext.Provider value={i18n}>
      <div class="glow" aria-hidden="true" />
      <main class="app">
        <Header mode={session.mode} place={currentPlace} capacity={capacity} />
        {planner.errorText && <p class="warning">{planner.errorText}</p>}
        {!planner.isConnected ? (
          <ConnectPanel session={session} />
        ) : (
          <>
            <SummaryTiles
              plan={plan}
              remainingPayoutAuec={planner.remainingPayoutAuec}
              sessionEarnedAuec={planner.sessionEarnedAuec}
              sessionJobCount={planner.earnings.length}
            />
            <div class="columns">
              <div class="column">
                <ContractsPanel
                  views={planner.views}
                  onScuChange={planner.setScu}
                  onRewardChange={planner.setReward}
                />
                <EarningsPanel
                  entries={planner.earnings}
                  sessionDurationMs={planner.sessionDurationMs}
                  failedCount={planner.failedCount}
                  allTimeAuec={planner.allTimeAuec}
                  allTimeJobCount={planner.allTimeJobCount}
                  projectedAuec={
                    planner.remainingPayoutAuec === null
                      ? null
                      : planner.sessionEarnedAuec + planner.remainingPayoutAuec
                  }
                  onRewardChange={planner.setReward}
                />
              </div>
              <div class="column">
                <RoutePanel
                  plan={plan}
                  legIndex={planner.legIndex}
                  capacityScu={capacity.usableScu}
                  startPlaceKey={currentPlace ? describeStop(currentPlace).placeKey : null}
                  unknownScuCount={planner.unknownScuCount}
                  unknownPlaceCount={planner.unknownPlaceCount}
                  describeStopName={planner.describeStopName}
                />
                <CargoChart
                  plan={plan}
                  capacityScu={capacity.usableScu}
                  describeStopName={planner.describeStopName}
                />
              </div>
              <div class="column">
                <NextStopPanel
                  plan={plan}
                  legIndex={planner.legIndex}
                  describeStopName={planner.describeStopName}
                  onConfirmLoaded={planner.confirmLoaded}
                  onConfirmDelivered={planner.confirmDelivered}
                />
                {desktop && (
                  <div class="panel" style={{ gap: 10 }}>
                    <button class="button outline" onClick={() => void desktop.toggleOverlay()}>
                      {t('overlayToggle')}
                    </button>
                    <span class="small-note">
                      {t('overlayHint', { toggle: hotkeys.toggleOverlay, confirm: hotkeys.confirmLoaded })}
                    </span>
                  </div>
                )}
                <SettingsPanel
                  settings={planner.settings}
                  detectedShipName={state.shipName}
                  capacity={capacity}
                  onChange={planner.updateSettings}
                  onResetConfirmations={planner.resetConfirmations}
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
