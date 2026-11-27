import { useI18n } from '../../i18n/translate';
import { formatDuration } from '../format';
import type { EarningEntry } from '../planner-model';

interface EarningsPanelProps {
  entries: readonly EarningEntry[];
  sessionDurationMs: number;
  failedCount: number;
  allTimeAuec: number;
  allTimeJobCount: number;
  projectedAuec: number | null;
  onRewardChange(missionId: string, rewardAuec: number | null): void;
}

const RECENT_ENTRY_COUNT = 5;
const MIN_RATE_DURATION_MS = 10 * 60_000;

export function EarningsPanel(props: EarningsPanelProps) {
  const { t, formatNumber, formatCompact, formatTime } = useI18n();
  const sessionAuec = props.entries.reduce((sum, entry) => sum + (entry.amountAuec ?? 0), 0);
  const ratePerHour =
    props.sessionDurationMs >= MIN_RATE_DURATION_MS
      ? (sessionAuec / props.sessionDurationMs) * 3_600_000
      : null;
  const largest = Math.max(1, ...props.entries.map((entry) => entry.amountAuec ?? 0));
  const recent = [...props.entries].reverse().slice(0, RECENT_ENTRY_COUNT);

  function askReward(missionId: string) {
    const answer = window.prompt(`${t('contractReward')} (aUEC)`);
    const reward = answer === null ? null : Number(answer.replace(/[^\d]/g, ''));
    props.onRewardChange(missionId, reward && reward > 0 ? reward : null);
  }

  return (
    <section class="panel" aria-label={t('earningsTitle')}>
      <div class="panel-head">
        <h2>{t('earningsTitle')}</h2>
        <span class="note">{t('earningsSource')}</span>
      </div>
      <div class="stats">
        <div class="stat">
          <span>{t('earningsSession', { duration: formatDuration(props.sessionDurationMs) })}</span>
          <span class="value earned-value">{formatNumber(sessionAuec)}</span>
        </div>
        <div class="stat">
          <span>{t('earningsRate')}</span>
          <span class="value earned-value">
            {ratePerHour === null ? '—' : formatCompact(ratePerHour)}
            <small class="muted" style={{ fontSize: 12 }}>
              {' '}
              /h
            </small>
          </span>
        </div>
        <div class="stat">
          <span>{t('earningsCompleted')}</span>
          <span class="value">
            {props.entries.length}{' '}
            <small class="muted" style={{ fontSize: 14 }}>
              · {props.failedCount}
            </small>
          </span>
        </div>
        <div class="stat">
          <span>{t('earningsAllTime', { count: props.allTimeJobCount })}</span>
          <span class="value earned-value">{formatCompact(props.allTimeAuec)}</span>
        </div>
      </div>
      {recent.length === 0 && <p class="small-note">{t('earningsEmpty')}</p>}
      {recent.map((entry) => (
        <div class="earning-row" key={entry.missionId}>
          <span class="mono muted" style={{ fontSize: 11 }}>
            {formatTime(entry.completedAtMs)}
          </span>
          <span class="summary">{entry.summary}</span>
          <div class="bar earned">
            <span style={{ width: `${((entry.amountAuec ?? 0) / largest) * 100}%` }} />
          </div>
          {entry.amountAuec === null ? (
            <button class="link-button" onClick={() => askReward(entry.missionId)}>
              {t('earningsAddReward')}
            </button>
          ) : (
            <span class="earning-amount">+{formatNumber(entry.amountAuec)}</span>
          )}
        </div>
      ))}
      {props.projectedAuec !== null && (
        <div class="projected">
          <span style={{ fontSize: 13, color: 'var(--accent-soft)' }}>{t('earningsProjected')}</span>
          <span class="display to-earn" style={{ fontSize: 17, fontWeight: 600 }}>
            {formatNumber(props.projectedAuec)} aUEC
          </span>
        </div>
      )}
    </section>
  );
}
