import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { AlertIcon, ClockIcon, LogOutIcon, PauseIcon, RefreshIcon } from '../components/icons';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/LanguageContext';

/** Shown instead of the app while the organisation isn't approved (pending, rejected or suspended). */
export function AccountStatusPage() {
  const { me, refresh, logout } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  if (!me) return null;

  const { status, name, reviewNote } = me.organization;
  const icon = status === 'Pending' ? <ClockIcon /> : status === 'Suspended' ? <PauseIcon /> : <AlertIcon />;

  const check = async () => {
    setChecking(true);
    try {
      const fresh = await refresh(); // approved → the app opens by itself
      if (fresh.organization.status === 'Pending') toast('success', t('status.stillWaiting'));
    } catch (err) { toast('error', (err as Error).message); }
    finally { setChecking(false); }
  };

  return (
    <AuthShell>
      <div className={`status-badge ${status.toLowerCase()}`}>{icon}</div>
      <h1>{t(`status.${status}.title`)}</h1>
      <p className="muted">{t(`status.${status}.body`, { org: name })}</p>
      {reviewNote && (
        <div className="review-note">
          <span>{t('status.reason')}</span>
          <p>{reviewNote}</p>
        </div>
      )}
      <div className="status-actions">
        {status === 'Pending' && (
          <button className="btn btn-primary" onClick={check} disabled={checking}>
            {checking ? <span className="spinner" /> : <RefreshIcon />} {t('status.checkAgain')}
          </button>
        )}
        <button className="btn btn-ghost" onClick={logout}><LogOutIcon /> {t('auth.signOut')}</button>
      </div>
    </AuthShell>
  );
}
