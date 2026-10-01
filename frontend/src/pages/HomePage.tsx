import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isOwner } from '../auth/roles';
import { BuildingIcon, SearchIcon, UsersIcon, WarehouseIcon } from '../components/icons';
import { useI18n } from '../i18n/LanguageContext';
import type { OrganizationType } from '../types';

// What each side of the marketplace gets next (the MVP milestones still to
// come), so a new user knows what's on the way. Trimmed as milestones ship.
const COMING: Record<OrganizationType, string[]> = {
  Provider: ['home.next.bookings', 'home.next.receive', 'home.next.invoices'],
  Client: ['home.next.book', 'home.next.stock', 'home.next.ship'],
  Platform: ['home.next.disputes'],
};

interface Card { to: string; icon: ReactNode; title: string; sub: string }

export function HomePage() {
  const { me } = useAuth();
  const { t } = useI18n();
  if (!me) return null;

  const team: Card = {
    to: '/team', icon: <UsersIcon />, title: 'home.team.title',
    sub: isOwner(me.user.role) ? 'home.team.subOwner' : 'home.team.sub',
  };
  // What this side of the marketplace can do today.
  const cards: Record<OrganizationType, Card[]> = {
    Provider: [{ to: '/warehouses', icon: <WarehouseIcon />, title: 'home.warehouses.title', sub: 'home.warehouses.sub' }, team],
    Client: [{ to: '/search', icon: <SearchIcon />, title: 'home.search.title', sub: 'home.search.sub' }, team],
    Platform: [
      { to: '/admin/organizations', icon: <BuildingIcon />, title: 'home.review.title', sub: 'home.review.sub' },
      { to: '/admin/listings', icon: <WarehouseIcon />, title: 'home.listings.title', sub: 'home.listings.sub' },
    ],
  };

  return (
    <div className="stack">
      <div className="page-header">
        <h1>{t('home.hello', { name: me.user.fullName.split(' ')[0] })}</h1>
        <p>{t(`home.sub.${me.organization.type}`, { org: me.organization.name })}</p>
      </div>

      <div className="cards">
        {cards[me.organization.type].map((c) => (
          <Link key={c.to} to={c.to} className="card card-link">
            <span className="card-icon">{c.icon}</span>
            <span className="card-title">{t(c.title)}</span>
            <span className="card-sub">{t(c.sub)}</span>
          </Link>
        ))}
      </div>

      <section className="panel">
        <h2>{t('home.next.title')}</h2>
        <ul className="next-list">
          {COMING[me.organization.type].map((key) => <li key={key}>{t(key)}</li>)}
        </ul>
      </section>
    </div>
  );
}
