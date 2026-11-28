import { useI18n } from '../../i18n/translate';
import type { HaulingSession } from '../hooks/use-hauling-session';

interface ConnectPanelProps {
  session: HaulingSession;
}

export function ConnectPanel({ session }: ConnectPanelProps) {
  const { t } = useI18n();

  if (session.mode === 'needsPermission') {
    return (
      <section class="panel connect">
        <h2>{t('reconnectTitle')}</h2>
        <p>{t('reconnectBody')}</p>
        <div class="connect-actions">
          <button class="button primary" onClick={() => void session.reconnect()}>
            {t('reconnect')}
          </button>
          <button class="button" onClick={() => void session.disconnect()}>
            {t('disconnect')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section class="panel connect">
      <h2>{t('connectTitle')}</h2>
      <p>{t('connectBody')}</p>
      <p class="mono small-note">{t('connectHint')}</p>
      {!session.isLiveSupported && <p class="warning">{t('connectUnsupported')}</p>}
      {session.isDesktop && <p class="small-note">{t('connectDesktopHint')}</p>}
      <div class="connect-actions">
        {session.isLiveSupported && (
          <button class="button primary" onClick={() => void session.connectFolder()}>
            {t('connectFolder')}
          </button>
        )}
        {!session.isDesktop && (
          <>
            <button class="button" onClick={() => void session.openFile()}>
              {t('connectFile')}
            </button>
            <button class="button" onClick={() => session.startDemo()}>
              {t('connectDemo')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
