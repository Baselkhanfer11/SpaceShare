import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { useI18n } from '../i18n/LanguageContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/', { replace: true }); // start at home, not at /login
    }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <h1>{t('login.title')}</h1>
      <p className="muted">{t('login.sub')}</p>
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>{t('field.email')}</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('field.password')}</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy && <span className="spinner" />} {t('login.submit')}
        </button>
      </form>
      <p className="auth-switch">{t('login.noAccount')} <Link to="/register">{t('login.toRegister')}</Link></p>
    </AuthShell>
  );
}
