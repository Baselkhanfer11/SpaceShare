import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { warehousesApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { isOwner } from '../auth/roles';
import { ConfirmModal } from '../components/Dialogs';
import { AlertIcon, CheckIcon, ClockIcon, PencilIcon, PlusIcon, XIcon } from '../components/icons';
import { FeatureChips, ListingStatusBadge } from '../components/ListingParts';
import { OfferModal } from '../components/OfferModal';
import { useToast } from '../components/Toast';
import { WarehouseFormModal } from '../components/WarehouseFormModal';
import { useI18n } from '../i18n/LanguageContext';
import { offerPrice, offerTerms, offerTitle } from '../lib/listings';
import type { SpaceOffer, WarehouseDetail } from '../types';

const MAX_PHOTOS = 10; // same as the API

type Confirm = { kind: 'offer'; offer: SpaceOffer } | { kind: 'listing' };

/** One listing, as its owner builds it: details, photos, space offers, then submit for review. */
export function WarehouseEditorPage() {
  const { id } = useParams();
  const warehouseId = Number(id);
  const { me } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [w, setW] = useState<WarehouseDetail | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [offerModal, setOfferModal] = useState<{ offer?: SpaceOffer } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    warehousesApi.get(warehouseId).then(setW).catch((e: Error) => setError(e.message));
  }, [warehouseId]);
  useEffect(load, [load]);

  if (error) return <div className="panel empty error">{error}</div>;
  if (!w) return <div className="panel empty"><span className="spinner" /></div>;

  const manage = isOwner(me?.user.role);
  const hasPhoto = w.photos.length > 0;
  const hasOffer = w.offers.some((o) => o.isActive);
  const canSubmit = (w.status === 'Draft' || w.status === 'Rejected') && hasPhoto && hasOffer;

  // Runs an action, then reloads; errors become a toast.
  const run = async (action: () => Promise<unknown>, doneKey?: string) => {
    setBusy(true);
    try {
      await action();
      if (doneKey) toast('success', t(doneKey, { name: w.name }));
      setConfirm(null);
      load();
    } catch (err) { toast('error', (err as Error).message); }
    finally { setBusy(false); }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - w.photos.length;
    const chosen = [...files].slice(0, room);
    if (files.length > room) toast('error', t('wh.tooManyPhotos', { n: MAX_PHOTOS }));
    setUploading(true);
    // One at a time, so a bad file doesn't stop the good ones.
    for (const file of chosen) {
      try { await warehousesApi.addPhoto(w.id, file); }
      catch (err) { toast('error', `${file.name}: ${(err as Error).message}`); }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = '';
    load();
  };

  const deleteListing = async () => {
    setBusy(true);
    try {
      await warehousesApi.remove(w.id);
      toast('success', t('wh.deleted', { name: w.name }));
      navigate('/warehouses');
    } catch (err) { toast('error', (err as Error).message); setBusy(false); }
  };

  return (
    <div className="stack">
      <div className="page-header with-action">
        <div>
          <Link to="/warehouses" className="back-link">{t('wh.back')}</Link>
          <h1 className="with-badge">{w.name} <ListingStatusBadge status={w.status} /></h1>
          <p dir="auto">{w.address}, {w.city}</p>
        </div>
        {manage && (w.status === 'Draft' || w.status === 'Rejected') && (
          <button className="btn btn-primary" disabled={!canSubmit || busy}
            onClick={() => run(() => warehousesApi.submit(w.id), 'wh.submitted')}>
            {busy && <span className="spinner" />} {t(w.status === 'Rejected' ? 'wh.resubmit' : 'wh.submit')}
          </button>
        )}
      </div>

      {/* Where the listing stands, and what's left to do. */}
      <section className={`status-panel ${w.status.toLowerCase()}`}>
        <div className="status-panel-head">
          {w.status === 'Pending' ? <ClockIcon /> : w.status === 'Approved' ? <CheckIcon /> : <AlertIcon />}
          <strong>{t(`wh.state.${w.status}.title`)}</strong>
        </div>
        <p>{t(`wh.state.${w.status}.body`)}</p>
        {w.status === 'Rejected' && w.reviewNote && (
          <div className="review-note"><span>{t('status.reason')}</span><p>{w.reviewNote}</p></div>
        )}
        {(w.status === 'Draft' || w.status === 'Rejected') && (
          <ul className="checklist">
            <li className={hasPhoto ? 'done' : ''}>{hasPhoto ? <CheckIcon /> : <XIcon />} {t('wh.needPhoto')}</li>
            <li className={hasOffer ? 'done' : ''}>{hasOffer ? <CheckIcon /> : <XIcon />} {t('wh.needOffer')}</li>
          </ul>
        )}
        {w.status === 'Approved' && <Link to={`/listings/${w.id}`}>{t('wh.viewLive')}</Link>}
      </section>

      {/* Details */}
      <section className="panel">
        <div className="panel-head">
          <h2>{t('wh.details')}</h2>
          {manage && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><PencilIcon /> {t('common.edit')}</button>}
        </div>
        <dl className="details">
          <dt>{t('wh.hours')}</dt><dd dir="auto">{w.openingHours || <span className="muted">—</span>}</dd>
          <dt>{t('wh.description')}</dt><dd dir="auto">{w.description || <span className="muted">{t('wh.noDescription')}</span>}</dd>
          <dt>{t('wh.features')}</dt>
          <dd>{w.features.length ? <FeatureChips features={w.features} /> : <span className="muted">{t('wh.noFeatures')}</span>}</dd>
        </dl>
      </section>

      {/* Photos */}
      <section className="panel">
        <div className="panel-head">
          <h2>{t('wh.photos')} <span className="muted small">{w.photos.length}/{MAX_PHOTOS}</span></h2>
          {manage && w.photos.length < MAX_PHOTOS && (
            <>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                onChange={(e) => upload(e.target.files)} />
              <button className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? <span className="spinner" /> : <PlusIcon />} {t('wh.addPhotos')}
              </button>
            </>
          )}
        </div>
        {w.photos.length === 0 ? <p className="muted">{t('wh.noPhotos')}</p> : (
          <div className="photo-grid">
            {w.photos.map((p, i) => (
              <figure key={p.id} className="photo-tile">
                <img src={p.url} alt={t('listing.photoN', { n: i + 1 })} loading="lazy" />
                {i === 0 && <span className="photo-cover-tag">{t('wh.cover')}</span>}
                {manage && (
                  <div className="photo-actions">
                    {i > 0 && (
                      <button className="btn btn-sm photo-btn" disabled={busy}
                        onClick={() => run(() => warehousesApi.makeCover(w.id, p.id))}>{t('wh.makeCover')}</button>
                    )}
                    <button className="icon-btn photo-btn" disabled={busy} aria-label={t('wh.deletePhoto')} title={t('wh.deletePhoto')}
                      onClick={() => run(() => warehousesApi.removePhoto(w.id, p.id))}><XIcon /></button>
                  </div>
                )}
              </figure>
            ))}
          </div>
        )}
        <p className="hint">{t('wh.photoHint')}</p>
      </section>

      {/* Space offers */}
      <section className="panel">
        <div className="panel-head">
          <h2>{t('wh.offers')}</h2>
          {manage && <button className="btn btn-ghost btn-sm" onClick={() => setOfferModal({})}><PlusIcon /> {t('offerForm.add')}</button>}
        </div>
        {w.offers.length === 0 ? <p className="muted">{t('wh.noOffers')}</p> : (
          <ul className="offer-list">
            {w.offers.map((o) => (
              <li key={o.id} className={`offer-row ${o.isActive ? '' : 'inactive'}`}>
                <div>
                  <div className="offer-title">
                    {offerTitle(t, o)}
                    {!o.isActive && <span className="chip off">{t('offer.paused')}</span>}
                  </div>
                  <div className="muted small">{offerTerms(t, o)}</div>
                  {o.notes && <div className="muted small" dir="auto">{o.notes}</div>}
                </div>
                <div className="offer-end">
                  <span className="offer-price">{offerPrice(t, lang, o)}</span>
                  {manage && <>
                    <button className="icon-btn" onClick={() => setOfferModal({ offer: o })} aria-label={t('common.edit')} title={t('common.edit')}><PencilIcon /></button>
                    <button className="icon-btn" onClick={() => setConfirm({ kind: 'offer', offer: o })} aria-label={t('common.delete')} title={t('common.delete')}><XIcon /></button>
                  </>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {manage && (w.status === 'Draft' || w.status === 'Rejected') && (
        <div>
          <button className="btn btn-ghost danger" onClick={() => setConfirm({ kind: 'listing' })}>{t('wh.delete')}</button>
        </div>
      )}

      {editing && <WarehouseFormModal warehouse={w} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast('success', t('wh.saved')); load(); }} />}
      {offerModal && (
        <OfferModal warehouseId={w.id} offer={offerModal.offer} onClose={() => setOfferModal(null)}
          onSaved={() => { setOfferModal(null); toast('success', t('offerForm.saved')); load(); }} />
      )}
      {confirm?.kind === 'offer' && (
        <ConfirmModal title={t('offerForm.deleteTitle')} body={t('offerForm.deleteBody', { offer: offerTitle(t, confirm.offer) })}
          confirmLabel={t('common.delete')} busy={busy} onClose={() => setConfirm(null)}
          onConfirm={() => run(() => warehousesApi.removeOffer(w.id, confirm.offer.id), 'offerForm.deleted')} />
      )}
      {confirm?.kind === 'listing' && (
        <ConfirmModal title={t('wh.deleteTitle', { name: w.name })} body={t('wh.deleteBody')}
          confirmLabel={t('common.delete')} busy={busy} onClose={() => setConfirm(null)} onConfirm={deleteListing} />
      )}
    </div>
  );
}
