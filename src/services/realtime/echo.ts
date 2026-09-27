import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
  interface Window {
    Echo?: Echo<'pusher'>;
    Pusher?: typeof Pusher;
  }
}

/**
 * Client temps réel TOKPa — Laravel Echo (Reverb, protocole Pusher).
 *
 * Le backend (Laravel 11) expose :
 *  - Broadcast::routes(['middleware' => ['auth:sanctum']])
 *    → POST {API_ORIGIN}/broadcasting/auth (Bearer token Sanctum)
 *  - Canaux privés :
 *      tracking.{orderId}        (propriétaire | livreur | admin)
 *      chat.{conversationId}     (participants | admin)
 *      notifications.{userId}    (l'utilisateur)
 *      manager.{zoneId}          (admin | manager de la zone)
 *  - Événements :
 *      order.status.changed     {order_id, statut, previous}
 *      livreur.position.updated {order_id, livreur_id, latitude, longitude, horodatage}
 *      message.sent             {id, conversation_id, sender_id, contenu, created_at}
 *      delivery.assigned        (modèle Commande)
 *      budget.responded         (modèle BudgetPropose)
 *      payment.confirmed        (modèle Payment)
 *
 * `window.Echo` est exposé pour rétrocompatibilité avec les hooks existants.
 */

const env = import.meta.env as Record<string, string | undefined>;

/** Origine de l'API sans le préfixe /api (ex. http://localhost:8000). */
export function getApiOrigin(): string {
  const base = env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  return base.replace(/\/api\/?$/, '');
}

export interface ReverbConfig {
  host: string;
  port: number;
  wssPort: number;
  scheme: 'ws' | 'wss';
  key: string;
  appId: string;
}

export function getReverbConfig(): ReverbConfig {
  return {
    host: env.VITE_REVERB_HOST || 'localhost',
    port: Number(env.VITE_REVERB_PORT || 8080),
    wssPort: Number(env.VITE_REVERB_WSS_PORT || 443),
    scheme: (env.VITE_REVERB_SCHEME as 'ws' | 'wss') || 'ws',
    key: env.VITE_REVERB_KEY || 'tokpa-key',
    appId: env.VITE_REVERB_APP_ID || 'tokpa',
  };
}

let boundToken: string | null = null;

/**
 * Démarre (ou renouvelle) la connexion Reverb avec le token Sanctum courant.
 * Sans token → déconnecte et retourne null.
 */
export function initEcho(): Echo<'pusher'> | null {
  let token = localStorage.getItem('tokpa_token');
  // Token démo legacy (avant l'alignement API) : plus valide, on le purge proprement.
  if (token === 'demo_token_sanctum_123') {
    localStorage.removeItem('tokpa_token');
    localStorage.removeItem('tokpa_user');
    token = null;
  }
  if (!token) {
    shutdownEcho();
    return null;
  }
  if (window.Echo && boundToken === token) {
    return window.Echo;
  }

  shutdownEcho();

  try {
    const { host, port, wssPort, scheme, key } = getReverbConfig();
    (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

    // IMPORTANT (pusher-js 8.x) :
    //  - `cluster` est OBLIGATOIRE dans les options (sinon throw « Options object
    //    must provide a cluster ») — Reverb l'ignore quand host/port sont donnés.
    //    (Le broadcaster « reverb » de laravel-echo 2.x l'injecte automatiquement ;
    //    on le passe explicitement pour garder le typage Echo<'pusher'>.)
    //  - pusher-js lit `host`/`port` (PAS `wsHost`/`wsPort`) pour cibler le serveur.
    window.Echo = new Echo({
      broadcaster: 'pusher',
      key,
      cluster: '',
      host,
      port,
      wsHost: host,
      wsPort: port,
      wssPort,
      forceTLS: scheme === 'wss',
      enabledTransports: scheme === 'wss' ? ['wss'] : ['ws'],
      authEndpoint: `${getApiOrigin()}/broadcasting/auth`,
      auth: {
        headers: { Authorization: `Bearer ${token}` },
      },
    } as ConstructorParameters<typeof Echo<'pusher'>>[0]);
    boundToken = token;
    return window.Echo;
  } catch (err) {
    // Le temps réel est un confort : un échec ne doit JAMAIS bloquer le rendu de l'app.
    console.warn('TOKPa Reverb: initialisation impossible — mode dégradé (sans WebSocket).', err);
    shutdownEcho();
    return null;
  }
}

/** Coupe la connexion Reverb (déconnexion / perte de token). */
export function shutdownEcho(): void {
  if (window.Echo) {
    try {
      window.Echo.disconnect();
    } catch {
      /* noop */
    }
    window.Echo = undefined;
  }
  boundToken = null;
}

/** Renvoie l'instance Echo courante (sans la créer). */
export function windowEcho(): Echo<'pusher'> | null {
  return window.Echo ?? null;
}

/** Écoute un événement nommé sur un canal privé (helper typé). */
export function listenPrivate(channel: string, event: string, callback: (payload: unknown) => void) {
  const echo = window.Echo;
  if (!echo) return { stop: () => undefined };
  const privateChannel = echo.private(channel);
  privateChannel.listen(event, (data: unknown) => callback(data));
  return {
    stop: () => {
      privateChannel.stopListening(event);
    },
  };
}
