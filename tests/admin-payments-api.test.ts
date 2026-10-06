import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { adminApi } from '../src/services/api/admin';
import { paymentsApi } from '../src/services/api/payments';
import { apiClient } from '../src/services/api/client';
import { listOf, unwrap } from '../src/services/api/unwrap';

/**
 * Contrat « paiements » du backend du 2 octobre 2026.
 *
 * `PaymentController::listAllPayments` et `listClientPayments` répondent
 * `response()->json(['success' => true, 'data' => $payments])` : le modèle Eloquent brut, sans
 * `PaymentResource`, sans pagination et sans lecture d'un quelconque paramètre. `promoteManager`
 * (`POST /admin/users/{user}/managers`) valide `zone_id` obligatoire, `heure_debut`/`heure_fin`
 * optionnelles au format `H:i`, et refuse tout rôle autre que client ou administrateur (400).
 *
 * Ces tests verrouillent la façon dont le front parle à ces trois routes : ni paramètre inventé,
 * ni horaire vide envoyé, ni enveloppe doublement déballée.
 */
vi.mock('../src/services/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('adminApi — lecture des paiements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('demande GET /admin/payments sans paramètre (la route n en lit aucun)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [] } });
    await adminApi.getPayments();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/admin/payments');
    const args = vi.mocked(apiClient.get).mock.calls[0] as unknown[];
    expect(args[1], 'aucun objet { params } ne doit être transmis').toBeUndefined();
  });

  it('demande GET /admin/clients/payments pour le jumeau côté clients', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [] } });
    await adminApi.getClientsPayments();
    expect(apiClient.get).toHaveBeenCalledWith('/admin/clients/payments');
  });

  it('déshabille l enveloppe { success, data } sans double lecture', () => {
    const reponse = { data: { success: true, data: [{ id: 7, statut: 'reussi' }] } };
    expect(listOf(unwrap(reponse))).toEqual([{ id: 7, statut: 'reussi' }]);
  });

  it('tolère une réponse vide sans inventer de ligne', () => {
    expect(listOf(unwrap({ data: { success: true, data: null } }))).toEqual([]);
    expect(listOf(unwrap({ data: { success: true } }))).toEqual([]);
  });
});

describe('paymentsApi — espace client', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /payments renvoie la liste brute (aucune pagination côté serveur)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [{ id: 3 }] } });
    const brut = await paymentsApi.listMine();
    expect(apiClient.get).toHaveBeenCalledWith('/payments');
    expect(listOf(unwrap(brut))).toEqual([{ id: 3 }]);
  });
});

describe('adminApi.promoteAsManager — POST /admin/users/{id}/managers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envoie la zone obligatoire', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
    await adminApi.promoteAsManager(12, { zone_id: 3 });
    expect(apiClient.post).toHaveBeenCalledWith('/admin/users/12/managers', { zone_id: 3 });
  });

  it('n envoie les horaires que s ils sont remplis (le front ne fabrique pas 08:00-18:00)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
    await adminApi.promoteAsManager(12, { zone_id: 3, heure_debut: '09:30' });
    expect(vi.mocked(apiClient.post).mock.calls[0]?.[1]).toEqual({ zone_id: 3, heure_debut: '09:30' });

    await adminApi.promoteAsManager(12, { zone_id: 3, heure_debut: '09:30', heure_fin: '17:45' });
    expect(vi.mocked(apiClient.post).mock.calls[1]?.[1]).toEqual({
      zone_id: 3,
      heure_debut: '09:30',
      heure_fin: '17:45',
    });
  });

});

describe('types de ligne réellement consommés', () => {
  const source = readFileSync(join(process.cwd(), 'src/types/adminRows.ts'), 'utf8');

  it('PaymentRow n annonce pas fedapay_token : le front ne le lit nulle part', () => {
    const debut = source.indexOf('export type PaymentRow = {');
    const bloc = source.slice(debut, debut + 900);
    expect(bloc.length, 'le type PaymentRow doit exister dans adminRows.ts').toBeGreaterThan(0);
    expect(bloc).toContain('fedapay_ref');
    expect(bloc).toContain('recu_url');
    // Le nom du champ n'apparaît que dans le commentaire d'avertissement, jamais en clé du type.
    const cles = [...bloc.matchAll(/^\s{2}([a-z_]+)\??:/gm)].map((m) => m[1] as string);
    expect(cles).toContain('montant');
    expect(cles).not.toContain('fedapay_token');
  });
});
