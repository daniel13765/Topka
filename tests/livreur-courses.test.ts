import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Les écritures de course du livreur, et ce que l'écran doit faire d'un refus.
 *
 * Le backend est le seul arbitre : `LivreurDeliveryController::accept` et `::refuse` exigent que la
 * commande appartienne au compte (`abort_unless($order->livreur_id === $request->user()->id, 403)`),
 * et le middleware `zone` (`middleware(['role:livreur', 'zone'])`, routes/api.php:120) borne la zone.
 * Ces tests verrouillent la partie front de ce contrat : le message du serveur est affiché EXACTEMENT
 * tel quel par `alertApiError`, aucun succès n'est annoncé sur un refus, aucune course ne disparaît
 * de la liste.
 *
 * Les trois rejets testés viennent de libellés réellement servis par le backend (voir les constantes
 * ci-dessous) avec des codes différents : le front ne connaît ni le code, ni la phrase, il les
 * relaie — donc une reformulation côté serveur ne casse rien ici et ne demande aucun correctif front.
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

// Les trois phrases ci-dessous sont recopiées du backend (copie locale du 2 octobre), pas inventées.
// `1776a3d` lui-même est illisible depuis ce sandbox : si le correctif a reformulé, c'est le test de
// feature PHP qui le dira — le mécanisme testé ici, lui, ne change pas.

/** `app/Http/Middleware/ZoneRestriction.php` : zone du repère de la commande != zone du compte. */
const REFUS_ZONE = "Cette ressource n'appartient pas à votre zone.";

/** `app/Http/Middleware/ZoneRestriction.php` : le compte n'a aucune zone assignée. */
const REFUS_SANS_ZONE = 'Aucune zone assignée.';

/** `ManagerAssignmentController.php:25` : la variante renvoyée à l'attribution, côté manager. */
const REFUS_MEME_ZONE = 'Commande et livreur ne sont pas dans la même zone.';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  delete (window as { confirm?: unknown }).confirm;
});

describe('refus du backend : le message passe, rien d’autre ne bouge', () => {
  it('relaie le 403 du middleware de zone mot pour mot, avec son préfixe HTTP', async () => {
    vi.mocked(livreurApi.acceptDelivery).mockRejectedValue(rejet(403, { message: REFUS_ZONE }));

    const tentative = await accepterCourse(9);

    expect(tentative.ok).toBe(false);
    if (tentative.ok) throw new Error('un refus ne doit jamais passer pour un succès');
    expect(tentative.statut).toBe(403);
    expect(tentative.message).toBe(`[HTTP 403] ${REFUS_ZONE}`);
    // c'est bien alertApiError qui a parlé : une seule alerte, groupée sous l'identifiant de l'écran
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(`[HTTP 403] ${REFUS_ZONE}`, { id: 'livreur-accept' });
    // aucun toast de succès à côté de l'erreur
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('relaie la meme alerte sur un refus de mise en file (refuse, pas accept)', async () => {
    vi.mocked(livreurApi.refuseDelivery).mockRejectedValue(rejet(403, { message: REFUS_ZONE }));

    const tentative = await refuserCourse(9);

    expect(tentative.ok).toBe(false);
    if (tentative.ok) throw new Error('refus de refuser');
    expect(toast.error).toHaveBeenCalledWith(`[HTTP 403] ${REFUS_ZONE}`, { id: 'livreur-refuse' });
  });

  it('relaie un livreur sans zone assignee (403, autre phrase du meme middleware)', async () => {
    vi.mocked(livreurApi.acceptDelivery).mockRejectedValue(rejet(403, { message: REFUS_SANS_ZONE }));

    const tentative = await accepterCourse(9);

    expect(tentative.ok).toBe(false);
    if (tentative.ok) throw new Error('aucune zone = refus');
    expect(tentative.message).toBe(`[HTTP 403] ${REFUS_SANS_ZONE}`);
  });

  it('relaie une autre formulation et un autre code sans rien coder en dur', async () => {
    vi.mocked(livreurApi.acceptDelivery).mockRejectedValue(rejet(422, { message: REFUS_MEME_ZONE }));

    const tentative = await accepterCourse(9);

    expect(tentative.ok).toBe(false);
    if (tentative.ok) throw new Error('un 422 n’est pas un succès');
    expect(tentative.message).toBe(`[HTTP 422] ${REFUS_MEME_ZONE}`);
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
