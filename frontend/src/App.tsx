import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { isPlatformAdmin } from './auth/roles';
import { Layout } from './components/Layout';
import { AccountStatusPage } from './pages/AccountStatusPage';
import { AdminOrganizationsPage } from './pages/AdminOrganizationsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TeamPage } from './pages/TeamPage';

// Three states: signed out → sign in / sign up; signed in but the organisation
// isn't approved → its status; approved → the app.
export default function App() {
  const { me, loading } = useAuth();

  if (loading) return <div className="boot"><span className="spinner" /></div>;

  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (me.organization.status !== 'Active') return <AccountStatusPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="team" element={<TeamPage />} />
        {isPlatformAdmin(me.user.role) && <Route path="admin/organizations" element={<AdminOrganizationsPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
