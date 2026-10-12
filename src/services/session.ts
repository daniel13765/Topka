/**
 * Source unique de la session TOKPa côté front.
 *
 * Une session, ici, c'est exactement deux choses : le jeton Sanctum et l'utilisateur renvoyé par
 * `POST /auth/verify-2fa` (un `UserResource`, parfois sous son enveloppe `data`). Les deux vivent
 * dans `localStorage`, parce que Sanctum n'utilise pas de cookie de session dans ce projet.
 *
 * Ce module est le **seul** à lire et à écrire ces trois clés. Les écrans, les gardes de routes,
 * l'intercepteur axios, Reverb et le bridge système passent par lui : une seule source, donc un
 * seul endroit où le format est toléré (`role` en chaîne OU en objet, utilisateur nu OU sous
 * `data`, JSON illisible). Partout ailleurs, `null` veut dire « absent ou illisible » — jamais une
 * valeur de repli inventée, jamais une exception qui viderait l'écran.
 */

export const CLE_JETON = 'tokpa_token';
export const CLE_UTILISATEUR = 'tokpa_user';
export const CLE_COURRIEL_EN_ATTENTE = 'tokpa_pending_email';

/** Jeton d'une ancienne démo, jamais valide : purgeé à la lecture (voir `jalon()`). */
const JALON_PERIME = 'demo_token_sanctum_123';

/** Utilisateur tel qu'il est stocké après la 2FA (`UserResource`, nu ou sous `data`). */
export type UtilisateurSession = {
  id?: number | string | null;
  nom?: string | null;
  prenom?: string | null;
  nom_complet?: string | null;
  email?: string | null;
  telephone?: string | null;
  statut?: string | null;
  image_profil?: string | null;
  /** `RoleResource` chargée → objet ; sinon la chaîne du rôle (`Utilisateur::nomRole()`). */
  role?: string | { id?: number | string | null; nom?: string | null } | null;
  /** Modèle brut du rôle métier (`livreurs`, `managers`, `clients`) selon les chargements. */
  profil?: { zone?: { id?: number | string | null; nom?: string | null } | null; [champ: string]: unknown } | null;
  [champ: string]: unknown;
};

const magasin = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // localStorage inaccessible (navigation privée stricte, SSR, quota) : la session est absente.
    return null;
  }
};

const lire = (cle: string): string | null => {
  try {
    return magasin()?.getItem(cle) ?? null;
  } catch {
    return null;
  }
};

const ecrire = (cle: string, valeur: string): void => {
  try {
    magasin()?.setItem(cle, valeur);
  } catch {
    /* quota ou accès refusé : la session en mémoire reste utilisable jusqu'au rechargement */
  }
};

const supprimer = (cle: string): void => {
  try {
    magasin()?.removeItem(cle);
  } catch {
    /* rien à purger si le magasin est inaccessible */
  }
};

/** Jeton Sanctum, ou null si aucune session exploitable n'est ouverte. */
export function jalon(): string | null {
  const brut = lire(CLE_JETON);
  if (!brut) return null;
  if (brut === JALON_PERIME) {
    effacerSession();
    return null;
  }
  return brut;
}

/** Une session est-elle ouverte côté front ? (sa validité réelle reste vérifiée par l'API : 401) */
export function aUneSession(): boolean {
  return jalon() !== null;
}

/** L'utilisateur stocké ; null si absent, vide ou illisible. */
export function utilisateur(): UtilisateurSession | null {
  const brut = lire(CLE_UTILISATEUR);
  if (!brut) return null;
  try {
    const analyse = JSON.parse(brut) as UtilisateurSession | null;
    // un tableau sous `tokpa_user` n'est pas un utilisateur : rien à afficher, rien à deviner
    return analyse && typeof analyse === 'object' && !Array.isArray(analyse) ? analyse : null;
  } catch {
    return null;
  }
}

/**
 * Identifiant de l'utilisateur connecté — entier uniquement. `GET /conversations` et le canal
 * `notifications.{id}` le comparent au `sender_id` du backend : un identifiant partiel serait pire
 * qu'un identifiant absent.
 */
export function identifiant(): number | null {
  const brut = utilisateur()?.id;
  const n = typeof brut === 'number' ? brut : Number(brut);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Nom affichable dans les barres d'espace de travail, null si la session ne le porte pas. */
export function nomComplet(): string | null {
  const u = utilisateur();
  const nom = u?.nom_complet || [u?.prenom, u?.nom].filter(Boolean).join(' ');
  return nom.trim() || null;
}

/** Rôle (`livreur`, `manager`, `admin`, `super_admin`, `client`) sous sa forme chaîne ou objet. */
export function role(): string | null {
  const roleUtilisateur = utilisateur()?.role;
  const brut = typeof roleUtilisateur === 'string' ? roleUtilisateur : roleUtilisateur?.nom;
  return typeof brut === 'string' && brut.trim() ? brut.trim() : null;
}

/** Zone du manager ou du livreur connecté (`UserResource.profil.zone.nom`), null sinon. */
export function zone(): string | null {
  const nom = utilisateur()?.profil?.zone?.nom;
  return typeof nom === 'string' && nom.trim() ? nom.trim() : null;
}

/** Adresse e-mail de la session (écran de second facteur, journaux de diagnostic). */
export function courriel(): string | null {
  const brut = utilisateur()?.email;
  return typeof brut === 'string' && brut.trim() ? brut.trim() : null;
}

/** Ouverture de session : le jeton et l'utilisateur sont écrits ensemble, jamais l'un sans l'autre. */
export function enregistrerSession(token: string, valeur: unknown): void {
  if (!token) {
    effacerSession();
    return;
  }
  ecrire(CLE_JETON, token);
  // `POST /auth/verify-2fa` rend le UserResource nu ou sous `data` : on stocke l'objet lui-même,
  // seule forme dont `role()` puisse déduire l'espace de destination après la 2FA.
  const nu = (valeur as { data?: unknown } | null)?.data ?? valeur;
  ecrire(CLE_UTILISATEUR, JSON.stringify(nu && typeof nu === 'object' ? nu : {}));
}

/** Rafraîchissement après un `PUT /profile` : les champs reçus écrasent les anciens, les autres survivent. */
export function rafraichirUtilisateur(partiel: unknown): void {
  if (!partiel || typeof partiel !== 'object') return;
  const courant = utilisateur() ?? {};
  ecrire(CLE_UTILISATEUR, JSON.stringify({ ...courant, ...(partiel as UtilisateurSession) }));
}

/**
 * Fermeture de session : le jeton et l'utilisateur partent ensemble, jamais l'un sans l'autre.
 *
 * L'adresse en attente de second facteur est volontairement laissée de côté : un 401 croisé pendant
 * `/verification-2fa` ne doit pas la faire disparaître avant la fin du parcours. C'est
 * `oublierCourrielEnAttente()` (déconnexion, vérification réussie) qui la purge.
 */
export function effacerSession(): void {
  supprimer(CLE_JETON);
  supprimer(CLE_UTILISATEUR);
}

/** Adresse attendant un code de second facteur (`/verification-2fa` la relit, une seule fois). */
export function courrielEnAttente(): string | null {
  const brut = lire(CLE_COURRIEL_EN_ATTENTE);
  return brut && brut.trim() ? brut.trim() : null;
}

export function memoriserCourrielEnAttente(adresse: unknown): void {
  if (typeof adresse !== 'string' || !adresse.trim()) return;
  if (courrielEnAttente()) return; // un code déjà demandé ne doit pas être réamorcé par un 423 tardif
  ecrire(CLE_COURRIEL_EN_ATTENTE, adresse.trim());
}

export function oublierCourrielEnAttente(): void {
  supprimer(CLE_COURRIEL_EN_ATTENTE);
}
