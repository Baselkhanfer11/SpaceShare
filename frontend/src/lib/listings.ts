import type { Lang } from '../i18n/dictionary';
import type { SpaceOffer } from '../types';
import { formatMoney } from './money';

type T = (key: string, vars?: Record<string, string | number>) => string;

/** "pallet" / "pallets" (or the Arabic), for one unit or many. */
export const unitName = (t: T, unit: string, count = 1) => t(`unit.${unit}.${count === 1 ? 'one' : 'many'}`);

/** "Chilled pallets" — what kind of space an offer is. */
export const offerTitle = (t: T, o: Pick<SpaceOffer, 'unitType' | 'temperature'>) =>
  t('offer.title', { temp: t(`temp.${o.temperature}`), unit: unitName(t, o.unitType, 2) });

/** "JOD 3.50 / pallet / week". */
export const offerPrice = (t: T, lang: Lang, o: Pick<SpaceOffer, 'unitType' | 'pricePerWeek'>) =>
  t('offer.price', { price: formatMoney(o.pricePerWeek, lang), unit: unitName(t, o.unitType) });

/** "120 pallets · from 2 weeks". */
export const offerTerms = (t: T, o: Pick<SpaceOffer, 'unitType' | 'capacity' | 'minWeeks'>) =>
  t('offer.terms', {
    capacity: `${o.capacity.toLocaleString('en')} ${unitName(t, o.unitType, o.capacity)}`,
    weeks: t(o.minWeeks === 1 ? 'offer.minWeek' : 'offer.minWeeks', { n: o.minWeeks }),
  });
