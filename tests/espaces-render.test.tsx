import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';

import { store } from '../src/store';

/**
 * Amorçage rendu des autres espaces (client, manager, administrateur).
 *
 * L'espace livreur a ses propres tests d'écran ; les trois autres espaces n'en avaient aucun. Ces cas
 * ne valident pas la métier (il est dans les modules de données) mais une propriété qui casse en
 * production silencieusement : chaque page doit SE rendre sans effet ni donnée, dans l'environnement
 * node des tests — graphe d'imports, contexts, hooks de store, état de chargement.
 *
 * Aucun effet ne s'exécute sous `renderToStaticMarkup` : ce qu'on observe est exactement l'écran vu
 * avant la première réponse de l'API, donc les libellés d'attente et l'absence de donnée inventée.
 */
// `vi.mock` est hoisté au-dessus des déclarations : la fabrique de bouchons doit être autonome.
vi.mock('../src/services/api', () => {
  const groupe = () =>
    new Proxy(
      {},
      { get: (cible, nom) => (cible as Record<string, unknown>)[nom as string] ??= async () => ({ data: null }) },
    );
  return Object.fromEntries(
    ['adminApi', 'authApi', 'cartApi', 'catalogApi', 'chatApi', 'landmarksApi', 'livreurApi', 'managerApi',
     'negotiationApi', 'notificationsApi', 'ordersApi', 'paymentsApi'].map((nom) => [nom, groupe()]),
  );
});

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('leaflet', () => ({ default: { icon: (options: unknown) => options } }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  Polygon: () => null,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: () => null,
  useMap: () => ({ panTo: () => undefined }),
}));
vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'fr', setLanguage: vi.fn(), toggleLanguage: vi.fn(), t: (c: string) => c, isFr: true, isEn: false }),
  LanguageProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useParams: () => ({ productId: '7' }),
  useRouterState: (opts?: { select?: (s: unknown) => unknown }) =>
    opts?.select?.({ location: { search: {}, pathname: '/' } }) ?? { location: { search: {} } },
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import HomePage from '../src/pages/client/accueil/HomePage';
import CatalogPage from '../src/pages/client/catalogue/CatalogPage';
import CartPage from '../src/pages/client/panier/CartPage';
import ProductPage from '../src/pages/client/fiche-produit/ProductPage';
import NotificationsPage from '../src/pages/client/notifications/NotificationsPage';
import ManagerDashboardPage from '../src/pages/manager/ManagerDashboardPage';
import ManagerLitigesPage from '../src/pages/manager/ManagerLitigesPage';
import ManagerOrdersPage from '../src/pages/manager/ManagerOrdersPage';
import AdminDashboardPage from '../src/pages/admin/AdminDashboardPage';
import AdminUsersPage from '../src/pages/admin/AdminUsersPage';
import AdminSystemePage from '../src/pages/admin/AdminSystemePage';
import AdminCatalogPage from '../src/pages/admin/AdminCatalogPage';
import AdminCategoriesPage from '../src/pages/admin/AdminCategoriesPage';
import AdminZonesPage from '../src/pages/admin/AdminZonesPage';
import AdminOrdersPage from '../src/pages/admin/AdminOrdersPage';
import AdminParametresPage from '../src/pages/admin/AdminParametresPage';
import AdminClesApiPage from '../src/pages/admin/AdminClesApiPage';

/**
 * Rend et échoue si React a émis un avertissement de props : les écrans « aperçu maquette » portent du
 * markup converti du HTML (attributs en kebab-case, cases à cocher figées) qui rendait correctement
 * mais produisait du bruit en console.
 */
function rendu(Page: () => ReactNode) {
  const erreurs: string[] = [];
  const espion = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    erreurs.push(args.map(String).join(' '));
  });
  try {
    const html = renderToStaticMarkup(
      <Provider store={store}>
        <Page />
      </Provider>,
    );
    const bruyantes = erreurs.filter((m) =>
      /Invalid DOM property|You provided a|unknown prop|non-boolean attribute|React does not recognize/i.test(m),
    );
    expect(bruyantes).toEqual([]);
    return html;
  } finally {
    espion.mockRestore();
  }
}

describe('espace client : amorçage', () => {
  it('rend l’accueil avec son chrome, sans donnée fabriquée', () => {
    const html = rendu(HomePage);
    expect(html).toContain('TOKPa');
    expect(html).toContain('max-w-[1200px]');
    expect(html).not.toMatch(/simul/i);
  });

  it('rend le catalogue : la navbar est là, les produits viennent de l’API', () => {
    const html = rendu(CatalogPage);
    expect(html).toContain('common.searchPlaceholder');
    // aucun produit ne peut être listé avant GET /products
    expect(html).not.toContain('card card-product');
  });

  it('rend le panier vide plutôt qu’un panier peuplé de faux articles', () => {
    const html = rendu(CartPage);
    expect(html).toContain('Panier');
  });

  it('affiche l’attente tant que la fiche produit n’a pas été chargée', () => {
    const html = rendu(ProductPage);
    expect(html).toContain('animate-spin');
    expect(html.length).toBeLessThan(400);
  });

  it('verrouille les notifications tant que la session n’est pas résolue', () => {
    const html = rendu(NotificationsPage);
    expect(html).toContain('animate-spin');
    expect(html).not.toContain('Marquer tout');
  });
});

describe('espace manager : amorçage', () => {
  it('rend le tableau de bord manager', () => {
    const html = rendu(ManagerDashboardPage);
    expect(html).toContain('Manager');
  });

  it('rend la file des litiges', () => {
    const html = rendu(ManagerLitigesPage);
    expect(html).toContain('Litiges');
  });

  it('rend la liste des commandes', () => {
    const html = rendu(ManagerOrdersPage);
    expect(html).toContain('Commandes');
  });
});

describe('espace administrateur : amorçage', () => {
  it('rend le tableau de bord global', () => {
    const html = rendu(AdminDashboardPage);
    expect(html).toContain('TOKPa');
  });

  it('rend la gestion des utilisateurs', () => {
    const html = rendu(AdminUsersPage);
    expect(html).toContain('Utilisateurs');
  });

  it.each([
    ['catalogue', () => AdminCatalogPage],
    ['catégories', () => AdminCategoriesPage],
    ['zones', () => AdminZonesPage],
    ['commandes', () => AdminOrdersPage],
    ['paramètres', () => AdminParametresPage],
  ])('rend l’écran %s sur un état explicite, jamais une ligne inventée', (_nom, Page) => {
    const html = rendu(Page());
    expect(html).toContain('TOKPa');
    // Les tableaux se remplissent depuis GET /admin/* : avant la réponse, l’écran doit le dire
    // (chargement, vide assumé, ou étiquette « aperçu maquette » pour ce qui n’a pas d’API).
    expect(html).toMatch(/Chargement|Aucun|aperçu maquette|indisponible/i);
  });

  it('marque explicitement les écrans sans endpoint backend', () => {
    const systeme = rendu(AdminSystemePage);
    expect(systeme).toContain('aperçu maquette');
    const cles = rendu(AdminClesApiPage);
    expect(cles).toContain('aperçu maquette');
  });
});
