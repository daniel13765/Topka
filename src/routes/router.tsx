import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { Toaster } from 'react-hot-toast';
import { guardRoute, redirectOnSessionExpired } from './authGuard';
import ConnexionPage from '../pages/auth/ConnexionPage';
import InscriptionPage from '../pages/auth/InscriptionPage';
import Verification2faPage from '../pages/auth/Verification2faPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import NotificationsPage from '../pages/client/notifications/NotificationsPage';
import HomePage from '../pages/client/accueil/HomePage';
import CatalogPage from '../pages/client/catalogue/CatalogPage';
import ProductPage from '../pages/client/fiche-produit/ProductPage';
import CartPage from '../pages/client/panier/CartPage';
import ConfirmationPage from '../pages/client/confirmation-commande/ConfirmationPage';
import ProfilePage from '../pages/client/profil/ProfilePage';
import NegotiationsPage from '../pages/client/negociations/NegotiationsPage';
import OrderTrackingPage from '../pages/client/commandes/OrderTrackingPage';
import OrdersListPage from '../pages/client/commandes/OrdersListPage';
import MessagingPage from '../pages/client/messagerie/MessagingPage';
import AdminCatalogPage from '../pages/admin/AdminCatalogPage';
import AdminCategoriesPage from '../pages/admin/AdminCategoriesPage';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminOrdersPage from '../pages/admin/AdminOrdersPage';
import AdminZonesPage from '../pages/admin/AdminZonesPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminUserDetailPage from '../pages/admin/AdminUserDetailPage';
import AdminLivreursPage from '../pages/admin/AdminLivreursPage';
import AdminValidationsPage from '../pages/admin/AdminValidationsPage';
import AdminLogsPage from '../pages/admin/AdminLogsPage';
import AdminParametresPage from '../pages/admin/AdminParametresPage';
import AdminSystemePage from '../pages/admin/AdminSystemePage';
import AdminBddPage from '../pages/admin/AdminBddPage';
import AdminClesApiPage from '../pages/admin/AdminClesApiPage';
import AdminSecuritePage from '../pages/admin/AdminSecuritePage';
import ManagerDashboardPage from '../pages/manager/ManagerDashboardPage';
import ManagerOrdersPage from '../pages/manager/ManagerOrdersPage';
import ManagerEquipePage from '../pages/manager/ManagerEquipePage';
import ManagerStatsPage from '../pages/manager/ManagerStatsPage';
import ManagerLitigesPage from '../pages/manager/ManagerLitigesPage';
import ManagerParametresPage from '../pages/manager/ManagerParametresPage';
import ManagerZonePrefsPage from '../pages/manager/ManagerZonePrefsPage';
import LivreurDashboardPage from '../pages/livreur/dashboard/LivreurDashboardPage';
import LivreurCoursePage from '../pages/livreur/course-active/LivreurCoursePage';
import LivreurRecapPage from '../pages/livreur/recap-fin-course/LivreurRecapPage';
import LivreurHistoryPage from '../pages/livreur/historique-livraisons/LivreurHistoryPage';
import LivreurSettingsPage from '../pages/livreur/parametres/LivreurSettingsPage';
import NotFoundPage from '../pages/NotFoundPage';
import SystemBridge from '../components/system/SystemBridge';

const rootRoute = createRootRoute({
  // Garde globale (authGuard.ts) : non connecté → /connexion sur toute page hors accueil et écrans
  // d'auth ; mauvais rôle → espace de son rôle. Droits calqués sur ceux du backend.
  beforeLoad: guardRoute,
  component: () => (
    <>
      <SystemBridge />
      <Outlet />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#111827',
            color: '#FFFFFF',
            borderRadius: '10px',
            fontSize: '14px',
            padding: '10px 16px',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#FFFFFF' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#FFFFFF' } },
        }}
      />
    </>
  ),
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const connexionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/connexion',
  component: ConnexionPage,
  // ?redirect= : page demandée avant la connexion (garde authGuard.ts), rejouée après la 2FA.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
});
const inscriptionRoute = createRoute({ getParentRoute: () => rootRoute, path: '/inscription', component: InscriptionPage });
const verificationRoute = createRoute({ getParentRoute: () => rootRoute, path: '/verification-2fa', component: Verification2faPage });
// Lien envoyé par POST /api/auth/forgot-password : /reset-password?token=...&email=...
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>): { token?: string; email?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    email: typeof search.email === 'string' ? search.email : undefined,
  }),
});
const notificationsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/notifications', component: NotificationsPage });
const catalogueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/catalogue',
  component: CatalogPage,
  validateSearch: (search: Record<string, unknown>): { q?: string; cat?: string } => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    // ?cat=c{id} (catégorie API) ou ?cat=pack — lien depuis les tuiles de l'accueil
    cat: typeof search.cat === 'string' ? search.cat : undefined,
  }),
});
const produitRoute = createRoute({ getParentRoute: () => rootRoute, path: '/produit/$productId', component: ProductPage });
const panierRoute = createRoute({ getParentRoute: () => rootRoute, path: '/panier', component: CartPage });
const confirmationRoute = createRoute({ getParentRoute: () => rootRoute, path: '/confirmation', component: ConfirmationPage });
const profilRoute = createRoute({ getParentRoute: () => rootRoute, path: '/profil', component: ProfilePage });
const negociationsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/negociations', component: NegotiationsPage });
const orderTrackingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/commandes/suivi',
  component: OrderTrackingPage,
  validateSearch: (search: Record<string, unknown>): { order?: string } => ({
    order: typeof search.order === 'string' ? search.order : undefined,
  }),
});
const ordersListRoute = createRoute({ getParentRoute: () => rootRoute, path: '/commandes', component: OrdersListPage });
const messagingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/messagerie', component: MessagingPage });
const adminCatalogueRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/catalogue', component: AdminCatalogPage });
const adminDashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminDashboardPage });
const adminOrdersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/commandes', component: AdminOrdersPage });
const adminCategoriesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/categories', component: AdminCategoriesPage });
const adminZonesPageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/zones', component: AdminZonesPage });
const adminUsersPageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/utilisateurs', component: AdminUsersPage });
const adminUserDetailPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/utilisateurs/detail',
  component: AdminUserDetailPage,
  validateSearch: (search: Record<string, unknown>): { id?: number } => ({
    id: typeof search.id === 'string' ? Number(search.id) : typeof search.id === 'number' ? search.id : undefined,
  }),
});
const adminLivreursPageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/livreurs', component: AdminLivreursPage });
const adminValidationsPageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/validations', component: AdminValidationsPage });
const adminLogsPageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/logs', component: AdminLogsPage });
const adminParametresPageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/parametres', component: AdminParametresPage });
const adminSystemePageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/systeme', component: AdminSystemePage });
const adminBddPageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/bdd-jobs', component: AdminBddPage });
const adminClesApiPageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/cles-api', component: AdminClesApiPage });
const adminSecuritePageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/securite', component: AdminSecuritePage });
const managerDashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/manager', component: ManagerDashboardPage });
const managerOrdersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/manager/commandes', component: ManagerOrdersPage });
const managerEquipeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/manager/equipe', component: ManagerEquipePage });
const managerStatsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/manager/statistiques', component: ManagerStatsPage });
const managerLitigesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/manager/litiges', component: ManagerLitigesPage });
const managerParametresRoute = createRoute({ getParentRoute: () => rootRoute, path: '/manager/parametres', component: ManagerParametresPage });
const managerZonePrefsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/manager/parametres/zone', component: ManagerZonePrefsPage });

// Espace livreur (rôle livreur uniquement — authGuard.ts). ?commande=<id> : course ciblée.
const commandeSearch = (search: Record<string, unknown>): { commande?: number } => {
  const n = Number(search.commande);
  return { commande: Number.isInteger(n) && n > 0 ? n : undefined };
};
const livreurRoute = createRoute({ getParentRoute: () => rootRoute, path: '/livreur', component: LivreurDashboardPage });
const livreurCourseRoute = createRoute({ getParentRoute: () => rootRoute, path: '/livreur/course', component: LivreurCoursePage, validateSearch: commandeSearch });
const livreurRecapRoute = createRoute({ getParentRoute: () => rootRoute, path: '/livreur/recapitulatif', component: LivreurRecapPage, validateSearch: commandeSearch });
const livreurHistoriqueRoute = createRoute({ getParentRoute: () => rootRoute, path: '/livreur/historique', component: LivreurHistoryPage });
const livreurParametresRoute = createRoute({ getParentRoute: () => rootRoute, path: '/livreur/parametres', component: LivreurSettingsPage });
// Route temporaire de review des composants (retirée à la fin du Sprint 1).

const routeTree = rootRoute.addChildren([
  indexRoute,
  connexionRoute,
  inscriptionRoute,
  verificationRoute,
  resetPasswordRoute,
  notificationsRoute,
  catalogueRoute,
  produitRoute,
  panierRoute,
  confirmationRoute,
  profilRoute,
  negociationsRoute,
  ordersListRoute,
  orderTrackingRoute,
  messagingRoute,
  adminDashboardRoute,
  adminOrdersRoute,
  adminCatalogueRoute,
  adminCategoriesRoute,
  adminZonesPageRoute,
  adminUsersPageRoute,
  adminUserDetailPageRoute,
  adminLivreursPageRoute,
  adminValidationsPageRoute,
  adminLogsPageRoute,
  adminParametresPageRoute,
  adminSystemePageRoute,
  adminBddPageRoute,
  adminClesApiPageRoute,
  adminSecuritePageRoute,
  managerDashboardRoute,
  managerOrdersRoute,
  managerEquipeRoute,
  managerStatsRoute,
  managerLitigesRoute,
  managerParametresRoute,
  managerZonePrefsRoute,
  livreurRoute,
  livreurCourseRoute,
  livreurRecapRoute,
  livreurHistoriqueRoute,
  livreurParametresRoute,
]);

export const router = createRouter({ routeTree });

// Session perdue en cours de navigation (401 de l'API) → /connexion hors pages publiques (authGuard.ts).
redirectOnSessionExpired(router);

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
