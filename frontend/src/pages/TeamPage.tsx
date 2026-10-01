import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { teamApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { isOwner, rolesFor } from '../auth/roles';
import { PencilIcon, PlusIcon } from '../components/icons';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/LanguageContext';
import { formatDateTime } from '../lib/format';
import type { TeamMember } from '../types';

const MIN_PASSWORD = 8; // same rule as the API (AccountRules)

/** The people in my organisation. Owners add colleagues and change their roles. */
export function TeamPage() {
  const { me } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const load = useCallback(() => {
    teamApi.list().then(setMembers).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (!me) return null;
  const manage = isOwner(me.user.role);
  const roles = rolesFor(me.organization.type);

  const saved = (message: string) => {
    toast('success', message);
    setAdding(false);
    setEditing(null);
    load();
  };

  return (
    <div className="stack">
      <div className="page-header with-action">
        <div>
          <h1>{t('team.title')}</h1>
          <p>{t(manage ? 'team.subOwner' : 'team.sub', { org: me.organization.name })}</p>
        </div>
        {manage && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}><PlusIcon /> {t('team.add')}</button>
        )}
      </div>

      <section className="panel flush">
        {error ? <div className="empty error">{error}</div> : !members ? <div className="empty"><span className="spinner" /></div> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('team.col.person')}</th>
                  <th>{t('team.col.role')}</th>
                  <th className="hide-sm">{t('team.col.status')}</th>
                  <th className="hide-sm">{t('team.col.lastSignIn')}</th>
                  {manage && <th className="end"><span className="sr-only">{t('common.actions')}</span></th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className={m.isActive ? '' : 'inactive'}>
                    <td>
                      <div className="name">
                        {m.fullName}
                        {m.id === me.user.id && <span className="chip">{t('team.you')}</span>}
                        {/* On phones the Status column is hidden, so say it here. */}
                        {!m.isActive && <span className="chip off show-sm">{t('team.inactive')}</span>}
                      </div>
                      <div className="sub">{m.email}</div>
                    </td>
                    <td><span className="badge">{t(`role.${m.role}`)}</span></td>
                    <td className="hide-sm">
                      <span className={`dot-label ${m.isActive ? 'ok' : 'off'}`}>
                        {t(m.isActive ? 'team.active' : 'team.inactive')}
                      </span>
                    </td>
                    <td className="hide-sm sub">{m.lastLoginAt ? formatDateTime(m.lastLoginAt, lang) : t('team.never')}</td>
                    {manage && (
                      <td className="end">
                        <button className="icon-btn" onClick={() => setEditing(m)} aria-label={t('team.editLabel', { name: m.fullName })} title={t('common.edit')}>
                          <PencilIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adding && <AddMemberModal roles={roles} onClose={() => setAdding(false)} onSaved={(m) => saved(t('team.added', { name: m.fullName }))} />}
      {editing && (
        <EditMemberModal
          member={editing}
          roles={roles}
          isMe={editing.id === me.user.id}
          onClose={() => setEditing(null)}
          onSaved={(m) => saved(t('team.updated', { name: m.fullName }))}
        />
      )}
    </div>
  );
}

function AddMemberModal({ roles, onClose, onSaved }: { roles: string[]; onClose: () => void; onSaved: (m: TeamMember) => void }) {
  const { t } = useI18n();
  // New colleagues default to the non-owner role (staff / member).
  const [form, setForm] = useState({ fullName: '', email: '', role: roles[roles.length - 1], password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (form.password.length < MIN_PASSWORD) return setError(t('register.passwordShort', { n: MIN_PASSWORD }));
    setBusy(true);
    setError('');
    try { onSaved(await teamApi.add(form)); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={t('team.addTitle')}
      subtitle={t('team.addSub')}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={() => submit()} disabled={busy}>{busy && <span className="spinner" />} {t('team.add')}</button>
      </>}
    >
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>{t('field.fullName')} <span className="req">*</span></span>
          <input className="input" required value={form.fullName} onChange={set('fullName')} autoFocus />
        </label>
        <label className="field">
          <span>{t('field.email')} <span className="req">*</span></span>
          <input className="input" type="email" required value={form.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>{t('team.col.role')}</span>
          <select className="input" value={form.role} onChange={set('role')}>
            {roles.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </select>
          <small className="hint">{t(`role.${form.role}.hint`)}</small>
        </label>
        <label className="field">
          <span>{t('team.startPassword')} <span className="req">*</span></span>
          <input className="input" type="text" autoComplete="off" required value={form.password} onChange={set('password')} />
          <small className="hint">{t('team.startPasswordHint', { n: MIN_PASSWORD })}</small>
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function EditMemberModal({ member, roles, isMe, onClose, onSaved }: {
  member: TeamMember; roles: string[]; isMe: boolean; onClose: () => void; onSaved: (m: TeamMember) => void;
}) {
  const { t } = useI18n();
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.isActive);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try { onSaved(await teamApi.update(member.id, role, active)); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={member.fullName}
      subtitle={member.email}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <span className="spinner" />} {t('common.save')}</button>
      </>}
    >
      <div className="form">
        <label className="field">
          <span>{t('team.col.role')}</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </select>
          <small className="hint">{t(`role.${role}.hint`)}</small>
        </label>
        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={isMe} />
          <span>
            {t('team.canSignIn')}
            <small className="hint">{t(isMe ? 'team.cantDeactivateSelf' : 'team.canSignInHint')}</small>
          </span>
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
