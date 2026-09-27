import toast from 'react-hot-toast';
import { tr } from '../i18n/tx';

/**
 * Extraction & mise en forme des erreurs API Laravel pour l'UX.
 *
 * Objectif (phase dev) : afficher à l'écran le STATUT HTTP + le message EXACT
 * renvoyé par le backend, pour identifier immédiatement ce qui cloche :
 *  - [HTTP 419] CSRF (session expirée / stateful domains)
 *  - [HTTP 422] validation (« email déjà utilisé », etc.)
 *  - [HTTP 500] plantage serveur (mailer, SQL, Redis…)
 *  - [Réseau] backend injojoignable (serveur arrêté, CORS…)
 */

export interface ApiErrorInfo {
  /** Statut HTTP, ou null si la requête n'est jamais arrivée au serveur. */
  status: number | null;
  /** Message principal (celui du backend quand il existe). */
  message: string;
  /** Erreurs de validation Laravel (422) : { champ: [messages] }. */
  fieldErrors: Record<string, string[]>;
}

/** Extrait le statut / message / erreurs de champs d'une erreur axios (ou équivalent). */
export function extractApiError(err: unknown): ApiErrorInfo {
  const e = err as {
    response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } };
    message?: string;
  };

  if (e?.response) {
    const status = e.response.status ?? 0;
    const data = e.response.data ?? {};
    const fieldErrors = data.errors && typeof data.errors === 'object' ? data.errors : {};
    let message = (data.message || '').trim() || tr(`Erreur HTTP ${status}`, `HTTP error ${status}`);
    if (status === 419) {
      message += tr(
        ' — Session expirée (CSRF). Rechargez la page et réessayez.',
        ' — Session expired (CSRF). Reload the page and try again.',
      );
    }
    return { status, message, fieldErrors };
  }

  return {
    status: null,
    message: (e?.message || '').trim() || tr('Erreur réseau inconnue', 'Unknown network error'),
    fieldErrors: {},
  };
}

/** Formatte pour affichage UX : « [HTTP 500] … — champ : … ». */
export function formatApiError(info: ApiErrorInfo): string {
  const prefix = info.status != null ? `[HTTP ${info.status}]` : tr('[Réseau]', '[Network]');
  let text = `${prefix} ${info.message}`;
  if (info.status === null) {
    text += tr(
    ' — Backend injoignable (serveur arrêté ? CORS ? vérifiez localhost:8000).',
    ' — Backend unreachable (server stopped? CORS? check localhost:8000).',
  );
  }
  const fields = Object.entries(info.fieldErrors).map(([field, msgs]) => {
    const list = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
    return `${field} : ${list}`;
  });
  if (fields.length > 0) {
    text += ` — ${fields.join(' • ')}`;
  }
  return text;
}

/** Statut HTTP d'une erreur axios (null si la requête n'a jamais atteint le serveur). */
export function apiErrorStatus(err: unknown): number | null {
  return extractApiError(err).status;
}

/**
 * Échec d'un chargement (règle : jamais de données factices) → alerte avec le statut + le message
 * EXACT de l'API, et renvoie ce même texte pour l'afficher aussi dans la page (ApiErrorState).
 * 401 : pas d'alerte ici — la session expirée est gérée globalement (services/api/client.ts →
 * /connexion), et le visiteur non connecté de l'accueil a son propre affichage.
 * `toastId` évite d'empiler la même alerte (relectures, plusieurs appels en échec).
 */
export function alertApiError(err: unknown, toastId?: string): string {
  const info = extractApiError(err);
  const text = formatApiError(info);
  if (info.status !== 401) toast.error(text, toastId ? { id: toastId } : undefined);
  return text;
}
