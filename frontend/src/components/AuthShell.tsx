import type { ReactNode } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { LogoIcon } from './icons';
import { Prefs } from './Prefs';

/** The frame for screens outside the app: sign in, sign up, waiting for approval. */
export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="auth-shell">
      <header className="auth-top">
        <div className="brand"><span className="brand-mark"><LogoIcon /></span>SpaceShare</div>
        <Prefs />
      </header>
      <main className={`auth-card ${wide ? 'wide' : ''}`}>{children}</main>
      <p className="auth-tagline">{t('app.tagline')}</p>
    </div>
  );
}
