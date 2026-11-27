import { useI18n } from '../../i18n/translate';
import type { Translate } from '../../i18n/translate';
import type { HopKind, RoutePlan, TaskAmount } from '../../routing';
import type { CargoLeg } from '../../state/cargo-legs';
import { findLeg } from '../planner-model';

export type LegIndex = ReadonlyMap<string, { leg: CargoLeg; label: string }>;

interface RoutePanelProps {
  plan: RoutePlan | null;
  legIndex: LegIndex;
  capacityScu: number | null;
  startPlaceKey: string | null;
  unknownScuCount: number;
  unknownPlaceCount: number;
  describeStopName(placeKey: string): string;
}

function describeHop(hop: HopKind, t: Translate): string | null {
  switch (hop) {
    case 'none':
      return null;
    case 'local':
      return t('routeHopLocal');
    case 'quantum':
      return t('routeHopQuantum');
    case 'jump':
      return t('routeHopJump');
  }
}

export function describeCargoLine(
  amount: TaskAmount,
  legIndex: LegIndex,
  kind: 'load' | 'unload',
  t: Translate,
): string {
  const entry = findLeg(legIndex, amount.taskId);
  return t(kind === 'load' ? 'routeLoad' : 'routeUnload', {
    scu: entry?.leg.scu === null ? '?' : amount.scu,
    commodity: entry?.leg.commodity ?? '',
    label: entry?.label ?? '',
  });
}

export function RoutePanel({
  plan,
  legIndex,
  capacityScu,
  startPlaceKey,
  unknownScuCount,
  unknownPlaceCount,
  describeStopName,
}: RoutePanelProps) {
  const { t } = useI18n();
  const visits = plan?.visits ?? [];
  const scale = Math.max(1, capacityScu ?? plan?.peakScu ?? 1);
  const splitLabels = [
    ...new Set((plan?.splitTaskIds ?? []).map((taskId) => findLeg(legIndex, taskId)?.label ?? '')),
  ].join(', ');

  return (
    <section class="panel" aria-label={t('routeTitle')}>
      <div class="panel-head">
        <h2 style={{ fontSize: 18 }}>{t('routeTitle')}</h2>
        {plan && plan.method !== 'none' && (
          <span class="note">
            {plan.method === 'exact' ? t('routeMethodExact') : t('routeMethodHeuristic')}
          </span>
        )}
      </div>
      {plan?.status === 'overCapacity' && <p class="warning">{t('routeOverCapacity')}</p>}
      {splitLabels && <p class="warning">{t('routeSplit', { labels: splitLabels })}</p>}
      {unknownScuCount > 0 && <p class="warning">{t('routeUnknownScu', { count: unknownScuCount })}</p>}
      {unknownPlaceCount > 0 && (
        <p class="small-note">{t('routeUnknownPlaces', { count: unknownPlaceCount })}</p>
      )}
      {visits.length === 0 && <p class="small-note">{t('routeEmpty')}</p>}
      <ol class="steps" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {visits.map((visit, index) => {
          const hopLabel = describeHop(visit.hop, t);
          const isHere = index === 0 && visit.stop.placeKey === startPlaceKey;
          return (
            <li class={`step ${index === 0 ? 'current' : ''}`} key={`${visit.stop.placeKey}-${index}`}>
              <div class="step-rail">
                <span class="step-number">{index + 1}</span>
                {index < visits.length - 1 && <span class="step-line" aria-hidden="true" />}
              </div>
              <div class="step-body">
                <div class="row" style={{ flexWrap: 'wrap' }}>
                  <span class="step-title">{describeStopName(visit.stop.placeKey)}</span>
                  {isHere ? (
                    <span class="chip small">{t('routeYouAreHere')}</span>
                  ) : (
                    hopLabel && (
                      <span class={`chip small ${visit.hop === 'jump' ? 'accent' : ''}`}>{hopLabel}</span>
                    )
                  )}
                </div>
                {visit.unloads.map((amount) => (
                  <span class="route-line unload" key={`u-${amount.taskId}`}>
                    {describeCargoLine(amount, legIndex, 'unload', t)}
                  </span>
                ))}
                {visit.loads.map((amount) => (
                  <span class="route-line load" key={`l-${amount.taskId}`}>
                    {describeCargoLine(amount, legIndex, 'load', t)}
                  </span>
                ))}
                <div class="row-start" style={{ flexWrap: 'nowrap' }}>
                  <div class="bar">
                    <span style={{ width: `${Math.min(100, (visit.onboardScuAfter / scale) * 100)}%` }} />
                  </div>
                  <span class="mono muted" style={{ fontSize: 10 }}>
                    {visit.onboardScuAfter}/{capacityScu ?? '?'}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
