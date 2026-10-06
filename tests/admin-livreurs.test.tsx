import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { store } from '../src/store';
import { adminApi } from '../src/services/api/admin';
import { apiClient } from '../src/services/api/client';
import {
  FILTRE_NEUTRE,
  commandesAssignables,
  decrirePosition,
  disponibleDe,
  estUrl,
  filtrerLivreurs,
  kpiLivreurs,
  lienCarte,
  piecesDe,
  positionDe,
  vehiculeDe,
  zoneIdDe,
} from '../src/utils/adminLivreurs';

/**
 * Administration des livreurs : ce que le backend du 2 octobre 2026 permet vraiment.
 *
 * La ligne d'un livreur vient de `GET /admin/users?role=livreur` (`scopeWhereRole` +
 * `with(['role','manager.zone','livreur.zone'])`, paginé 20) : le profil `livreurs` arrive en modèle
 * brut sous `profil`, avec `disponibilite`, `position_lat/lng`, `documents` (json) et `id_vehicule`.
 * L'assignation passe par `POST /admin/assign` (le même `ManagerAssignmentController` que le manager).
 *
 * Les règles ci-dessous sont les fonctions appelées par l'écran : ce qui est testé ici est ce qui
 * s'affiche, pas une réécriture.
 */
vi.mock('../src/services/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../src/services/api', () => {
  const groupe = () =>
    new Proxy({}, { get: (cible, nom) => (cible as Record<string, unknown>)[nom as string] ??= async () => ({ data: null }) });
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
    opts?.select?.({ location: { search: {}, pathname: '/admin/livreurs' } }) ?? { location: { search: {} } },
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

const livreur = (surcharges: Record<string, unknown> = {}) => ({
  id: 11,
  nom_complet: 'Livreur Test',
  statut: 'actif',
  telephone: '+229 97 00 00 00',
  profil: {
    zone_id: 3,
    disponibilite: true,
    position_lat: '6.3659100',
    position_lng: '2.7102000',
    documents: [{ libelle: 'Permis de conduire', valeur: 'AB-1234', statut: 'validé' }],
    id_vehicule: 7,
  },
  ...surcharges,
});

describe('contrat POST /admin/assign', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envoie order_id et livreur_id (les seules clés validées par AssignLivreurRequest)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 9 } } });
    await adminApi.assignLivreur(9, 4);
    expect(apiClient.post).toHaveBeenCalledWith('/admin/assign', { order_id: 9, livreur_id: 4 });
  });
});

describe('lecture du profil livreur', () => {
  it('distingue indisponible de « non renvoyé »', () => {
    expect(disponibleDe(livreur())).toBe(true);
    expect(disponibleDe(livreur({ profil: { ...livreur().profil, disponibilite: false } }))).toBe(false);
    expect(disponibleDe(livreur({ profil: null }))).toBeNull();
    expect(disponibleDe(undefined)).toBeNull();
  });

  it('ne fabrique pas une zone quand la relation est absente', () => {
    expect(zoneIdDe(livreur())).toBe(3);
    expect(zoneIdDe(livreur({ profil: {} }))).toBeNull();
    expect(zoneIdDe(livreur({ profil: { zone_id: null } }))).toBeNull();
  });

  it('lit des coordonnées décimales envoyées en chaîne, et rejette ce qui est hors bornes', () => {
    expect(positionDe(livreur())).toEqual({ lat: 6.36591, lng: 2.7102 });
    expect(positionDe(livreur({ profil: { position_lat: 200, position_lng: 2 } }))).toBeNull();
    expect(positionDe(livreur({ profil: { position_lat: null, position_lng: null } }))).toBeNull();
    // un capteur non initialisé envoie 0,0 : ce n'est pas une position
    expect(positionDe(livreur({ profil: { position_lat: 0, position_lng: 0 } }))).toBeNull();
  });

  it('donne un lien de carte et une précision d affichage stables', () => {
    const pos = positionDe(livreur())!;
    expect(lienCarte(pos)).toBe('https://www.openstreetmap.org/?mlat=6.36591&mlon=2.7102#map=16/6.36591/2.7102');
    expect(decrirePosition(pos)).toBe('6.36591, 2.71020');
  });

  it('sépare documents jamais écrits (null) et dossier vide ([]) ', () => {
    expect(piecesDe(livreur({ profil: { documents: null } }))).toEqual({ connues: false, pieces: [] });
    expect(piecesDe(livreur({ profil: { documents: [] } }))).toEqual({ connues: true, pieces: [] });
    expect(piecesDe(livreur())).toMatchObject({ connues: true, pieces: [{ libelle: 'Permis de conduire' }] });
  });

  it('tolère les tableaux écrits à la main (chaînes) et écarte les lignes vides', () => {
    const r = livreur({ profil: { documents: ['https://x.io/cni.pdf', '   ', { valeur: 'sans libellé' }, { libelle: ' ', valeur: 'x' }] } });
    expect(piecesDe(r)).toEqual({ connues: true, pieces: [{ libelle: 'https://x.io/cni.pdf' }] });
  });

  it('accepte aussi url que valeur comme référence de pièce', () => {
    const r = livreur({ profil: { documents: [{ libelle: 'Carte grise', url: 'https://x.io/grise.pdf' }] } });
    expect(piecesDe(r).pieces[0]).toEqual({ libelle: 'Carte grise', valeur: 'https://x.io/grise.pdf' });
    expect(estUrl(piecesDe(r).pieces[0]?.valeur)).toBe(true);
    expect(estUrl('AB-1234')).toBe(false);
  });

  it('ne devine aucun nom de véhicule : seul l identifiant existe', () => {
    expect(vehiculeDe(livreur())).toEqual({ id: '7' });
    expect(vehiculeDe(livreur({ profil: { id_vehicule: null } }))).toEqual({ id: null });
    expect(vehiculeDe(livreur({ profil: {} }))).toEqual({ id: null });
  });
});

describe('liste, filtres et totaux de l écran', () => {
  const rang = [
    livreur({ id: 1, nom_complet: 'Awa Traore' }),
    livreur({ id: 2, nom_complet: 'Bi Idriss', profil: { ...livreur().profil, disponibilite: false, documents: [], id_vehicule: null } }),
    livreur({ id: 3, nom_complet: 'Cyriaque Adjovi', telephone: null, email: 'cyriaque@tokpa.bj', profil: { zone_id: 5, disponibilite: true, documents: null } }),
  ];
  const enCourseUn = (id: number) => id === 1;

  it('le filtrage est local et cumule recherche, zone, état et pièces', () => {
    expect(filtrerLivreurs(rang, FILTRE_NEUTRE, () => false).map((l) => l.id)).toEqual([1, 2, 3]);
    expect(filtrerLivreurs(rang, { ...FILTRE_NEUTRE, recherche: 'awa' }, () => false).map((l) => l.id)).toEqual([1]);
    expect(filtrerLivreurs(rang, { ...FILTRE_NEUTRE, recherche: 'cyriaque@tokpa' }, () => false).map((l) => l.id)).toEqual([3]);
    expect(filtrerLivreurs(rang, { ...FILTRE_NEUTRE, recherche: '9700' }, () => false).map((l) => l.id)).toEqual([1, 2, 3].filter((i) => i !== 3));
    expect(filtrerLivreurs(rang, { ...FILTRE_NEUTRE, zone: '5' }, () => false).map((l) => l.id)).toEqual([3]);
    expect(filtrerLivreurs(rang, { ...FILTRE_NEUTRE, etat: 'en_ligne' }, () => false).map((l) => l.id)).toEqual([1, 3]);
    // « en ligne » exclut celui qui est déjà en course : sinon la même ligne apparaît deux fois
    expect(filtrerLivreurs(rang, { ...FILTRE_NEUTRE, etat: 'en_ligne' }, enCourseUn).map((l) => l.id)).toEqual([3]);
    expect(filtrerLivreurs(rang, { ...FILTRE_NEUTRE, etat: 'en_course' }, enCourseUn).map((l) => l.id)).toEqual([1]);
    expect(filtrerLivreurs(rang, { ...FILTRE_NEUTRE, pieces: 'avec' }, () => false).map((l) => l.id)).toEqual([1]);
    expect(filtrerLivreurs(rang, { ...FILTRE_NEUTRE, pieces: 'sans' }, () => false).map((l) => l.id)).toEqual([2, 3]);
  });

  it('compte ce qui a été reçu, sans inventer d agrégat', () => {
    const kpi = kpiLivreurs(rang, enCourseUn);
    expect(kpi).toEqual({ total: 3, enLigne: 2, enCourseNombre: 1, avecPieces: 1, sansPosition: 1 });
  });

  it('ne propose qu une commande en attente sans livreur', () => {
    const commandes = [
      { id: 1, statut: 'en_attente', livreur: null },
      { id: 2, statut: 'en_attente', livreur: { id: 4 } },
      { id: 3, statut: 'en_preparation', livreur: null },
      { id: 4, statut: 'en_attente' },
      { id: 5, statut: 'livre', livreur: null },
    ];
    expect(commandesAssignables(commandes).map((o) => o.id)).toEqual([1, 4]);
  });
});

describe('écran : plus aucune donnée de maquette', () => {
  const page = readFileSync(join(process.cwd(), 'src/pages/admin/AdminLivreursPage.tsx'), 'utf8');

  it('le véhicule inventé de la maquette a disparu', () => {
    expect(page).not.toMatch(/Bajaj|Pulsar|\b[A-Z]{2}-\d{4}\b/);
    expect(page).toContain('vehiculeDe(selected)');
  });

  it('l action d assignation est branchée sur l API, pas vide', () => {
    expect(page).toContain('adminApi.assignLivreur(');
    expect(page).not.toMatch(/<button[^>]*>\s*\{tx\("Assigner"\)\}\s*<\/button>/);
  });

  it('les données affichées viennent des colonnes réelles', () => {
    for (const champ of ['positionDe', 'piecesDe', 'disponibleDe', 'zoneIdDe']) {
      expect(page, champ).toContain(`${champ}(`);
    }
  });
});

describe('rendu', () => {
  it('l écran se rend en attente, sans chiffre ni identité fabriqués', async () => {
    const { default: AdminLivreursPage } = await import('../src/pages/admin/AdminLivreursPage');
    const html = renderToStaticMarkup(
      <Provider store={store}>
        <AdminLivreursPage />
      </Provider>,
    );
    expect(html).toContain('Chargement des données réelles…');
    expect(html).not.toMatch(/Bajaj|Pulsar|\b[A-Z]{2}-\d{4}\b/);
    // tant que GET /admin/users n'a pas répondu, aucun KPI ne doit ressembler à un résultat
    expect(html).not.toMatch(/Livreurs reçus[\s\S]{0,160}?\b[1-9]\d*\b/);
  });
});
