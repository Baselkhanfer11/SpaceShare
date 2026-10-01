import { useState, type FormEvent } from 'react';
import { warehousesApi } from '../api/endpoints';
import { useI18n } from '../i18n/LanguageContext';
import { WAREHOUSE_FEATURES, type WarehouseDetail, type WarehouseInput } from '../types';
import { Modal } from './Modal';

/** Add a warehouse (a new draft) or change an existing one's details. */
export function WarehouseFormModal({ warehouse, onClose, onSaved }: {
  warehouse?: WarehouseDetail; onClose: () => void; onSaved: (w: WarehouseDetail) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: warehouse?.name ?? '',
    city: warehouse?.city ?? '',
    address: warehouse?.address ?? '',
    openingHours: warehouse?.openingHours ?? '',
    description: warehouse?.description ?? '',
  });
  const [features, setFeatures] = useState<string[]>(warehouse?.features ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (f: string) => setFeatures((list) => (list.includes(f) ? list.filter((x) => x !== f) : [...list, f]));

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const data: WarehouseInput = {
      name: form.name,
      city: form.city,
      address: form.address,
      openingHours: form.openingHours.trim() || null,
      description: form.description.trim() || null,
      features,
    };
    setBusy(true);
    setError('');
    try { onSaved(await (warehouse ? warehousesApi.update(warehouse.id, data) : warehousesApi.create(data))); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={t(warehouse ? 'wh.editTitle' : 'wh.addTitle')}
      subtitle={t(warehouse ? 'wh.editSub' : 'wh.addSub')}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={() => submit()} disabled={busy}>
          {busy && <span className="spinner" />} {t(warehouse ? 'common.save' : 'wh.create')}
        </button>
      </>}
    >
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>{t('wh.name')} <span className="req">*</span></span>
          <input className="input" required maxLength={200} value={form.name} onChange={set('name')} autoFocus placeholder={t('wh.namePlaceholder')} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>{t('field.city')} <span className="req">*</span></span>
            <input className="input" required maxLength={100} value={form.city} onChange={set('city')} />
          </label>
          <label className="field">
            <span>{t('wh.hours')}</span>
            <input className="input" maxLength={200} value={form.openingHours} onChange={set('openingHours')} placeholder={t('wh.hoursPlaceholder')} />
          </label>
        </div>
        <label className="field">
          <span>{t('wh.address')} <span className="req">*</span></span>
          <input className="input" required maxLength={300} value={form.address} onChange={set('address')} />
        </label>
        <label className="field">
          <span>{t('wh.description')}</span>
          <textarea className="input" rows={3} maxLength={2000} value={form.description} onChange={set('description')} placeholder={t('wh.descriptionPlaceholder')} />
        </label>
        <fieldset className="field">
          <legend>{t('wh.features')}</legend>
          <div className="check-grid">
            {WAREHOUSE_FEATURES.map((f) => (
              <label key={f} className="check">
                <input type="checkbox" checked={features.includes(f)} onChange={() => toggle(f)} />
                <span>{t(`feature.${f}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
