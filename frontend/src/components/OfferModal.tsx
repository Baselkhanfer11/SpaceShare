import { useState, type FormEvent } from 'react';
import { warehousesApi } from '../api/endpoints';
import { useI18n } from '../i18n/LanguageContext';
import { unitName } from '../lib/listings';
import { CURRENCY } from '../lib/money';
import { SPACE_UNITS, TEMPERATURES, type SpaceOffer, type SpaceOfferInput, type SpaceUnit, type Temperature } from '../types';
import { Modal } from './Modal';

/** Add or change one kind of space a warehouse rents out. */
export function OfferModal({ warehouseId, offer, onClose, onSaved }: {
  warehouseId: number; offer?: SpaceOffer; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const [unitType, setUnitType] = useState<SpaceUnit>(offer?.unitType ?? 'Pallet');
  const [temperature, setTemperature] = useState<Temperature>(offer?.temperature ?? 'Ambient');
  // Numbers are kept as typed (strings) and checked on save.
  const [capacity, setCapacity] = useState(offer ? String(offer.capacity) : '');
  const [price, setPrice] = useState(offer ? String(offer.pricePerWeek) : '');
  const [minWeeks, setMinWeeks] = useState(offer ? String(offer.minWeeks) : '1');
  const [isActive, setIsActive] = useState(offer?.isActive ?? true);
  const [notes, setNotes] = useState(offer?.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const data: SpaceOfferInput = {
      unitType,
      temperature,
      capacity: Number(capacity),
      pricePerWeek: Number(price),
      minWeeks: Number(minWeeks),
      isActive,
      notes: notes.trim() || null,
    };
    if (!Number.isInteger(data.capacity) || data.capacity < 1) return setError(t('offerForm.badCapacity'));
    // Checked as typed text: at most 2 decimals (floating-point maths gets 0.10 × 100 wrong).
    if (!/^\d+(\.\d{1,2})?$/.test(price.trim()) || !(data.pricePerWeek > 0)) return setError(t('offerForm.badPrice'));
    if (!Number.isInteger(data.minWeeks) || data.minWeeks < 1) return setError(t('offerForm.badWeeks'));

    setBusy(true);
    setError('');
    try {
      await (offer ? warehousesApi.updateOffer(warehouseId, offer.id, data) : warehousesApi.addOffer(warehouseId, data));
      onSaved();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={t(offer ? 'offerForm.editTitle' : 'offerForm.addTitle')}
      subtitle={t('offerForm.sub')}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={() => submit()} disabled={busy}>
          {busy && <span className="spinner" />} {t(offer ? 'common.save' : 'offerForm.add')}
        </button>
      </>}
    >
      <form className="form" onSubmit={submit}>
        <div className="field-row">
          <label className="field">
            <span>{t('offerForm.unit')}</span>
            <select className="input" value={unitType} onChange={(e) => setUnitType(e.target.value as SpaceUnit)}>
              {SPACE_UNITS.map((u) => <option key={u} value={u}>{t(`unit.${u}.label`)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t('offerForm.temperature')}</span>
            <select className="input" value={temperature} onChange={(e) => setTemperature(e.target.value as Temperature)}>
              {TEMPERATURES.map((x) => <option key={x} value={x}>{t(`temp.${x}`)}</option>)}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>{t('offerForm.capacity', { unit: unitName(t, unitType, 2) })} <span className="req">*</span></span>
            <input className="input" type="number" min="1" step="1" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('offerForm.price', { currency: CURRENCY, unit: unitName(t, unitType) })} <span className="req">*</span></span>
            <input className="input" type="number" min="0.01" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>{t('offerForm.minWeeks')}</span>
          <input className="input" type="number" min="1" max="104" step="1" inputMode="numeric" value={minWeeks} onChange={(e) => setMinWeeks(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('offerForm.notes')}</span>
          <input className="input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('offerForm.notesPlaceholder')} />
        </label>
        <label className="check">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>
            {t('offerForm.active')}
            <small className="hint">{t('offerForm.activeHint')}</small>
          </span>
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
