import type { Lang } from '../i18n/dictionary';

// The launch market's currency. The design doc leaves the launch city open;
// Jordanian dinar until that's decided — change it here only.
export const CURRENCY = 'JOD';

/** "JOD 3.50" (or the Arabic form). Prices are stored with 2 decimals. */
export function formatMoney(amount: number, lang: Lang) {
  // -u-nu-latn: Western digits in Arabic too, matching the numbers people type.
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-JO', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
