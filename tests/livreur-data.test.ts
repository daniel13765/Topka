import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/api', () => ({
  livreurApi: { getDeliveries: vi.fn(), getHistory: vi.fn() },
  catalogApi: { getZones: vi.fn() },
  authApi: { getProfile: vi.fn() },
}));

import { authApi, catalogApi, livreurApi } from '../src/services/api';
import {
  articlesCount,
  destination,
  fetchAllHistory,
  fetchDeliveries,
  fetchLivreurProfile,
  fetchZoneNames,
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
