import { useCallback, useEffect, useState } from 'react';
import { adminListingsApi } from '../api/endpoints';
import { ReasonModal } from '../components/Dialogs';
import { CheckIcon, XIcon } from '../components/icons';
import { Cover, ListingView } from '../components/ListingParts';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate } from '../lib/format';
import type { AdminWarehouse, WarehouseDetail, WarehouseStatus } from '../types';

const TABS: WarehouseStatus[] = ['Pending', 'Approved', 'Rejected'];

/** The platform admin checks listings before businesses can see them, and can take one down. */
export function AdminListingsPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<AdminWarehouse[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<WarehouseStatus>('Pending');
  const [preview, setPreview] = useState<WarehouseDetail | null>(null);
  const [rejecting, setRejecting] = useState<AdminWarehouse | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    adminListingsApi.list().then(setRows).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const count = (s: WarehouseStatus) => rows?.filter((r) => r.status === s).length ?? 0;
  const shown = rows?.filter((r) => r.status === tab) ?? [];

  const act = async (row: Pick<AdminWarehouse, 'id' | 'name'>, run: () => Promise<void>, doneKey: string) => {
    setBusyId(row.id);
    try {
      await run();
      toast('success', t(doneKey, { name: row.name }));
      setRejecting(null);
      setPreview(null);
      load();
    } catch (err) { toast('error', (err as Error).message); }
    finally { setBusyId(null); }
  };

  const open = async (row: AdminWarehouse) => {
    try { setPreview(await adminListingsApi.get(row.id)); }
    catch (err) { toast('error', (err as Error).message); }
  };

  // Approve / reject (pending) or take down (live), shown in the row and in the preview.
  const actions = (row: Pick<AdminWarehouse, 'id' | 'name' | 'status'>) => <>
    {row.status === 'Pending' && (
      <button className="btn btn-primary btn-sm" disabled={busyId === row.id}
        onClick={() => act(row, () => adminListingsApi.approve(row.id), 'listings.approved')}>
        <CheckIcon /> {t('admin.approve')}
      </button>
    )}
    {(row.status === 'Pending' || row.status === 'Approved') && (
      <button className="btn btn-ghost btn-sm danger" disabled={busyId === row.id}
        onClick={() => setRejecting(rows?.find((r) => r.id === row.id) ?? null)}>
        <XIcon /> {t(row.status === 'Pending' ? 'admin.reject' : 'listings.takeDown')}
      </button>
    )}
  </>;

  return (
    <div className="stack">
      <div className="page-header">
        <h1>{t('listings.title')}</h1>
        <p>{t('listings.sub')}</p>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} className={`tab ${tab === s ? 'active' : ''}`} onClick={() => setTab(s)}>
            {t(`listingStatus.${s}`)} <span className="tab-count">{count(s)}</span>
          </button>
        ))}
      </div>

      <section className="panel flush">
        {error ? <div className="empty error">{error}</div> : !rows ? <div className="empty"><span className="spinner" /></div> : shown.length === 0 ? (
          <div className="empty">{t(`listings.empty.${tab}`)}</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('listings.col.listing')}</th>
                  <th className="hide-sm">{t('listings.col.submitted')}</th>
                  <th className="end"><span className="sr-only">{t('common.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button className="row-link" onClick={() => open(r)}>
                        <Cover url={r.coverUrl} alt={r.name} className="thumb-sm" />
                        <span>
                          <span className="name">{r.name}</span>
                          <span className="sub">{r.city} · {r.providerName}</span>
                          <span className="sub">{t('wh.counts', { photos: r.photoCount, offers: r.activeOfferCount })}</span>
                        </span>
                      </button>
                      {r.reviewNote && <div className="note">{r.reviewNote}</div>}
                    </td>
                    <td className="hide-sm sub">{r.submittedAt ? formatDate(r.submittedAt, lang) : '—'}</td>
                    <td className="end">
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => open(r)}>{t('listings.preview')}</button>
                        {actions(r)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {preview && (
        <Modal title={preview.name} subtitle={preview.city} wide onClose={() => setPreview(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>{t('common.close')}</button>
            {actions(preview)}
          </>}>
          <ListingView listing={preview} />
        </Modal>
      )}

      {rejecting && (
        <ReasonModal
          title={t(rejecting.status === 'Pending' ? 'listings.rejectTitle' : 'listings.takeDownTitle', { name: rejecting.name })}
          subtitle={t('listings.reasonSub')}
          placeholder={t('listings.reasonPlaceholder')}
          confirmLabel={t(rejecting.status === 'Pending' ? 'admin.reject' : 'listings.takeDown')}
          busy={busyId === rejecting.id}
          onClose={() => setRejecting(null)}
          onConfirm={(note) => act(rejecting, () => adminListingsApi.reject(rejecting.id, note),
            rejecting.status === 'Pending' ? 'listings.rejected' : 'listings.takenDown')}
        />
      )}
    </div>
  );
}
