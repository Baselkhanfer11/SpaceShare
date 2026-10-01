import { useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { offerPrice, offerTerms, offerTitle } from '../lib/listings';
import type { WarehouseDetail, WarehouseStatus } from '../types';
import { ClockIcon, WarehouseIcon } from './icons';

/** Draft / Waiting for review / Live / Rejected. */
export function ListingStatusBadge({ status }: { status: WarehouseStatus }) {
  const { t } = useI18n();
  return <span className={`badge listing-${status.toLowerCase()}`}>{t(`listingStatus.${status}`)}</span>;
}

/** A listing's cover photo, or a quiet placeholder when it has none. */
export function Cover({ url, alt, className = '' }: { url: string | null; alt: string; className?: string }) {
  return url
    ? <img className={`cover ${className}`} src={url} alt={alt} loading="lazy" />
    : <div className={`cover cover-empty ${className}`} aria-hidden="true"><WarehouseIcon /></div>;
}

/** "CCTV", "Loading dock"… as small chips. */
export function FeatureChips({ features, max }: { features: string[]; max?: number }) {
  const { t } = useI18n();
  const shown = max ? features.slice(0, max) : features;
  const more = features.length - shown.length;
  return (
    <div className="feature-chips">
      {shown.map((f) => <span key={f} className="chip off">{t(`feature.${f}`)}</span>)}
      {more > 0 && <span className="chip off">+{more}</span>}
    </div>
  );
}

/**
 * A listing as businesses see it: photos, where it is, what it offers.
 * Used by search, the owner's preview and the admin's review.
 */
export function ListingView({ listing }: { listing: WarehouseDetail }) {
  const { t, lang } = useI18n();
  const [shown, setShown] = useState(0);
  const photo = listing.photos[Math.min(shown, listing.photos.length - 1)];

  return (
    <div className="listing">
      <div className="gallery">
        <Cover url={photo?.url ?? null} alt={listing.name} className="gallery-main" />
        {listing.photos.length > 1 && (
          <div className="gallery-thumbs">
            {listing.photos.map((p, i) => (
              <button key={p.id} className={`thumb ${i === shown ? 'active' : ''}`} onClick={() => setShown(i)}
                aria-label={t('listing.photoN', { n: i + 1 })}>
                <img src={p.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="listing-info">
        <div>
          <p className="muted">{t('listing.by', { provider: listing.providerName })}</p>
          <p dir="auto">{listing.address}, {listing.city}</p>
          {listing.openingHours && <p className="muted with-icon"><ClockIcon /> <span dir="auto">{listing.openingHours}</span></p>}
        </div>
        {listing.features.length > 0 && <FeatureChips features={listing.features} />}
        {listing.description && <p className="listing-desc" dir="auto">{listing.description}</p>}
      </div>

      <section className="offers">
        <h2>{t('listing.spaceAvailable')}</h2>
        {listing.offers.length === 0 ? <p className="muted">{t('listing.noOffers')}</p> : (
          <ul className="offer-list">
            {listing.offers.map((o) => (
              <li key={o.id} className={`offer-row ${o.isActive ? '' : 'inactive'}`}>
                <div>
                  <div className="offer-title">
                    {offerTitle(t, o)}
                    {!o.isActive && <span className="chip off">{t('offer.paused')}</span>}
                  </div>
                  <div className="muted small">{offerTerms(t, o)}</div>
                  {o.notes && <div className="muted small" dir="auto">{o.notes}</div>}
                </div>
                <div className="offer-price">{offerPrice(t, lang, o)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
