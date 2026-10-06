import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';

import { store } from '../src/store';
import { pageRoles } from '../src/routes/authGuard';
import AdminPaiementsPage from '../src/pages/admin/AdminPaiementsPage';
import { estPurge, montantDe, sansJeton, totauxDe } from '../src/utils/adminPaiements';
import { EN } from '../src/i18n/phrases';
import type { PaymentRow } from '../src/types/adminRows';

/**
 * Écran « Paiements » de l'administration, branché sur GET /admin/payments (backend du 02/10/2026).
 *
 * Trois choses sont verrouillées ici :
 * 1. l'écran se rend dans l'environnement node des tests, et n'affiche aucun montant avant réponse ;
 * 2. le `fedapay_token` que le contrôleur renvoie (modèle brut, aucune `PaymentResource`) ne sort
 *    jamais du code — ni en donnée rendue, ni dans la fiche détail JSON ;
 * 3. les calculs de l'écran (totaux, filtrage local, corps de la promotion en manager) sont exacts
 *    sur les formes que Laravel renvoie réellement : `montant` en chaîne `decimal:2`, statuts enum.
 */
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
vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'fr', setLanguage: vi.fn(), toggleLanguage: vi.fn(), t: (c: string) => c, isFr: true, isEn: false }),
  LanguageProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useParams: () => ({}),
  useRouterState: (opts?: { select?: (s: unknown) => unknown }) =>
    opts?.select?.({ location: { search: {}, pathname: '/admin/paiements' } }) ?? { location: { search: {} } },
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import { corpsPromotion } from '../src/utils/adminPromotion';

const JETON = 'tokpa_sandbox_secret_9f3a1c';

const ligne = (surcharges: Partial<PaymentRow> = {}): PaymentRow =>
  ({
    id: 41,
    order_id: 12,
    client_id: 7,
    montant: '1500.00',
    methode: 'fedapay',
    statut: 'reussi',
    fedapay_ref: 'ref-41',
    recu_url: 'https://checkout.fedapay.com/receipts/41',
    paid_at: '2026-10-02T09:12:00.000000Z',
    created_at: '2026-10-02T09:10:00.000000Z',
    fedapay_token: JETON,
    ...surcharges,
  }) as PaymentRow;

const rendu = (Page: () => ReactNode) => {
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
    expect(erreurs.filter((m) => /Invalid DOM property|unknown prop|non-boolean attribute/i.test(m))).toEqual([]);
    return html;
  } finally {
    espion.mockRestore();
  }
};

describe('écran Paiements : rendu sans donnée fabriquée', () => {
  it('annonce la source réelle et ne montre aucun montant avant la réponse', () => {
    const html = rendu(AdminPaiementsPage);
    expect(html).toContain('Paiements');
    expect(html).toContain('GET /admin/payments');
    expect(html).toContain('Chargement des paiements réels…');
    expect(html).toContain('animate-spin');
    // aucun solde, aucun total, aucun nom inventé pendant le chargement
    expect(html).not.toContain('FCFA');
    expect(html).not.toContain(JETON);
    expect(html).not.toMatch(/Koffi|Aïcha|Fatou/);
  });

  it('ne rend jamais la valeur du jeton FedaPay', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/admin/AdminPaiementsPage.tsx'), 'utf8');
    // aucune interpolation JSX du champ, sous quelque forme que ce soit
    expect(page).not.toMatch(/\{[^{}]*[\w.]*\.fedapay_token/);
    // la fiche détail passe obligatoirement par la copie expurgée
    expect(page).toMatch(/JSON\.stringify\(\s*sansJeton\(selected\)/);
    // et l'expurgation remplace bien la valeur par un marqueur
    const module = readFileSync(join(process.cwd(), 'src/utils/adminPaiements.ts'), 'utf8');
    expect(module).toMatch(/fedapay_token:\s*`«\$\{tx\(/);
  });
});

describe('expurgation du jeton avant affichage', () => {
  it('remplace la valeur par un marqueur et conserve le reste de la ligne', () => {
    const pur = sansJeton(ligne());
    expect(JSON.stringify(pur)).not.toContain(JETON);
    expect(pur.fedapay_token).not.toBe(JETON);
    expect(pur.id).toBe(41);
    expect(pur.montant).toBe('1500.00');
    expect(pur.recu_url).toBe('https://checkout.fedapay.com/receipts/41');
  });

  it('distingue le champ absent du champ masqué', () => {
    expect(estPurge(null)).toBe('aucun');
    expect(estPurge('')).toBe('aucun');
    expect(estPurge(JETON)).toBe('masqué par le front');
  });
});

describe('calculs de l écran sur les formes renvoyées par Laravel', () => {
  it('lit un montant decimal:2 envoyé en chaîne', () => {
    expect(montantDe(ligne({ montant: '1500.00' }))).toBe(1500);
    expect(montantDe(ligne({ montant: 2750.5 }))).toBe(2750.5);
    expect(montantDe(ligne({ montant: null as unknown as string }))).toBe(0);
    expect(montantDe(ligne({ montant: '—' }))).toBe(0);
  });

  it('somme les réussis, isole les en attente, compte les échecs', () => {
    const totaux = totauxDe([
      ligne({ id: 1, statut: 'reussi', montant: '1000.00' }),
      ligne({ id: 2, statut: 'reussi', montant: '2500.50' }),
      ligne({ id: 3, statut: 'en_attente', montant: '300.00' }),
      ligne({ id: 4, statut: 'echoue', montant: '900.00' }),
      ligne({ id: 5, statut: 'rembourse', montant: '400.00' }),
    ]);
    expect(totaux.encaisse).toBe(3500.5);
    expect(totaux.enAttenteMontant).toBe(300);
    expect(totaux.echoues).toBe(1);
  });

  it('ne dévore pas un statut inconnu (la colonne est un enum, mais le modèle est brut)', () => {
    const totaux = totauxDe([ligne({ statut: 'litige' as PaymentRow['statut'], montant: '500.00' })]);
    expect(totaux).toEqual({ encaisse: 0, enAttenteMontant: 0, echoues: 0 });
  });
});

describe('promotion en manager : payload réellement envoyé', () => {
  it('envoie la zone seule quand aucun horaire n a été choisi', () => {
    expect(corpsPromotion('3', '', '')).toEqual({ zone_id: 3 });
  });

  it('ajoute les horaires remplies, jamais de 08:00-18:00 inventé', () => {
    expect(corpsPromotion('3', '09:30', '')).toEqual({ zone_id: 3, heure_debut: '09:30' });
    expect(corpsPromotion('3', '09:30', '17:45')).toEqual({ zone_id: 3, heure_debut: '09:30', heure_fin: '17:45' });
  });

  it('convertit la zone en nombre (la route valide exists:zones,id)', () => {
    expect(corpsPromotion('12', '', '').zone_id).toBe(12);
  });

  it('l écran envoie ce corps-là, pas un objet fabriqué ailleurs', () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/admin/AdminUsersPage.tsx'), 'utf8');
    expect(page).toContain('corpsPromotion(promoZone, promoDebut, promoFin)');
    expect(page).toContain('adminApi.promoteAsManager(Number(u.id), corps)');
    expect(page).toContain("if (!promoZone)");
  });
});

describe('branchement de l écran', () => {
  const router = readFileSync(join(process.cwd(), 'src/routes/router.tsx'), 'utf8');
  const sidebar = readFileSync(join(process.cwd(), 'src/components/layout/admin/AdminSidebar.tsx'), 'utf8');

  it('la route /admin/paiements est déclarée dans le routeur', () => {
    expect(router).toMatch(/AdminPaiementsPage/);
    expect(router).toMatch(/\/admin\/paiements/);
    expect(router).toContain('adminPaiementsPageRoute');
  });

  it('le menu admin pointe vers cette route', () => {
    expect(sidebar).toContain('/admin/paiements');
    expect(sidebar).toMatch(/Paiements/);
  });

  it('le garde d accès couvre le nouvel écran sans modification (règle /admin)', () => {
    const regle = pageRoles('/admin/paiements');
    expect(regle).not.toBeNull();
    expect(regle?.roles).toEqual(expect.arrayContaining(['admin']));
    expect(regle?.roles).not.toContain('livreur');
    expect(regle?.roles).not.toContain('client');
  });

  it('les libellés français sont traduits en anglais', () => {
    for (const cle of ['Encaissé (réussi)', 'jamais payé', 'masqué par le front', 'Promouvoir manager de zone', 'Filtrage local : la route ignore tout paramètre']) {
      expect(EN[cle], `clé i18n manquante : ${cle}`).toBeTruthy();
    }
  });
});
