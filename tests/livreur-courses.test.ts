import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Les écritures de course du livreur, et ce que l'écran doit faire d'un refus.
 *
 * Le backend est le seul arbitre : `LivreurDeliveryController::accept` et `::refuse` exigent que la
 * commande appartienne au compte (`abort_unless($order->livreur_id === $request->user()->id, 403)`),
 * et la restriction de zone (correctif `1776a3d`) s'ajoute à ce garde. Ces tests verrouillent la
 * partie front de ce contrat : le message du serveur est affiché EXACTEMENT tel quel par
 * `alertApiError`, aucun succès n'est annoncé sur un refus, et aucune course ne disparaît de la liste.
 *
 * Les deux rejets testés (422 et 403, deux formulations) prouvent que rien n'est codé en dur : le
 * front ne connaît ni le code, ni la phrase — il les relaie.
 */

vi.mock('../src/services/api', () => ({
  livreurApi: { acceptDelivery: vi.fn(), refuseDelivery: vi.fn(), updateStatus: vi.fn(), getDeliveries: vi.fn(), getHistory: vi.fn() },
  authApi: { getProfile: vi.fn() },
  catalogApi: { getZones: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import toast from 'react-hot-toast';
import { livreurApi } from '../src/services/api';
import {
  CONFIRMATION_LIVRAISON,
  CONFIRMATION_REFUS,
  accepterCourse,
  appliquerStatut,
  changerStatutCourse,
  demanderConfirmation,
  refuserCourse,
  retirerCourse,
  texteConfirmation,
} from '../src/utils/livreurCourses';

/** Rejet axios tel que l'intercepteur le transmet (`error.response.status` / `.data`). */
const rejet = (statut: number, corps: Record<string, unknown>) => ({ response: { status: statut, data: corps } });

const REFUS_ZONE = 'Le livreur n’appartient pas à cette zone.';
const REFUS_MEME_ZONE = 'Commande et livreur ne sont pas dans la même zone.';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  delete (window as { confirm?: unknown }).confirm;
});

describe('refus du backend : le message passe, rien d’autre ne bouge', () => {
  it('relaie le 422 de zone mot pour mot, avec son préfixe HTTP', async () => {
    vi.mocked(livreurApi.acceptDelivery).mockRejectedValue(rejet(422, { message: REFUS_ZONE }));

    const tentative = await accepterCourse(9);

    expect(tentative.ok).toBe(false);
    if (tentative.ok) throw new Error('un refus ne doit jamais passer pour un succès');
    expect(tentative.statut).toBe(422);
    expect(tentative.message).toBe(`[HTTP 422] ${REFUS_ZONE}`);
    // c'est bien alertApiError qui a parlé : une seule alerte, groupée sous l'identifiant de l'écran
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(`[HTTP 422] ${REFUS_ZONE}`, { id: 'livreur-accept' });
    // aucun toast de succès à côté de l'erreur
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('relaie un 403 avec une autre formulation sans rien codé en dur', async () => {
    vi.mocked(livreurApi.acceptDelivery).mockRejectedValue(rejet(403, { message: REFUS_MEME_ZONE }));

    const tentative = await accepterCourse(9);

    expect(tentative.ok).toBe(false);
    if (tentative.ok) throw new Error('un 403 n’est pas un succès');
    expect(tentative.message).toBe(`[HTTP 403] ${REFUS_MEME_ZONE}`);
  });

  it('ajoute les erreurs de champs Laravel au texte, comme partout ailleurs', async () => {
    vi.mocked(livreurApi.refuseDelivery).mockRejectedValue(
      rejet(422, { message: 'Les données fournies sont invalides.', errors: { statut: ['Transition interdite.'] } }),
    );

    const tentative = await refuserCourse(9);

    expect(tentative.ok).toBe(false);
    if (tentative.ok) throw new Error('422 de validation');
    expect(tentative.message).toBe('[HTTP 422] Les données fournies sont invalides. — statut : Transition interdite.');
  });

  it('signale un refus sans message lisible par le statut reçu, jamais par un texte inventé', async () => {
    vi.mocked(livreurApi.updateStatus).mockRejectedValue(rejet(403, {}));

    const tentative = await changerStatutCourse(9, 'livre');

    expect(tentative.ok).toBe(false);
    if (tentative.ok) throw new Error('corps de réponse vide');
    expect(tentative.message).toMatch(/^\[HTTP 403\]/);
    expect(tentative.message).not.toContain('undefined');
  });

  it('laisse la liste des courses intacte quand le serveur refuse', async () => {
    const courses = [
      { id: 9, statut: 'en_attente' },
      { id: 10, statut: 'en_attente' },
    ];
    vi.mocked(livreurApi.refuseDelivery).mockRejectedValue(rejet(422, { message: REFUS_ZONE }));

    const tentative = await refuserCourse(9);
    // l'écran n'appelle `retirerCourse` que dans la branche `ok` : ici la liste reste la sienne
    expect(tentative.ok).toBe(false);
    expect(retirerCourse(courses, 9)).toHaveLength(1);
    expect(courses).toHaveLength(2); // la fonction ne mute pas l'entrée
    expect(appliquerStatut(courses, 9, 'en_livraison')[0]?.statut).toBe('en_livraison');
    expect(courses[0]?.statut).toBe('en_attente');
  });
});

describe('succès : la réponse du serveur est le seul message affiché', () => {
  it('rend le message du backend tel quel', async () => {
    vi.mocked(livreurApi.acceptDelivery).mockResolvedValue({ message: 'Course acceptée.', data: { id: 9 } });

    const tentative = await accepterCourse(9);

    expect(tentative.ok).toBe(true);
    if (!tentative.ok) throw new Error('succès attendu');
    expect(tentative.data.message).toBe('Course acceptée.');
  });

  it('expose updated_at pour le récapitulatif quand status le renvoie', async () => {
    vi.mocked(livreurApi.updateStatus).mockResolvedValue({ data: { id: 9, updated_at: '2026-10-12T10:00:00+00:00' } });

    const tentative = await changerStatutCourse(9, 'livre');

    expect(tentative.ok).toBe(true);
    if (!tentative.ok) throw new Error('succès attendu');
    expect(tentative.data.data?.updated_at).toBe('2026-10-12T10:00:00+00:00');
  });

  it('tolère une réponse sans message (l’écran garde sa propre chaîne traduite)', async () => {
    vi.mocked(livreurApi.refuseDelivery).mockResolvedValue({});
    const tentative = await refuserCourse(9);
    expect(tentative.ok).toBe(true);
    if (!tentative.ok) throw new Error('succès attendu');
    expect(tentative.data.message ?? null).toBeNull();
  });
});

describe('confirmations : le texte vient du dictionnaire, pas du code', () => {
  it('construit la question en français avec la référence de course', () => {
    expect(texteConfirmation(CONFIRMATION_REFUS, '#TOK-9')).toBe(
      'Refuser la course #TOK-9 ? Elle sera remise en file.',
    );
    expect(texteConfirmation(CONFIRMATION_LIVRAISON, '#TOK-9')).toBe(
      'Confirmer la livraison de la commande #TOK-9 ?',
    );
  });

  it('suit la langue active — l’anglais ne garde pas le français en dur', () => {
    localStorage.setItem('tokpa_lang', 'en');
    // si l'entrée du dictionnaire saute, ces deux assertions tombent : pas de repli silencieux
    expect(texteConfirmation(CONFIRMATION_REFUS, '#TOK-9')).toBe(
      'Refuse delivery #TOK-9? It will be returned to the queue.',
    );
    expect(texteConfirmation(CONFIRMATION_LIVRAISON, '#TOK-9')).toBe(
      'Confirm the delivery of order #TOK-9?',
    );
  });

  it('pose la question traduite et n’envoie rien sans accord', async () => {
    const confirmer = vi.fn(() => true);
    (window as unknown as { confirm: typeof confirmer }).confirm = confirmer;

    expect(demanderConfirmation(CONFIRMATION_REFUS, '#TOK-9')).toBe(true);
    expect(confirmer).toHaveBeenCalledWith('Refuser la course #TOK-9 ? Elle sera remise en file.');
    expect(livreurApi.refuseDelivery).not.toHaveBeenCalled();

    (window as unknown as { confirm: () => boolean }).confirm = () => false;
    expect(demanderConfirmation(CONFIRMATION_LIVRAISON, '#TOK-9')).toBe(false);
  });

  it('refuse de supposer un accord quand il n’y a pas de fenêtre', () => {
    // aucun `window.confirm` (SSR, test sans DOM) : on n'invente pas un « oui » du livreur
    expect(demanderConfirmation(CONFIRMATION_REFUS, '#TOK-9')).toBe(false);
    expect(livreurApi.acceptDelivery).not.toHaveBeenCalled();
  });
});
