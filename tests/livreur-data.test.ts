import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/api', () => ({
  livreurApi: { getDeliveries: vi.fn(), getHistory: vi.fn() },
  catalogApi: { getZones: vi.fn() },
  authApi: { getProfile: vi.fn() },
}));

import { authApi, catalogApi, livreurApi } from '../src/services/api';
import { lignesRecu } from '../src/pages/livreur/historique-livraisons/recuCourse';
import {
  articlesCount,
  comparaisonSemaines,
  debutSemaine,
  revenusParJour,
  sommeFrais,
  etaMinutes,
  fetchLandmarkGeo,
  forgetLandmarkGeo,
  fetchDeliveredOrder,
  fmtDuree,
  dureeMinutes,
  fmtKm,
  haversineKm,
  URBAN_SPEED_KMH,
  destination,
  fetchAllHistory,
  fetchDeliveries,
  fetchLivreurProfile,
  fetchZoneNames,
  normaliserDocuments,
  forgetLivreurProfile,
  statutLabel,
  tokRef,
  unwrapOrder,
} from '../src/pages/livreur/livreurData';

describe('livreur display helpers', () => {
  it('unwraps an order resource and builds a reference', () => {
    expect(unwrapOrder({ data: { id: 4, statut: 'livre' } }).id).toBe(4);
    expect(tokRef(4)).toBe('#TOK-4');
    expect(statutLabel('livre')).toBe('Livré');
    expect(statutLabel('inconnu')).toBe('inconnu');
  });

  it('joins the landmark and the client note', () => {
    expect(destination({ id: 1, montant_total: 0, frais_livraison: 0, statut: 'en_attente', landmark: { nom: 'Stade' }, description_lieu: 'portail bleu' })).toBe('Stade — portail bleu');
    expect(destination({ id: 1, montant_total: 0, frais_livraison: 0, statut: 'en_attente' })).toBe('Destination non renseignée');
    expect(articlesCount({ id: 1, montant_total: 0, frais_livraison: 0, statut: 'en_attente', items: [{ id: 1, product_id: 1, quantite: 2, prix_unitaire: 1 }, { id: 2, product_id: 2, quantite: 3, prix_unitaire: 1 }] })).toBe(5);
  });
});

describe('livreur API readers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forgetLivreurProfile();
  });

  it('unwraps the delivery list', async () => {
    vi.mocked(livreurApi.getDeliveries).mockResolvedValue({ data: [{ data: { id: 2, statut: 'en_livraison' } }] });
    await expect(fetchDeliveries()).resolves.toEqual([expect.objectContaining({ id: 2 })]);
  });

  it('stops history at the last page and flags a cap', async () => {
    vi.mocked(livreurApi.getHistory)
      .mockResolvedValueOnce({ data: [{ id: 1 }], meta: { last_page: 2, total: 3 } })
      .mockResolvedValueOnce({ data: [{ id: 2 }], meta: { last_page: 2, total: 3 } });
    await expect(fetchAllHistory()).resolves.toMatchObject({ total: 3, capped: false });

    vi.mocked(livreurApi.getHistory).mockResolvedValue({ data: [{ id: 1 }], meta: { last_page: 9, total: 40 } });
    await expect(fetchAllHistory(1)).resolves.toMatchObject({ capped: true, total: 40 });
  });

  it('maps zone ids and caches the rider profile', async () => {
    vi.mocked(catalogApi.getZones).mockResolvedValue({ data: [{ id: 3, nom: 'Akpakpa' }] });
    await expect(fetchZoneNames()).resolves.toEqual(new Map([[3, 'Akpakpa']]));

    vi.mocked(authApi.getProfile).mockResolvedValue({
      data: { success: true, data: { id: 8, nom: 'Kouassi', profil: { disponibilite: 1, zone: { nom: 'Akpakpa' } } } },
    });
    const first = await fetchLivreurProfile();
    const second = await fetchLivreurProfile();
    expect(first).toMatchObject({ id: 8, disponible: true, zone: 'Akpakpa' });
    expect(second).toBe(first);
    expect(authApi.getProfile).toHaveBeenCalledTimes(1);
  });
});
describe('course active : distance et ETA réelles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forgetLandmarkGeo();
  });

  it('mesure la distance à vol d’oiseau entre deux points réels de Cotonou', () => {
    const km = haversineKm([6.3725, 2.4332], [6.362, 2.41]); // Marché Dantokpa → Cadjehoun
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(4);
  });

  it('estime l’arrivée uniquement à partir d’une distance connue', () => {
    expect(etaMinutes(3.4)).toBe(Math.round((3.4 / URBAN_SPEED_KMH) * 60));
    expect(etaMinutes(0.2)).toBe(1); // jamais 0 min
    expect(etaMinutes(0)).toBeNull();
    expect(etaMinutes(null)).toBeNull();
  });

  it('affiche les kilomètres à la française et un tiret quand la donnée manque', () => {
    expect(fmtKm(3.4)).toMatch(/3[.,]4 km/);
    expect(fmtKm(null)).toBe('—');
  });

  it('résout les coordonnées du repère via GET /zones, en ignorant les repères non géolocalisés', async () => {
    vi.mocked(catalogApi.getZones).mockResolvedValue({
      data: [
        {
          id: 3,
          nom: 'Cadjehoun',
          points_repere: [
            { id: 12, nom: 'Pharmacie Sainte-Marie', latitude: '6.3620', longitude: '2.4100' },
            { id: 13, nom: 'Sans coordonnées', latitude: null, longitude: null },
          ],
        },
      ],
    } as never);

    const first = await fetchLandmarkGeo();
    expect(first.size).toBe(1); // (0,0) aurait créé un marqueur dans le golfe de Guinée
    expect(first.get(12)).toEqual({ nom: 'Pharmacie Sainte-Marie', lat: 6.362, lng: 2.41, zone: 'Cadjehoun' });

    expect(await fetchLandmarkGeo()).toBe(first); // cache : un seul appel réseau
    expect(catalogApi.getZones).toHaveBeenCalledTimes(1);
  });
});
describe('récapitulatif de fin de course', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcule la durée réelle entre création et livraison', () => {
    expect(dureeMinutes('2026-09-28T14:30:00+00:00', '2026-09-28T14:48:00+00:00')).toBe(18);
    expect(dureeMinutes('2026-09-28T14:30:00+00:00', null)).toBeNull();
    expect(dureeMinutes('2026-09-28T14:48:00+00:00', '2026-09-28T14:30:00+00:00')).toBeNull(); // horodatage incohérent
    expect(fmtDuree(18)).toBe('18 min');
    expect(fmtDuree(null)).toBe('—');
  });

  it('relit la commande livrée dans l’historique sans pager au-delà du nécessaire', async () => {
    vi.mocked(livreurApi.getHistory)
      .mockResolvedValueOnce({ data: [{ id: 9 }, { id: 7 }], meta: { last_page: 3, total: 60 } })
      .mockResolvedValueOnce({ data: [{ id: 5 }], meta: { last_page: 3, total: 60 } });
    await expect(fetchDeliveredOrder(5)).resolves.toMatchObject({ id: 5 });
    expect(livreurApi.getHistory).toHaveBeenCalledTimes(2);
  });

  it('s’arrête à la dernière page et renvoie null quand la commande est absente', async () => {
    vi.mocked(livreurApi.getHistory).mockResolvedValue({ data: [{ id: 3 }], meta: { last_page: 1, total: 1 } });
    await expect(fetchDeliveredOrder(999)).resolves.toBeNull();
    expect(livreurApi.getHistory).toHaveBeenCalledTimes(1);
  });
});
/** Course livrée minimale, dates en heure locale (sans Z) pour éviter tout décalage de fuseau. */
function course(id: number, jour: Date, frais: number) {
  const iso = `${jour.getFullYear()}-${String(jour.getMonth() + 1).padStart(2, '0')}-${String(jour.getDate()).padStart(2, '0')}T10:00:00`;
  return { id, montant_total: frais * 2, frais_livraison: frais, statut: 'livre', created_at: iso } as never;
}

describe('historique : cumuls et comparatifs réels', () => {
  const ref = new Date(2026, 8, 30, 15, 0, 0); // mercredi
  const lundi = debutSemaine(ref);
  const jour = (offset: number) => {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + offset);
    return d;
  };

  it('ancre la semaine sur un lundi à minuit', () => {
    expect(lundi.getDay()).toBe(1);
    expect(lundi.getHours()).toBe(0);
    expect(lundi.getMinutes()).toBe(0);
  });

  it('additionne uniquement les frais réellement présents', () => {
    expect(sommeFrais([course(1, jour(0), 1200), course(2, jour(2), 800), { id: 3, montant_total: 0, frais_livraison: NaN as never, statut: 'livre' } as never])).toBe(2000);
  });

  it('répartit les frais du lundi au dimanche et exclut la semaine précédente', () => {
    const jours = revenusParJour([course(1, jour(0), 1200), course(2, jour(2), 800), course(3, jour(-7), 500)], ref);
    expect(jours).toHaveLength(7);
    expect(jours[0].total).toBe(1200);
    expect(jours[2].total).toBe(800);
    expect(jours[6].total).toBe(0);
    expect(jours.reduce((s, j) => s + j.total, 0)).toBe(2000); // les 500 de la semaine -1 ne comptent pas
  });

  it('compare les semaines et refuse tout pourcentage sans base', () => {
    // jour(-3) = vendredi de la semaine précédente : 2 courses cette semaine, 1 avant
    const r = comparaisonSemaines([course(1, jour(0), 100), course(2, jour(2), 100), course(3, jour(-3), 100)], ref);
    expect(r).toEqual({ cetteSemaine: 2, semainePrecedente: 1, deltaPct: 100 });

    // aucune base la semaine passée : pas de pourcentage affirmé
    expect(comparaisonSemaines([course(1, jour(0), 100)], ref)).toEqual({ cetteSemaine: 1, semainePrecedente: 0, deltaPct: null });

    const r2 = comparaisonSemaines([course(1, jour(0), 100), course(2, jour(-7), 100)], ref);
    expect(r2).toEqual({ cetteSemaine: 1, semainePrecedente: 1, deltaPct: 0 });

    const r3 = comparaisonSemaines([course(1, jour(0), 100), course(2, jour(1), 100), course(3, jour(-7), 100)], ref);
    expect(r3.deltaPct).toBe(100);
  });

  it('compose un reçu sans ligne client inventée', () => {
    const lignes = lignesRecu(course(12, jour(0), 1500) as never, { zone: 'Cadjehoun', livreur: 'Jean' });
    expect(lignes.find((l) => l.label === 'Frais de livraison')?.value).toMatch(/^1\s500 FCFA$/);
    expect(lignes.find((l) => l.label === 'Zone')?.value).toBe('Cadjehoun');
    expect(lignes.some((l) => /client|t[ée]l[ée]phone/i.test(l.label))).toBe(false);
  });
});

describe('profil du livreur : champs réellement persistés', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forgetLivreurProfile();
  });

  it('normalise les trois formes de `documents` sans inventer de clé', () => {
    expect(normaliserDocuments(['Permis de conduire'])).toEqual([{ libelle: 'Permis de conduire' }]);
    expect(
      normaliserDocuments([
        { nom: 'Assurance professionnelle Course', numero: 'NSIA-2291', statut: 'valide' },
        { type: 'CNI', url: 'https://x/y.pdf', status: 'en_attente' },
        { libelle: '' },
        null,
        3,
      ]),
    ).toEqual([
      { libelle: 'Assurance professionnelle Course', valeur: 'NSIA-2291', statut: 'valide' },
      { libelle: 'CNI', valeur: 'https://x/y.pdf', statut: 'en_attente' },
    ]);
    expect(normaliserDocuments(undefined)).toEqual([]);
    expect(normaliserDocuments({ nom: 'Pas un tableau' })).toEqual([]);
  });

  it('expose image_profil, statut et id_vehicule, et vide ce que le back ne renvoie pas', async () => {
    vi.mocked(authApi.getProfile).mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 12,
          nom_complet: 'Jean Kouassi',
          telephone: '97001234',
          image_profil: '  https://cdn/x.png  ',
          statut: 'actif',
          profil: { disponibilite: 0, id_vehicule: 3, documents: ['Permis B'] },
        },
      },
    });
    expect(await fetchLivreurProfile()).toMatchObject({
      id: 12,
      image_profil: 'https://cdn/x.png',
      disponible: false,
      statut: 'actif',
      vehiculeId: 3,
      zone: null,
      documents: [{ libelle: 'Permis B' }],
    });

    forgetLivreurProfile();
    vi.mocked(authApi.getProfile).mockResolvedValue({ data: { data: { id: 12, image_profil: '   ' } } });
    const nu = await fetchLivreurProfile();
    expect(nu.image_profil).toBeNull();
    expect(nu.statut).toBeNull();
    expect(nu.vehiculeId).toBeNull();
    expect(nu.disponible).toBeNull();
    expect(nu.documents).toEqual([]);
  });
});
