import { useI18n } from '../../i18n/translate';
import type { RoutePlan } from '../../routing';

interface CargoChartProps {
  plan: RoutePlan | null;
  capacityScu: number | null;
  describeStopName(placeKey: string): string;
}

export function CargoChart({ plan, capacityScu, describeStopName }: CargoChartProps) {
  const { t } = useI18n();
  const visits = plan?.visits ?? [];
  if (visits.length === 0) {
    return null;
  }
  const scale = Math.max(1, capacityScu ?? plan?.peakScu ?? 1);
  const peakScu = plan?.peakScu ?? 0;

  return (
    <section class="panel" aria-label={t('chartTitle')}>
      <div class="panel-head">
        <h2>{t('chartTitle')}</h2>
        {capacityScu !== null && (
          <span class="note">
            {t('chartSummary', {
              capacity: capacityScu,
              peak: peakScu,
              percent: Math.round((peakScu / Math.max(1, capacityScu)) * 100),
            })}
          </span>
        )}
      </div>
      <div
        class="chart"
        role="img"
        aria-label={visits.map((visit) => `${visit.onboardScuAfter} SCU`).join(', ')}
      >
        {visits.map((visit, index) => {
          return (
            <div class="chart-column" key={`${visit.stop.placeKey}-${index}`}>
              <span class="mono" style={{ fontSize: 12 }}>
                {visit.onboardScuAfter}
              </span>
              <div
                class="chart-bar"
                style={{ height: `${Math.min(100, (visit.onboardScuAfter / scale) * 100) * 0.75}%` }}
              />
              <span class="chart-label">
                {index + 1} · {describeStopName(visit.stop.placeKey)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
