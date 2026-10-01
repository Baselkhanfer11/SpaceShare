import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { BoxIcon, WarehouseIcon } from '../components/icons';
import { useI18n } from '../i18n/LanguageContext';
import type { RegisterInput } from '../types';

const MIN_PASSWORD = 8; // same rule as the API (AccountRules)

type Side = RegisterInput['organizationType'];

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [side, setSide] = useState<Side | null>(null);
  const [form, setForm] = useState({ organizationName: '', city: '', phone: '', fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!side) return setError(t('register.chooseSide'));
    if (form.password.length < MIN_PASSWORD) return setError(t('register.passwordShort', { n: MIN_PASSWORD }));
    setError('');
    setBusy(true);
    try {
      await register({
        organizationType: side,
        organizationName: form.organizationName,
        city: form.city.trim() || null,
        phone: form.phone.trim() || null,
        fullName: form.fullName,
        email: form.email,
        password: form.password,
      });
      navigate('/', { replace: true }); // start at home, not at /register
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const choice = (value: Side, icon: React.ReactNode) => (
    <button
      type="button"
      className={`side-card ${side === value ? 'selected' : ''}`}
      onClick={() => { setSide(value); setError(''); }}
      aria-pressed={side === value}
    >
      <span className="side-icon">{icon}</span>
      <span className="side-title">{t(`register.${value}.title`)}</span>
      <span className="side-sub">{t(`register.${value}.sub`)}</span>
    </button>
  );

  return (
    <AuthShell wide>
      <h1>{t('register.title')}</h1>
      <p className="muted">{t('register.sub')}</p>

      <form onSubmit={submit} className="form">
        <div className="side-choice" role="group" aria-label={t('register.sideLabel')}>
          {choice('Provider', <WarehouseIcon />)}
          {choice('Client', <BoxIcon />)}
        </div>

        <div className="field-row">
          <label className="field">
            <span>{t('field.companyName')} <span className="req">*</span></span>
            <input className="input" required autoComplete="organization" value={form.organizationName} onChange={set('organizationName')} />
          </label>
          <label className="field">
            <span>{t('field.city')}</span>
            <input className="input" autoComplete="address-level2" value={form.city} onChange={set('city')} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>{t('field.yourName')} <span className="req">*</span></span>
            <input className="input" required autoComplete="name" value={form.fullName} onChange={set('fullName')} />
          </label>
          <label className="field">
            <span>{t('field.phone')}</span>
            <input className="input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>{t('field.email')} <span className="req">*</span></span>
            <input className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
          </label>
          <label className="field">
            <span>{t('field.password')} <span className="req">*</span></span>
            <input className="input" type="password" required autoComplete="new-password" value={form.password} onChange={set('password')} />
            <small className="hint">{t('register.passwordHint', { n: MIN_PASSWORD })}</small>
          </label>
        </div>

        <p className="hint">{t('register.reviewNote')}</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy && <span className="spinner" />} {t('register.submit')}
        </button>
      </form>
      <p className="auth-switch">{t('register.haveAccount')} <Link to="/login">{t('register.toLogin')}</Link></p>
    </AuthShell>
  );
}
