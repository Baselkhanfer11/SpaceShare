import type { Lang } from '../i18n/dictionary';

const locale = (lang: Lang) => (lang === 'ar' ? 'ar' : 'en-GB');

/** "1 Oct 2026" (or the Arabic form). */
export function formatDate(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/** "1 Oct 2026, 14:05". */
export function formatDateTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}
