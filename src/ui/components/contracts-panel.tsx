import { useI18n } from '../../i18n/translate';
import { formatPlace } from '../format';
import type { ContractView } from '../planner-model';
import { ArrowIcon } from './icons';

interface ContractsPanelProps {
  views: readonly ContractView[];
  onScuChange(missionId: string, objectiveId: string, scu: number | null): void;
  onRewardChange(missionId: string, rewardAuec: number | null): void;
}

function readPositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(/[^\d]/g, ''));
  return value.trim() === '' || !Number.isFinite(parsed) || parsed <= 0 ? null : parsed;
}

function ContractCard({
  view,
  onScuChange,
  onRewardChange,
}: { view: ContractView } & Omit<ContractsPanelProps, 'views'>) {
  const { t, formatNumber } = useI18n();
  const commodities = [...new Set(view.legs.map((leg) => leg.commodity))].join(', ');
  const pickups = [...new Set(view.legs.map((leg) => formatPlace(leg.pickup, 'pickup', t)))];
  const dropoffs = [...new Set(view.legs.map((leg) => formatPlace(leg.dropoff, 'dropoff', t)))];
  const pendingLegs = view.legs.filter((leg) => leg.status !== 'delivered');
  const loadedScu = pendingLegs
    .filter((leg) => leg.status === 'onBoard')
    .reduce((sum, leg) => sum + (leg.scu ?? 0), 0);
  const pendingScu = pendingLegs.reduce((sum, leg) => sum + (leg.scu ?? 0), 0);
  const unknownDropoffs = [
    ...new Map(
      view.legs.filter((leg) => leg.scuSource !== 'log').map((leg) => [leg.dropoffObjectiveId, leg]),
    ).values(),
  ];

  return (
    <article class="card">
      <div class="row">
        <div class="row-start">
          <span class="tag">{view.label}</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{commodities}</span>
        </div>
        <span class="mono" style={{ fontSize: 12, color: 'var(--accent-soft)' }}>
          {view.hasUnknownScu ? '? SCU' : `${view.totalScu} SCU`}
        </span>
      </div>
      <div class="row-start route-line">
        <span>{pickups.join(' · ')}</span>
        <ArrowIcon />
        <span>{dropoffs.join(' · ')}</span>
      </div>
      {unknownDropoffs.length > 0 && (
        <div class="field">
          <span class="small-note">{t('contractScuMissing')}</span>
          {unknownDropoffs.map((leg) => (
            <label key={leg.dropoffObjectiveId} class="row" style={{ gap: 8 }}>
              <span class="route-line" style={{ flex: 1 }}>
                {formatPlace(leg.dropoff, 'dropoff', t)}
              </span>
              <input
                class="input mono"
                style={{ width: 90 }}
                inputMode="numeric"
                placeholder="SCU"
                value={
                  leg.scuSource === 'player'
                    ? String(
                        view.legs
                          .filter((other) => other.dropoffObjectiveId === leg.dropoffObjectiveId)
                          .reduce((sum, other) => sum + (other.scu ?? 0), 0),
                      )
                    : ''
                }
                onInput={(event) =>
                  onScuChange(
                    view.contract.missionId,
                    leg.dropoffObjectiveId,
                    readPositiveNumber(event.currentTarget.value),
                  )
                }
              />
            </label>
          ))}
        </div>
      )}
      <div class="row" style={{ fontSize: 12 }}>
        {view.crossesSystems ? (
          <span class="chip small accent">{t('contractCrossesJump')}</span>
        ) : (
          <span class="chip small">
            {loadedScu > 0 && loadedScu === pendingScu
              ? t('contractOnBoard')
              : t('contractToLoad', { done: loadedScu, total: pendingScu })}
          </span>
        )}
        {view.contract.payoutAuec !== null ? (
          <span style={{ fontWeight: 600, color: 'var(--accent-text)' }}>
            {formatNumber(view.contract.payoutAuec)} aUEC
          </span>
        ) : (
          <label class="row-start" style={{ gap: 6 }}>
            <span class="visually-hidden">{t('contractReward')}</span>
            <input
              class="input mono"
              style={{ width: 150, color: 'var(--accent-text)' }}
              inputMode="numeric"
              placeholder={t('contractRewardPlaceholder')}
              value={view.rewardAuec === null ? '' : String(view.rewardAuec)}
              onInput={(event) =>
                onRewardChange(view.contract.missionId, readPositiveNumber(event.currentTarget.value))
              }
            />
          </label>
        )}
      </div>
    </article>
  );
}

export function ContractsPanel(props: ContractsPanelProps) {
  const { t } = useI18n();
  const totalScu = props.views.reduce((sum, view) => sum + view.totalScu, 0);

  return (
    <section class="panel" aria-label={t('contractsTitle')}>
      <div class="panel-head">
        <h2>{t('contractsTitle')}</h2>
        <span class="note">{t('contractsSummary', { count: props.views.length, scu: totalScu })}</span>
      </div>
      {props.views.length === 0 && <p class="small-note">{t('contractsEmpty')}</p>}
      {props.views.map((view) => (
        <ContractCard
          key={view.contract.missionId}
          view={view}
          onScuChange={props.onScuChange}
          onRewardChange={props.onRewardChange}
        />
      ))}
    </section>
  );
}
