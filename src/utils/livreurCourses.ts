import { livreurApi } from '../services/api';
import { alertApiError, apiErrorStatus } from './apiError';
import { tx } from '../i18n/tx';

/**
 * Les trois seules écritures de course de l'espace livreur, et leur confirmation.
 *
 * Le backend (`app/Http/Controllers/Api/Livreur/LivreurDeliveryController.php` + le correctif de
 * restriction de zone) est le seul arbitre : `accept` et `refuse` exigent que la commande soit déjà
 * attribuée à ce compte (`abort_unless($order->livreur_id === $request->user()->id, 403)`), et la
 * restriction de zone s'ajoute à ce garde. Ces fonctions n'ajoutent donc **aucune** règle locale :
 * elles laissent passer le message exact du serveur (`alertApiError`), ne retire rien de la liste de
 * l'écran avant la réponse, et rendent un résultat que l'appelant consomme sans `try/catch`.
 *
 * Une seule source pour le texte demandé avant d'écrire : `CONFIRMATION_REFUS` et
 * `CONFIRMATION_LIVRAISON` sont des clés du dictionnaire (`src/i18n/phrases.ts`), la référence de
 * commande étant injectée après traduction — `tx()` ne connaît que des clés complètes, et ce
 * gabarit garde à l'anglais son ordre de mots.
 */

/** Gabarit de la demande de refus (remise en file). */
export const CONFIRMATION_REFUS = 'Refuser la course {course} ? Elle sera remise en file.';

/** Gabarit de la demande de livraison confirmée. */
export const CONFIRMATION_LIVRAISON = 'Confirmer la livraison de la commande {course} ?';

/** Libellé traduit, référence injectée — l'unique endroit où ces phrases sont écrites. */
export const texteConfirmation = (gabarit: string, course: string): string =>
  tx(gabarit).replace('{course}', course);

/** Boîte de confirmation native ; `false` = l'utilisateur n'a rien signé, aucune requête ne part. */
export const demanderConfirmation = (gabarit: string, course: string): boolean => {
  const texte = texteConfirmation(gabarit, course);
  try {
    return window.confirm(texte) === true;
  } catch {
    // Aucun `window` (rendu côté serveur, tests node sans DOM) : on n'invente pas un accord.
    return false;
  }
};

/** Réponse de `PATCH …/accept`, `…/refuse` et `…/status` : un message, parfois la commande. */
export type AckCourseRow = {
  success?: boolean;
  message?: string;
  data?: { updated_at?: string | null; statut?: string | null; id?: number | string | null } | null;
  [champ: string]: unknown;
};

/**
 * Résultat d'une écriture : `ok` est vrai seulement si le serveur a répondu. En cas d'échec,
 * `message` est le texte DÉJÀ affiché par `alertApiError` (« [HTTP 422] … ») et `statut` le code
 * reçu — un écran peut ainsi annoncer la nuance sans rejouer l'alerte.
 */
export type Tentative<T> = { ok: true; data: T } | { ok: false; message: string; statut: number | null };

/** Exécution d'une écriture, erreur API mise en forme au même endroit que les autres écrans. */
export async function tenter<T>(action: () => Promise<T>, idAlerte: string): Promise<Tentative<T>> {
  try {
    return { ok: true, data: await action() };
  } catch (erreur) {
    return { ok: false, message: alertApiError(erreur, idAlerte), statut: apiErrorStatus(erreur) };
  }
}

/** `PATCH /livreur/deliveries/{id}/accept`. */
export const accepterCourse = (orderId: number): Promise<Tentative<AckCourseRow>> =>
  tenter(async (): Promise<AckCourseRow> => await livreurApi.acceptDelivery(orderId), 'livreur-accept');

/** `PATCH /livreur/deliveries/{id}/refuse` — le backend remet la course en file (`livreur_id = null`). */
export const refuserCourse = (orderId: number): Promise<Tentative<AckCourseRow>> =>
  tenter(async (): Promise<AckCourseRow> => await livreurApi.refuseDelivery(orderId), 'livreur-refuse');

/** `PATCH /livreur/deliveries/{id}/status` (`en_livraison` | `livre`), seule transition admise. */
export const changerStatutCourse = (
  orderId: number,
  statut: 'en_livraison' | 'livre',
): Promise<Tentative<AckCourseRow>> =>
  tenter(async (): Promise<AckCourseRow> => await livreurApi.updateStatus(orderId, statut), 'livreur-status');

/**
 * Retrait local d'une course refusée : appliqué SEULEMENT après l'accord du serveur, jamais en
 * optimiste — une course refusée à tort (zone, indisponibilité) doit rester visible à l'écran.
 */
export function retirerCourse<T extends { id: number }>(liste: T[] | null | undefined, orderId: number): T[] {
  return (liste ?? []).filter((item) => item.id !== orderId);
}

/** Même discipline pour un changement de statut : la liste suit la réponse, pas l'intention. */
export function appliquerStatut<T extends { id: number; statut: string }>(
  liste: T[] | null | undefined,
  orderId: number,
  statut: string,
): T[] {
  return (liste ?? []).map((item) => (item.id === orderId ? { ...item, statut } : item));
}
