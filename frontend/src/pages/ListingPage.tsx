import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { searchApi } from '../api/endpoints';
import { ListingView } from '../components/ListingParts';
import { useI18n } from '../i18n/LanguageContext';
import type { WarehouseDetail } from '../types';

/** One live listing, from search. */
export function ListingPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const [listing, setListing] = useState<WarehouseDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    searchApi.get(Number(id)).then(setListing).catch((e: Error) => setError(e.message));
  }, [id]);

  return (
    <div className="stack">
      <Link to="/search" className="back-link">{t('listing.back')}</Link>
      {error ? <div className="panel empty error">{t('listing.notFound')}</div> : !listing ? <div className="panel empty"><span className="spinner" /></div> : (
        <>
          <div className="page-header with-action">
            <div>
              <h1>{listing.name}</h1>
              <p>{listing.city}</p>
            </div>
            {/* Booking is the next milestone; the button shows where it will be. */}
            <div className="book-cta">
              <button className="btn btn-primary" disabled>{t('listing.book')}</button>
              <span className="hint">{t('listing.bookSoon')}</span>
            </div>
          </div>
          <section className="panel"><ListingView listing={listing} /></section>
        </>
      )}
    </div>
  );
}
