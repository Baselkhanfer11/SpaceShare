import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchApi } from '../api/endpoints';
import { SearchIcon } from '../components/icons';
import { Cover, FeatureChips } from '../components/ListingParts';
import { useI18n } from '../i18n/LanguageContext';
import { offerPrice, offerTitle } from '../lib/listings';
import { CURRENCY } from '../lib/money';
import { SPACE_UNITS, TEMPERATURES, type SearchFilters, type SearchResult, type SpaceUnit, type Temperature } from '../types';

// The filters as typed (numbers stay strings until searched).
interface Form { city: string; unitType: string; temperature: string; maxPrice: string; minUnits: string }
const EMPTY: Form = { city: '', unitType: '', temperature: '', maxPrice: '', minUnits: '' };

function toFilters(f: Form): SearchFilters {
  const num = (s: string) => (s.trim() && Number(s) > 0 ? Number(s) : undefined);
  return {
    city: f.city || undefined,
    unitType: (f.unitType || undefined) as SpaceUnit | undefined,
    temperature: (f.temperature || undefined) as Temperature | undefined,
    maxPrice: num(f.maxPrice),
    minUnits: num(f.minUnits),
  };
}

/** The marketplace: find warehouse space by city, kind, price and size. */
export function SearchPage() {
  const { t, lang } = useI18n();
  const [form, setForm] = useState<Form>(EMPTY);
  const [cities, setCities] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { searchApi.cities().then(setCities).catch(() => { /* the filter just stays empty */ }); }, []);

  // Search as the filters change (a short pause first, so typing a price doesn't fire on every key).
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      searchApi.search(toFilters(form))
        .then((r) => { if (active) { setResults(r); setError(''); } })
        .catch((e: Error) => { if (active) setError(e.message); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [form]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const filtered = Object.values(form).some(Boolean);

  return (
    <div className="stack">
      <div className="page-header">
        <h1>{t('search.title')}</h1>
        <p>{t('search.sub')}</p>
      </div>

      <section className="panel filters" aria-label={t('search.filters')}>
        <label className="field">
          <span>{t('field.city')}</span>
          <select className="input" value={form.city} onChange={set('city')}>
            <option value="">{t('search.anyCity')}</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('offerForm.unit')}</span>
          <select className="input" value={form.unitType} onChange={set('unitType')}>
            <option value="">{t('search.any')}</option>
            {SPACE_UNITS.map((u) => <option key={u} value={u}>{t(`unit.${u}.label`)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('offerForm.temperature')}</span>
          <select className="input" value={form.temperature} onChange={set('temperature')}>
            <option value="">{t('search.any')}</option>
            {TEMPERATURES.map((x) => <option key={x} value={x}>{t(`temp.${x}`)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('search.maxPrice', { currency: CURRENCY })}</span>
          <input className="input" type="number" min="0" step="0.5" inputMode="decimal" value={form.maxPrice} onChange={set('maxPrice')} />
        </label>
        <label className="field">
          <span>{t('search.minUnits')}</span>
          <input className="input" type="number" min="1" step="1" inputMode="numeric" value={form.minUnits} onChange={set('minUnits')} />
        </label>
        {filtered && <button className="btn btn-ghost btn-sm filters-clear" onClick={() => setForm(EMPTY)}>{t('search.clear')}</button>}
      </section>

      {error ? <div className="panel empty error">{error}</div> : !results ? <div className="panel empty"><span className="spinner" /></div> : (
        results.length === 0 ? (
          <div className="panel empty-state">
            <span className="card-icon"><SearchIcon /></span>
            <h2>{t(filtered ? 'search.noMatchTitle' : 'search.noneTitle')}</h2>
            <p className="muted">{t(filtered ? 'search.noMatch' : 'search.none')}</p>
          </div>
        ) : (
          <>
            <p className="muted small">{t(results.length === 1 ? 'search.countOne' : 'search.count', { n: results.length })}</p>
            <div className="listing-grid">
              {results.map((r) => {
                const cheapest = r.offers[0]; // the API sends matching offers cheapest first
                return (
                  <Link key={r.id} to={`/listings/${r.id}`} className="listing-card">
                    <Cover url={r.coverUrl} alt={r.name} />
                    <div className="listing-card-body">
                      <span className="listing-card-name">{r.name}</span>
                      <span className="muted small">{r.city} · {r.providerName}</span>
                      <span className="listing-card-price">
                        {t('search.from', { price: offerPrice(t, lang, cheapest) })}
                      </span>
                      <span className="muted small">
                        {r.offers.length === 1 ? offerTitle(t, cheapest) : t('search.options', { n: r.offers.length })}
                      </span>
                      {r.features.length > 0 && <FeatureChips features={r.features} max={3} />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )
      )}
    </div>
  );
}
