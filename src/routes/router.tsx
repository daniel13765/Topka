import { Suspense, lazy, type ComponentType } from 'react';
import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { Toaster } from 'react-hot-toast';
import { guardRoute, redirectOnSessionExpired } from './authGuard';
import LoadingState from '../components/shared/LoadingState';
import NotFoundPage from '../pages/NotFoundPage';
import SystemBridge from '../components/system/SystemBridge';

/**
 * Découpage du bundle : une page = un chunk.
 *
 * Toutes les pages étaient importées en statique, donc embarquées dans le bundle initial (1 845 Ko
 * minifiés, 496 Ko gzip) : un client qui ouvre `/` téléchargeait les écrans super-admin, le leaflet
 * de suivi, le PDF de reçu et les 6 écrans livreur. Avec `lazy()`, Vite crée un chunk par page et
 * `defaultPreload: 'intent'` (ci-dessous) précharge dès le survol du lien : le premier affichage est
 * plus rapide, la navigation ne le devient pas.
 *
 * Le point d'entrée ne garde que ce qui sert à chaque rendu : le garde de session, la coquille
 * (SystemBridge, Toaster), l'état de chargement et la page 404 (elle doit s'afficher sans requête).
 *
 * Règle verrouillée par `tests/bundle-splitting.test.ts` : aucun `import … from '../pages/…'` en dur
 * dans ce fichier, sauf NotFoundPage.
 */
type CompositeurDePage = () => Promise<{ default: ComponentType<Record<string, never>> }>;
function page(chargement: CompositeurDePage) {
  return lazy(chargement);
}

// —— Authentification ---------------------------------------------------------------------------
const ConnexionPage = page(() => import('../pages/auth/ConnexionPage'));
const InscriptionPage = page(() => import('../pages/auth/InscriptionPage'));
const Verification2faPage = page(() => import('../pages/auth/Verification2faPage'));
const ResetPasswordPage = page(() => import('../pages/auth/ResetPasswordPage'));

// —— Espace client ------------------------------------------------------------------------------
const HomePage = page(() => import('../pages/client/accueil/HomePage'));
const CatalogPage = page(() => import('../pages/client/catalogue/CatalogPage'));
const ProductPage = page(() => import('../pages/client/fiche-produit/ProductPage'));
const CartPage = page(() => import('../pages/client/panier/CartPage'));
const ConfirmationPage = page(() => import('../pages/client/confirmation-commande/ConfirmationPage'));
const ProfilePage = page(() => import('../pages/client/profil/ProfilePage'));
const NegotiationsPage = page(() => import('../pages/client/negociations/NegotiationsPage'));
const OrderTrackingPage = page(() => import('../pages/client/commandes/OrderTrackingPage'));
const OrdersListPage = page(() => import('../pages/client/commandes/OrdersListPage'));
const MessagingPage = page(() => import('../pages/client/messagerie/MessagingPage'));
const NotificationsPage = page(() => import('../pages/client/notifications/NotificationsPage'));

// —— Espace livreur (sprint en cours : 6 écrans) -------------------------------------------------
const LivreurDashboardPage = page(() => import('../pages/livreur/dashboard/LivreurDashboardPage'));
const LivreurCoursePage = page(() => import('../pages/livreur/course-active/LivreurCoursePage'));
const LivreurRecapPage = page(() => import('../pages/livreur/recap-fin-course/LivreurRecapPage'));
const LivreurHistoryPage = page(() => import('../pages/livreur/historique-livraisons/LivreurHistoryPage'));
const LivreurSettingsPage = page(() => import('../pages/livreur/parametres/LivreurSettingsPage'));
const LivreurMessagingPage = page(() => import('../pages/livreur/messagerie/LivreurMessagingPage'));

// —— Espace manager -----------------------------------------------------------------------------
const ManagerDashboardPage = page(() => import('../pages/manager/ManagerDashboardPage'));
const ManagerOrdersPage = page(() => import('../pages/manager/ManagerOrdersPage'));
const ManagerEquipePage = page(() => import('../pages/manager/ManagerEquipePage'));
const ManagerStatsPage = page(() => import('../pages/manager/ManagerStatsPage'));
const ManagerLitigesPage = page(() => import('../pages/manager/ManagerLitigesPage'));
const ManagerParametresPage = page(() => import('../pages/manager/ManagerParametresPage'));
const ManagerZonePrefsPage = page(() => import('../pages/manager/ManagerZonePrefsPage'));

// —— Espace administrateur ----------------------------------------------------------------------
const AdminDashboardPage = page(() => import('../pages/admin/AdminDashboardPage'));
const AdminOrdersPage = page(() => import('../pages/admin/AdminOrdersPage'));
const AdminCatalogPage = page(() => import('../pages/admin/AdminCatalogPage'));
const AdminCategoriesPage = page(() => import('../pages/admin/AdminCategoriesPage'));
const AdminZonesPage = page(() => import('../pages/admin/AdminZonesPage'));
const AdminUsersPage = page(() => import('../pages/admin/AdminUsersPage'));
const AdminUserDetailPage = page(() => import('../pages/admin/AdminUserDetailPage'));
const AdminLivreursPage = page(() => import('../pages/admin/AdminLivreursPage'));
const AdminValidationsPage = page(() => import('../pages/admin/AdminValidationsPage'));
const AdminLogsPage = page(() => import('../pages/admin/AdminLogsPage'));
const AdminParametresPage = page(() => import('../pages/admin/AdminParametresPage'));
const AdminSystemePage = page(() => import('../pages/admin/AdminSystemePage'));
const AdminBddPage = page(() => import('../pages/admin/AdminBddPage'));
const AdminClesApiPage = page(() => import('../pages/admin/AdminClesApiPage'));
const AdminSecuritePage = page(() => import('../pages/admin/AdminSecuritePage'));

const rootRoute = createRootRoute({
  // Garde globale (authGuard.ts) : non connecté → /connexion sur toute page hors accueil et écrans
  // d'auth ; mauvais rôle → espace de son rôle. Droits calqués sur ceux du backend.
  beforeLoad: guardRoute,
  component: () => (
    <>
      <SystemBridge />
      {/* Seule frontière de suspension : elle couvre toutes les pages `lazy()` ci-dessus. */}
      <Suspense fallback={<LoadingState />}>
        <Outlet />
      </Suspense>
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
const livreurMessagerieRoute = createRoute({ getParentRoute: () => rootRoute, path: '/livreur/messagerie', component: LivreurMessagingPage });
const livreurParametresRoute = createRoute({ getParentRoute: () => rootRoute, path: '/livreur/parametres', component: LivreurSettingsPage });

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
  livreurMessagerieRoute,
  livreurParametresRoute,
]);

export const router = createRouter({
  routeTree,
  // Préchargement au survol/focus du lien : le chunk de la page est déjà là quand on clique.
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 30_000,
});

// Session perdue en cours de navigation (401 de l'API) → /connexion hors pages publiques (authGuard.ts).
redirectOnSessionExpired(router);

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
