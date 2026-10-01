import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isOwner, isPlatformAdmin } from '../auth/roles';
import { BuildingIcon, UsersIcon } from '../components/icons';
import { useI18n } from '../i18n/LanguageContext';

// What each side of the marketplace gets next (the MVP milestones), so a new
// user knows what's coming. Updated as each milestone ships.
const COMING: Record<string, string[]> = {
  Provider: ['home.next.listSpace', 'home.next.bookings', 'home.next.receive', 'home.next.invoices'],
  Client: ['home.next.search', 'home.next.book', 'home.next.stock', 'home.next.ship'],
  Platform: ['home.next.approveListings', 'home.next.disputes'],
};

export function HomePage() {
  const { me } = useAuth();
  const { t } = useI18n();
  if (!me) return null;

  const admin = isPlatformAdmin(me.user.role);
  const firstName = me.user.fullName.split(' ')[0];

  return (
    <div className="stack">
      <div className="page-header">
        <h1>{t('home.hello', { name: firstName })}</h1>
        <p>{t(`home.sub.${me.organization.type}`, { org: me.organization.name })}</p>
      </div>

      <div className="cards">
        {admin ? (
          <Link to="/admin/organizations" className="card card-link">
            <span className="card-icon"><BuildingIcon /></span>
            <span className="card-title">{t('home.review.title')}</span>
            <span className="card-sub">{t('home.review.sub')}</span>
          </Link>
        ) : (
          <Link to="/team" className="card card-link">
            <span className="card-icon"><UsersIcon /></span>
            <span className="card-title">{t('home.team.title')}</span>
            <span className="card-sub">{t(isOwner(me.user.role) ? 'home.team.subOwner' : 'home.team.sub')}</span>
          </Link>
        )}
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
