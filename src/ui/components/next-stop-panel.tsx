import { useState } from 'preact/hooks';
import { useI18n } from '../../i18n/translate';
import { readBaseTaskId } from '../../routing';
import type { RoutePlan } from '../../routing';
import { CopyIcon } from './icons';
import type { LegIndex } from './route-panel';
import { describeCargoLine } from './route-panel';

interface NextStopPanelProps {
  plan: RoutePlan | null;
  legIndex: LegIndex;
  describeStopName(placeKey: string): string;
  onConfirmLoaded(legIds: readonly string[]): void;
  onConfirmDelivered(legIds: readonly string[]): void;
}

export function NextStopPanel({
  plan,
  legIndex,
  describeStopName,
  onConfirmLoaded,
  onConfirmDelivered,
}: NextStopPanelProps) {
  const { t } = useI18n();
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const visit = plan?.visits[0];

  if (!plan || !visit) {
    return (
      <section class="panel next-stop">
        <p class="small-note">{t('nextStopEmpty')}</p>
      </section>
    );
  }

  const stopName = describeStopName(visit.stop.placeKey);
  const loadLegIds = [...new Set(visit.loads.map((amount) => readBaseTaskId(amount.taskId)))];
  const unloadLegIds = [...new Set(visit.unloads.map((amount) => readBaseTaskId(amount.taskId)))];

  async function copyStopName() {
    await navigator.clipboard.writeText(stopName);
    setCopiedName(stopName);
    window.setTimeout(() => setCopiedName(null), 2000);
  }

  return (
    <section class="panel next-stop" aria-label={t('nextStopTitle', { index: 1, count: plan.visits.length })}>
      <p class="eyebrow">{t('nextStopTitle', { index: 1, count: plan.visits.length })}</p>
      <h2 class="big-title">{stopName}</h2>
      {visit.unloads.length > 0 && (
        <div
          class="confirm-box"
          style={{ borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(8,10,14,0.4)' }}
        >
          <div class="row">
            <span class="eyebrow" style={{ letterSpacing: '0.12em' }}>
              {t('deliverTitle')}
            </span>
            <span class="mono muted" style={{ fontSize: 12 }}>
              {visit.unloadedScu} SCU
            </span>
          </div>
          {visit.unloads.map((amount) => (
            <div class="row" key={amount.taskId}>
              <span class="route-line unload">{describeCargoLine(amount, legIndex, 'unload', t)}</span>
              <button
                class="button small"
                onClick={() => onConfirmDelivered([readBaseTaskId(amount.taskId)])}
              >
                {t('markDelivered')}
              </button>
            </div>
          ))}
          <span class="small-note">{t('deliverHint')}</span>
        </div>
      )}
      {visit.loads.length > 0 && (
        <div class="confirm-box">
          <div class="row">
            <span class="eyebrow" style={{ letterSpacing: '0.12em' }}>
              {t('confirmCargo')}
            </span>
            <span class="mono" style={{ fontSize: 12, color: 'var(--accent-soft)' }}>
              {visit.loadedScu} SCU
            </span>
          </div>
          {visit.loads.map((amount) => (
            <div class="row" key={amount.taskId}>
              <span class="route-line load">{describeCargoLine(amount, legIndex, 'load', t)}</span>
              <button class="button small" onClick={() => onConfirmLoaded([readBaseTaskId(amount.taskId)])}>
                {t('confirm')}
              </button>
            </div>
          ))}
          {loadLegIds.length > 1 && (
            <button class="button outline" onClick={() => onConfirmLoaded(loadLegIds)}>
              {t('confirmAll')}
            </button>
          )}
          <span class="small-note">{t('confirmHint')}</span>
        </div>
      )}
      {unloadLegIds.length > 1 && (
        <button class="button" onClick={() => onConfirmDelivered(unloadLegIds)}>
          {t('markDelivered')} ({unloadLegIds.length})
        </button>
      )}
      <button
        class="button primary"
        onClick={() => void copyStopName()}
        style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}
      >
        <CopyIcon />
        {copiedName === stopName ? t('copied') : t('copyNextStop')}
      </button>
      <span class="small-note" style={{ textAlign: 'center' }}>
        {t('copyHint')}
      </span>
    </section>
  );
}
