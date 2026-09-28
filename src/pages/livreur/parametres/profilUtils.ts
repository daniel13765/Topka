/**
 * Règles de la page Paramètres du livreur, isolées du rendu.
 *
 * Elles sont testées dans `tests/livreur-settings-rules.test.ts` : la page ne fait qu'appeler ces
 * fonctions, donc ce qui est vérifié ici est bien ce qui tourne à l'écran.
 */

/**
 * Champs que `PUT /profile` accepte réellement côté livreur (ProfileController::update).
 * L'index signature vient de la signature d'`authApi.updateProfile`
 * (`Partial<UserProfile> & Record<string, unknown>`) : le client laisse passer des clés
 * supplémentaires, mais la page n'en envoie jamais en dehors de cette liste.
 */
export interface CorpsProfil {
  [cle: string]: unknown;
  prenom: string;
  nom: string;
  nom_complet: string;
  telephone: string;
  image_profil?: string;
}

/** Un numéro beninois saisi avec ou sans indicatif : on exige au moins 8 chiffres. */
export function telephoneValide(telephone: string): boolean {
  const chiffres = telephone.replace(/\D/g, '');
  return chiffres.length >= 8 && chiffres.length <= 20;
}

/**
 * `users.image_profil` est une colonne string (max 500) et aucune route de téléversement n'existe :
 * le champ n'accepte donc qu'une URL absolue, et la vide avec une chaîne vide.
 */
export function urlPhotoValide(valeur: string): boolean {
  const v = valeur.trim();
  return v === '' || /^(https?:)?\/\//i.test(v);
}

/**
 * Construit le corps de la requête : on n'envoie `image_profil` que si la photo a changé, pour ne
 * pas effacer l'URL stockée quand le champ auxiliaire est resté ouvert sans modification.
 */
export function construireCorpsProfil(input: {
  prenom: string;
  nom: string;
  telephone: string;
  imageProfil: string;
  imageProfilServeur: string | null;
}): CorpsProfil {
  const prenom = input.prenom.trim();
  const nom = input.nom.trim();
  const corps: CorpsProfil = {
    prenom,
    nom,
    nom_complet: [prenom, nom].filter(Boolean).join(' '),
    telephone: input.telephone.trim(),
  };
  const photo = input.imageProfil.trim();
  if (photo !== (input.imageProfilServeur ?? '')) corps.image_profil = photo;
  return corps;
}

/** Règles de `PasswordChangeRequest` : 8 caractères minimum + confirmation identique. */
export function erreurMotDePasse(input: { actuel: string; nouveau: string; confirmation: string }): string | null {
  if (input.actuel === '') return 'Mot de passe actuel requis.';
  if (input.nouveau.length < 8) return 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
  if (input.nouveau === input.actuel) return 'Le nouveau mot de passe doit différer de l’ancien.';
  if (input.nouveau !== input.confirmation) return 'La confirmation ne correspond pas au nouveau mot de passe.';
  return null;
}

/** Indicateur de force calculé sur l'appareil : aucune route d'audit de mot de passe n'existe. */
export function forceDuMotDePasse(nouveau: string): number {
  if (!nouveau) return 0;
  let score = 0;
  if (nouveau.length >= 8) score += 1;
  if (nouveau.length >= 12) score += 1;
  if (/[a-z]/.test(nouveau) && /[A-Z]/.test(nouveau)) score += 1;
  if (/\d/.test(nouveau)) score += 1;
  if (/[^A-Za-z0-9\s]/.test(nouveau)) score += 1;
  return score;
}

/** Icône de pièce déduite du libellé du dossier (aucune icône n'est stockée côté back). */
export function iconePiece(libelle: string): 'policy' | 'fingerprint' | 'badge' {
  if (/assurance|police|responsab/i.test(libelle)) return 'policy';
  if (/identit|cni|cip|passeport/i.test(libelle)) return 'fingerprint';
  return 'badge';
}

/** Une pièce n'est « validée » que si le dossier porte ce mot : sinon on affiche l'état brut. */
export function pieceValidee(statut: string | undefined): boolean {
  return /valide|verifie|vérifié|pay[ée]/i.test(statut ?? '');
}

/** Puce d'en-tête de la carte Conformité. */
export function puceConformite(nombre: number): { cle: string; ton: 'ok' | 'warn' } {
  return nombre > 0 ? { cle: `${nombre} pièce au dossier`, ton: 'ok' } : { cle: 'Dossier vide', ton: 'warn' };
}

/** Libellé du statut opérationnel, `null` = l'API ne l'a pas renvoyé. */
export function libelleDisponibilite(disponible: boolean | null): { cle: string; enService: boolean } {
  if (disponible == null) return { cle: 'Statut inconnu', enService: false };
  return disponible ? { cle: 'En service', enService: true } : { cle: 'Hors service', enService: false };
}
