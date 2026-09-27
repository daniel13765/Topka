import { redirect, type AnyRouter } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import { tr, tx } from '../i18n/tx';

/**
 * Garde de connexion (décision du 24/09) : sans session, toute page redirige vers /connexion,
 * SAUF l'accueil et les écrans d'authentification (sinon boucle de redirection).
 * Session = token Sanctum dans le localStorage ; sa validité réelle est vérifiée par l'API
 * (401 → services/api/client.ts émet `tokpa:session-expired`).
 */
export const PUBLIC_PATHS: readonly string[] = [
  '/',
  '/connexion',
  '/inscription',
  '/verification-2fa',
  '/reset-password',
  '/profil',
];

const AUTH_TOAST_ID = 'auth-required';
const ROLE_TOAST_ID = 'role-denied';
/** Page demandée avant la connexion, conservée pour l'onglet pendant la 2FA (et un détour par l'inscription). */
const REDIRECT_KEY = 'tokpa_redirect';

/** Rôles du backend (App\Models\Role). */
export type AppRole = 'super_admin' | 'admin' | 'manager' | 'livreur' | 'client';

const normPath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';
const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** Chemin public ? (tolère un « / » final : /connexion/ = /connexion). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(normPath(pathname));
}

/** Une session est-elle ouverte côté front ? */
export function hasSession(): boolean {
  return !!localStorage.getItem('tokpa_token');
}

type StoredUser = {
  nom_complet?: string;
  prenom?: string;
  nom?: string;
  role?: string | { nom?: string } | null;
  profil?: { zone?: { nom?: string } | null } | null;
};
function storedUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('tokpa_user');
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

/** Rôle de l'utilisateur connecté (tokpa_user.role = chaîne ou objet { nom } selon la réponse 2FA). */
export function currentRole(): string | null {
  const u = storedUser();
  const role = typeof u?.role === 'string' ? u.role : u?.role?.nom;
  return role || null;
}

/** Nom affichable de l'utilisateur connecté (barres admin / manager / livreur), sinon null. */
export function currentUserName(): string | null {
  const u = storedUser();
  const nom = u?.nom_complet || [u?.prenom, u?.nom].filter(Boolean).join(' ');
  return nom || null;
}

/** Zone du manager / livreur connecté (UserResource.profil.zone, chargée à la 2FA), sinon null. */
export function currentUserZone(): string | null {
  return storedUser()?.profil?.zone?.nom || null;
}

/** Initiales d'un nom (« Awa Dossou » → « AD »). */
export function initialsOf(nom: string | null, fallback = '?'): string {
  const parts = (nom ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') : fallback;
}

/** Espace de travail d'un rôle (lien « Mon espace … » de la barre client), null pour un client. */
export function staffSpace(role: string | null): { to: '/admin' | '/manager' | '/livreur'; icon: string; label: string } | null {
  if (role === 'admin' || role === 'super_admin') return { to: '/admin', icon: 'admin_panel_settings', label: 'Mon espace admin' };
  if (role === 'manager') return { to: '/manager', icon: 'supervisor_account', label: 'Mon espace manager' };
  if (role === 'livreur') return { to: '/livreur', icon: 'two_wheeler', label: 'Mon espace livreur' };
  return null;
}

/** Espace de chaque rôle : arrivée après connexion (sans page demandée) et renvoi si accès refusé. */
export function homeForRole(role: string | null): '/admin' | '/manager' | '/livreur' | '/' {
  if (role === 'admin' || role === 'super_admin') return '/admin';
  if (role === 'manager') return '/manager';
  if (role === 'livreur') return '/livreur';
  return '/'; // client, rôle inconnu
}

/**
 * Rôles autorisés pour une page — décision du 26/09 :
 *  - admin, manager et livreur vérifient le rôle uniquement dans leur espace ;
 *  - l'espace clientèle ne vérifie pas le rôle : chacun y voit ses propres achats ;
 *  - /profil est public : sans session, une icône de connexion s'y affiche.
 * null = pas de contrôle de rôle (clientèle, ou page inconnue).
 */
export function pageRoles(pathname: string): { roles: AppRole[]; label: string } | null {
  const p = normPath(pathname);
  if (under(p, '/admin')) return { roles: ['admin', 'super_admin'], label: 'aux administrateurs' };
  if (under(p, '/manager')) return { roles: ['manager'], label: 'aux managers' };
  if (under(p, '/livreur')) return { roles: ['livreur'], label: 'aux livreurs' };
  return null;
}

/** Ce rôle peut-il ouvrir cette page ? (pages publiques : toujours) */
export function canAccess(pathname: string, role: string | null): boolean {
  if (isPublicPath(pathname)) return true;
  const rule = pageRoles(pathname);
  return !rule || (role !== null && (rule.roles as string[]).includes(role));
}

/**
 * Adresse de retour sûre : chemin interne uniquement (pas de « //site », « https:… », « /\… » qui
 * mèneraient hors de TOKPa), et jamais un écran d'authentification (boucle). Sinon null.
 */
export function safeRedirect(target: unknown): string | null {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return null;
  }
  const pathname = target.split(/[?#]/)[0];
  if (isPublicPath(pathname) && normPath(pathname) !== '/') return null;
  return target;
}

/** Mémorise (ou oublie) la page demandée ; appelé à l'arrivée sur /connexion avec son ?redirect=. */
export function rememberRedirect(target: unknown): void {
  const safe = safeRedirect(target);
  if (safe) sessionStorage.setItem(REDIRECT_KEY, safe);
  else sessionStorage.removeItem(REDIRECT_KEY);
}

/** Destination après la 2FA : la page demandée si ce rôle y a droit, sinon l'espace de son rôle. */
export function postLoginTarget(role: string | null): string {
  const saved = safeRedirect(sessionStorage.getItem(REDIRECT_KEY));
  sessionStorage.removeItem(REDIRECT_KEY);
  // Une ouverture directe de /connexion ne constitue pas une destination de retour.
  // Après la 2FA, on doit toujours rejoindre l’espace du rôle, jamais rester sur /connexion.
  if (saved && normPath(saved.split(/[?#]/)[0]) !== '/connexion' && canAccess(saved.split(/[?#]/)[0], role)) return saved;
  return homeForRole(role);
}

/**
 * beforeLoad de la route racine : exécuté avant tout rendu, donc la page refusée n'est jamais
 * affichée et ses appels API ne partent pas. Toute nouvelle route est protégée par défaut.
 *  1. pas de session → /connexion?redirect=<page demandée> (retour automatique après la 2FA) ;
 *  2. mauvais rôle → espace de son rôle (« Accès refusé »).
 */
export function guardRoute({
  location,
  preload,
}: {
  location: { pathname: string; href: string };
  preload: boolean;
}): void {
  if (isPublicPath(location.pathname)) return;
  if (!hasSession()) {
    if (!preload) toast.error(tx('Veuillez vous connecter pour accéder à cette page.'), { id: AUTH_TOAST_ID });
    const requestedLocation = new URL(location.href, window.location.origin);
    const requestedUrl = `${requestedLocation.pathname}${requestedLocation.search}${requestedLocation.hash}`;
    throw redirect({ to: '/connexion', search: { redirect: requestedUrl }, replace: true });
  }
  const role = currentRole();
  const rule = pageRoles(location.pathname);
  if (rule && !(role !== null && (rule.roles as string[]).includes(role))) {
    if (!preload) toast.error(tr(`Accès refusé : cette page est réservée ${rule.label}.`, `Access denied: this page is reserved ${tx(rule.label)}.`), { id: ROLE_TOAST_ID });
    throw redirect({ to: homeForRole(role), replace: true });
  }
}

/**
 * Session perdue en cours de navigation (401 : token expiré au bout de 24 h, révoqué, ou base
 * réinitialisée) → retour à la connexion, sauf si l'on est sur une page publique.
 */
export function redirectOnSessionExpired(router: AnyRouter): () => void {
  const onExpired = () => {
    if (isPublicPath(router.state.location.pathname)) return;
    toast.error(tx('Session expirée : veuillez vous reconnecter.'), { id: AUTH_TOAST_ID });
    // retour à la même page après la reconnexion
    const current = router.state.location;
    const requestedUrl = `${current.pathname}${current.searchStr ?? ''}${current.hash ?? ''}`;
    void router.navigate({ to: '/connexion', search: { redirect: requestedUrl }, replace: true });
  };
  window.addEventListener('tokpa:session-expired', onExpired);
  return () => window.removeEventListener('tokpa:session-expired', onExpired);
}
