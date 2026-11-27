import { useI18n } from '../../i18n/translate';

interface FooterProps {
  unknownHaulingLineCount: number;
}

export function Footer({ unknownHaulingLineCount }: FooterProps) {
  const { t } = useI18n();
  return (
    <footer class="footer">
      <span>{t('footerNotice')}</span>
      <span>
        {t('footerPrivacy')} · v{__APP_VERSION__}
        {unknownHaulingLineCount > 0 && ` · ${t('footerUnknownLines', { count: unknownHaulingLineCount })}`}
      </span>
    </footer>
  );
}
