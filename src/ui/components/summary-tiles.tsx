import { useI18n } from '../../i18n/translate';
import type { RoutePlan } from '../../routing';

interface SummaryTilesProps {
  plan: RoutePlan | null;
  remainingPayoutAuec: number | null;
  sessionEarnedAuec: number;
  sessionJobCount: number;
}

export function SummaryTiles({
  plan,
  remainingPayoutAuec,
  sessionEarnedAuec,
  sessionJobCount,
}: SummaryTilesProps) {
  const { t, formatNumber } = useI18n();
  const stopCount = plan?.visits.length ?? 0;

  return (
    <section class="tiles" aria-label="Route summary">
      <div class="tile">
        <p class="tile-label">{t('tileRemainingPayout')}</p>
        <p class="tile-value to-earn">
          {remainingPayoutAuec === null ? '—' : formatNumber(remainingPayoutAuec)}{' '}
          <small>{remainingPayoutAuec === null ? t('tileRemainingPayoutEmpty') : 'aUEC'}</small>
        </p>
      </div>
      <div class="tile">
        <p class="tile-label">{t('tileStops')}</p>
        <p class="tile-value">
          {stopCount}{' '}
          <small>
            {t('tileStopsDetail', { quantum: plan?.quantumHopCount ?? 0, jumps: plan?.jumpCount ?? 0 })}
          </small>
        </p>
      </div>
      <div class="tile">
        <p class="tile-label">{t('tileEta')}</p>
        <p class="tile-value">
          ~{Math.round((plan?.totalMs ?? 0) / 60_000)} <small>{t('tileEtaDetail')}</small>
        </p>
      </div>
      <div class="tile earned">
        <p class="tile-label">{t('tileEarned')}</p>
        <p class="tile-value earned-value">
          {formatNumber(sessionEarnedAuec)} <small>{t('tileEarnedDetail', { count: sessionJobCount })}</small>
        </p>
      </div>
    </section>
  );
}
