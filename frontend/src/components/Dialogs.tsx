import { useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { Modal } from './Modal';

/** "Are you sure?" before something that can't be undone. */
export function ConfirmModal({ title, body, confirmLabel, busy, onClose, onConfirm }: {
  title: string; body: ReactNode; confirmLabel: string; busy: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy && <span className="spinner" />} {confirmLabel}</button>
      </>}
    >
      <p className="muted">{body}</p>
    </Modal>
  );
}

/** Asks for a reason the other side will see (rejecting, suspending, taking down). */
export function ReasonModal({ title, subtitle, placeholder, confirmLabel, busy, onClose, onConfirm }: {
  title: string; subtitle: string; placeholder: string; confirmLabel: string; busy: boolean;
  onClose: () => void; onConfirm: (reason: string) => void;
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
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn btn-danger" onClick={confirm} disabled={busy}>{busy && <span className="spinner" />} {confirmLabel}</button>
      </>}
    >
      <div className="form">
        <label className="field">
          <span>{t('admin.reason')} <span className="req">*</span></span>
          <textarea className="input" rows={3} value={note} autoFocus placeholder={placeholder}
            onChange={(e) => { setNote(e.target.value); setError(''); }} />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
