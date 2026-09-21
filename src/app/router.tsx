import { Route, Routes } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/auth/LoginPage';
import { NotFoundPage } from '../pages/errors/NotFoundPage';
import { ClientDashboardPage } from '../pages/client/ClientDashboardPage';
import { LivreurDashboardPage } from '../pages/livreur/LivreurDashboardPage';
import { ManagerDashboardPage } from '../pages/manager/ManagerDashboardPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { RoleGuard } from '../routes/guards/RoleGuard';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/connexion" element={<LoginPage />} />

      <Route element={<RoleGuard allowed={['client']} />}>
        <Route path="/client" element={<ClientDashboardPage />} />
      </Route>
      <Route element={<RoleGuard allowed={['livreur']} />}>
        <Route path="/livreur" element={<LivreurDashboardPage />} />
      </Route>
      <Route element={<RoleGuard allowed={['manager']} />}>
        <Route path="/manager" element={<ManagerDashboardPage />} />
      </Route>
      <Route element={<RoleGuard allowed={['admin']} />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
