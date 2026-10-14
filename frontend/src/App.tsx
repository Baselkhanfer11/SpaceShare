import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { isPlatformAdmin } from './auth/roles';
import { Layout } from './components/Layout';
import { AccountStatusPage } from './pages/AccountStatusPage';
import { AdminListingsPage } from './pages/AdminListingsPage';
import { AdminOrganizationsPage } from './pages/AdminOrganizationsPage';
import { HomePage } from './pages/HomePage';
import { LandingPage } from './pages/LandingPage';
import { ListingPage } from './pages/ListingPage';
import { LoginPage } from './pages/LoginPage';
import { MyWarehousesPage } from './pages/MyWarehousesPage';
import { RegisterPage } from './pages/RegisterPage';
import { SearchPage } from './pages/SearchPage';
import { TeamPage } from './pages/TeamPage';
import { WarehouseEditorPage } from './pages/WarehouseEditorPage';

// Three states: signed out → the landing page, sign in, sign up; signed in but the
// organisation isn't approved → its status; approved → the app.
export default function App() {
  const { me, loading } = useAuth();

  if (loading) return <div className="boot"><span className="spinner" /></div>;

  if (!me) {
    return (
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (me.organization.status !== 'Active') return <AccountStatusPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="team" element={<TeamPage />} />
        {/* Anyone signed in can browse live listings (warehouse owners see their own from their list). */}
        <Route path="search" element={<SearchPage />} />
        <Route path="listings/:id" element={<ListingPage />} />
        {me.organization.type === 'Provider' && <>
          <Route path="warehouses" element={<MyWarehousesPage />} />
          <Route path="warehouses/:id" element={<WarehouseEditorPage />} />
        </>}
        {isPlatformAdmin(me.user.role) && <>
          <Route path="admin/organizations" element={<AdminOrganizationsPage />} />
          <Route path="admin/listings" element={<AdminListingsPage />} />
        </>}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
