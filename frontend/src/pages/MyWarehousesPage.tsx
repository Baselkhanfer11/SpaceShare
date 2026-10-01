import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { warehousesApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { isOwner } from '../auth/roles';
import { PlusIcon, WarehouseIcon } from '../components/icons';
import { Cover, ListingStatusBadge } from '../components/ListingParts';
import { WarehouseFormModal } from '../components/WarehouseFormModal';
import { useI18n } from '../i18n/LanguageContext';
import type { WarehouseSummary } from '../types';

/** A warehouse business's listings. */
export function MyWarehousesPage() {
  const { me } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState<WarehouseSummary[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    warehousesApi.list().then(setWarehouses).catch((e: Error) => setError(e.message));
  }, []);

  const manage = isOwner(me?.user.role);

  return (
    <div className="stack">
      <div className="page-header with-action">
        <div>
          <h1>{t('wh.title')}</h1>
          <p>{t('wh.sub')}</p>
        </div>
        {manage && <button className="btn btn-primary" onClick={() => setAdding(true)}><PlusIcon /> {t('wh.add')}</button>}
      </div>

      {error ? <div className="panel empty error">{error}</div> : !warehouses ? <div className="panel empty"><span className="spinner" /></div> : (
        warehouses.length === 0 ? (
          <div className="panel empty-state">
            <span className="card-icon"><WarehouseIcon /></span>
            <h2>{t('wh.emptyTitle')}</h2>
            <p className="muted">{t(manage ? 'wh.emptyOwner' : 'wh.emptyStaff')}</p>
            {manage && <button className="btn btn-primary" onClick={() => setAdding(true)}><PlusIcon /> {t('wh.add')}</button>}
          </div>
        ) : (
          <div className="listing-grid">
            {warehouses.map((w) => (
              <Link key={w.id} to={`/warehouses/${w.id}`} className="listing-card">
                <Cover url={w.coverUrl} alt={w.name} />
                <div className="listing-card-body">
                  <div className="listing-card-top">
                    <span className="listing-card-name">{w.name}</span>
                    <ListingStatusBadge status={w.status} />
                  </div>
                  <span className="muted small">{w.city}</span>
                  <span className="muted small">{t('wh.counts', { photos: w.photoCount, offers: w.activeOfferCount })}</span>
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      {adding && (
        <WarehouseFormModal
          onClose={() => setAdding(false)}
          onSaved={(w) => navigate(`/warehouses/${w.id}`)} // carry on with photos and space offers
        />
      )}
    </div>
  );
}
