import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/endpoints';
import { CheckIcon, PauseIcon, PlayIcon, XIcon } from '../components/icons';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate } from '../lib/format';
import type { AdminOrganization, OrganizationStatus } from '../types';

const TABS: OrganizationStatus[] = ['Pending', 'Active', 'Suspended', 'Rejected'];

// Rejecting and suspending need a reason the organisation will see.
type NoteAction = { kind: 'reject' | 'suspend'; org: AdminOrganization };

/** The platform admin's review queue: approve sign-ups, reject, suspend, reactivate. */
export function AdminOrganizationsPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [orgs, setOrgs] = useState<AdminOrganization[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<OrganizationStatus>('Pending');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [noteAction, setNoteAction] = useState<NoteAction | null>(null);

  const load = useCallback(() => {
    adminApi.organizations().then(setOrgs).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const count = (status: OrganizationStatus) => orgs?.filter((o) => o.status === status).length ?? 0;
  const shown = orgs?.filter((o) => o.status === tab) ?? [];

  const act = async (org: AdminOrganization, run: () => Promise<void>, doneKey: string) => {
    setBusyId(org.id);
    try {
      await run();
      toast('success', t(doneKey, { org: org.name }));
      setNoteAction(null);
      load();
    } catch (err) { toast('error', (err as Error).message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="stack">
      <div className="page-header">
        <h1>{t('admin.title')}</h1>
        <p>{t('admin.sub')}</p>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} className={`tab ${tab === s ? 'active' : ''}`} onClick={() => setTab(s)}>
            {t(`orgStatus.${s}`)} <span className="tab-count">{count(s)}</span>
          </button>
        ))}
      </div>

      <section className="panel flush">
        {error ? <div className="empty error">{error}</div> : !orgs ? <div className="empty"><span className="spinner" /></div> : shown.length === 0 ? (
          <div className="empty">{t(`admin.empty.${tab}`)}</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('admin.col.organization')}</th>
                  <th>{t('admin.col.owner')}</th>
                  <th className="hide-sm">{t('admin.col.signedUp')}</th>
                  <th className="end"><span className="sr-only">{t('common.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="name">
                        {o.name}
                        <span className={`badge ${o.type === 'Provider' ? 'provider' : 'client'}`}>{t(`orgType.${o.type}`)}</span>
                      </div>
                      <div className="sub">
                        {[o.city, t(o.userCount === 1 ? 'admin.usersOne' : 'admin.users', { n: o.userCount })].filter(Boolean).join(' · ')}
                      </div>
                      {o.reviewNote && <div className="note">{o.reviewNote}</div>}
                    </td>
                    <td>
                      <div>{o.ownerName ?? '—'}</div>
                      <div className="sub">{o.ownerEmail}</div>
                      {o.phone && <div className="sub" dir="ltr">{o.phone}</div>}
                    </td>
                    <td className="hide-sm sub">{formatDate(o.createdAt, lang)}</td>
                    <td className="end">
                      <div className="row-actions">
                        {o.status === 'Pending' && <>
                          <button className="btn btn-primary btn-sm" disabled={busyId === o.id}
                            onClick={() => act(o, () => adminApi.approve(o.id), 'admin.approved')}>
                            <CheckIcon /> {t('admin.approve')}
                          </button>
                          <button className="btn btn-ghost btn-sm danger" disabled={busyId === o.id}
                            onClick={() => setNoteAction({ kind: 'reject', org: o })}>
                            <XIcon /> {t('admin.reject')}
                          </button>
                        </>}
                        {o.status === 'Active' && (
                          <button className="btn btn-ghost btn-sm danger" disabled={busyId === o.id}
                            onClick={() => setNoteAction({ kind: 'suspend', org: o })}>
                            <PauseIcon /> {t('admin.suspend')}
                          </button>
                        )}
                        {o.status === 'Suspended' && (
                          <button className="btn btn-ghost btn-sm" disabled={busyId === o.id}
                            onClick={() => act(o, () => adminApi.reactivate(o.id), 'admin.reactivated')}>
                            <PlayIcon /> {t('admin.reactivate')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {noteAction && (
        <NoteModal
          action={noteAction}
          busy={busyId === noteAction.org.id}
          onClose={() => setNoteAction(null)}
          onConfirm={(note) => act(
            noteAction.org,
            () => (noteAction.kind === 'reject' ? adminApi.reject : adminApi.suspend)(noteAction.org.id, note),
            noteAction.kind === 'reject' ? 'admin.rejected' : 'admin.suspended',
          )}
        />
      )}
    </div>
  );
}

function NoteModal({ action, busy, onClose, onConfirm }: {
  action: NoteAction; busy: boolean; onClose: () => void; onConfirm: (note: string) => void;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const confirm = () => {
    if (!note.trim()) return setError(t('admin.noteRequired'));
    onConfirm(note.trim());
  };

  return (
    <Modal
      title={t(`admin.${action.kind}Title`, { org: action.org.name })}
      subtitle={t(`admin.${action.kind}Sub`)}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-danger" onClick={confirm} disabled={busy}>{busy && <span className="spinner" />} {t(`admin.${action.kind}`)}</button>
      </>}
    >
      <div className="form">
        <label className="field">
          <span>{t('admin.reason')} <span className="req">*</span></span>
          <textarea className="input" rows={3} value={note} autoFocus
            onChange={(e) => { setNote(e.target.value); setError(''); }}
            placeholder={t(`admin.${action.kind}Placeholder`)} />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
