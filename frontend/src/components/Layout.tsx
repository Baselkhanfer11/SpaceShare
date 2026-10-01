import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isPlatformAdmin } from '../auth/roles';
import { useI18n } from '../i18n/LanguageContext';
import { BuildingIcon, HomeIcon, LogOutIcon, LogoIcon, UsersIcon } from './icons';
import { Prefs } from './Prefs';

/** The app frame once signed in and approved: top bar, navigation, the page. */
export function Layout() {
  const { me, logout } = useAuth();
  const { t } = useI18n();
  if (!me) return null;

  const link = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand"><span className="brand-mark"><LogoIcon /></span>SpaceShare</div>
          <nav className="nav" aria-label={t('nav.label')}>
            <NavLink to="/" end className={link}><HomeIcon /> {t('nav.home')}</NavLink>
            {isPlatformAdmin(me.user.role) && (
              <NavLink to="/admin/organizations" className={link}><BuildingIcon /> {t('nav.organizations')}</NavLink>
            )}
            <NavLink to="/team" className={link}><UsersIcon /> {t('nav.team')}</NavLink>
          </nav>
          <div className="topbar-end">
            <Prefs />
            <div className="who">
              <span className="who-name">{me.user.fullName}</span>
              <span className="who-org">{me.organization.name}</span>
            </div>
            <button className="icon-btn" onClick={logout} aria-label={t('auth.signOut')} title={t('auth.signOut')}><LogOutIcon /></button>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
