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

/* ---------------------------------------------------------------------------
 * Pièces justificatives (`livreurs.documents`).
 *
 * `PUT /profile` valide `documents` comme tableau nullable puis fait
 * `$user->livreur->update(['documents' => $data['documents']])` : le champ est donc bien
 * enregistrable par le livreur, mais il est **remplacé** à chaque envoi — d'où
 * `construireDocuments`, qui renvoie la liste complète. Aucune route de dépôt de fichier
 * n'existe : une pièce se déclare par son nom et sa référence (URL absolue ou numéro).
 * ------------------------------------------------------------------------- */

/** Une ligne du JSON `livreurs.documents`, telle que `normaliserDocuments` la produit. */
export interface PieceDocumentaire {
  libelle: string;
  valeur?: string;
  statut?: string;
}

/** Libellés attendus par l'administration ; le champ reste libre, ce n'est qu'une aide. */
export const TYPES_PIECE = [
  'Permis de conduire',
  'Assurance responsabilité civile',
  'Carte nationale d’identité',
  'Carte grise du véhicule',
  'Registre de commerce',
] as const;

/** Saisie brute du formulaire, avant nettoyage. */
export interface PieceSaisie {
  libelle: string;
  valeur: string;
}

/** `libelle` max. 120 (borné pour rester lisible en liste), `valeur` max. 500 comme l'URL de photo. */
export function erreurPiece(piece: PieceSaisie): string | null {
  const libelle = piece.libelle.trim();
  const valeur = piece.valeur.trim();
  if (!libelle) return 'Nomme la pièce que tu déclares.';
  if (libelle.length > 120) return 'Le nom de la pièce dépasse 120 caractères.';
  if (!valeur) return 'Indique l’URL du document ou sa référence.';
  if (valeur.length > 500) return 'La référence dépasse 500 caractères.';
  return null;
}

export function normaliserPiece(piece: PieceSaisie): PieceSaisie {
  return { libelle: piece.libelle.trim(), valeur: piece.valeur.trim() };
}

/** Un même dossier ne doit pas porter deux fois la même pièce (comparaison insensible à la casse). */
export function pieceDejaPresente(candidat: { libelle: string }, existantes: { libelle: string }[]): boolean {
  const cle = candidat.libelle.trim().toLowerCase();
  return existantes.some((d) => d.libelle.trim().toLowerCase() === cle);
}

/**
 * Corps `documents` envoyé au backend : libellé et référence nettoyés, `statut` conservé tel quel
 * (il appartient à l'administration), lignes vides écartées.
 */
export function construireDocuments(pieces: PieceDocumentaire[]): PieceDocumentaire[] {
  return pieces
    .map((p) => {
      const libelle = (p.libelle ?? '').trim();
      const valeur = (p.valeur ?? '').trim();
      const statut = (p.statut ?? '').trim();
      if (!libelle) return null;
      return {
        libelle,
        ...(valeur ? { valeur } : {}),
        ...(statut ? { statut } : {}),
      } satisfies PieceDocumentaire;
    })
    .filter((p): p is PieceDocumentaire => p !== null);
}

/** Le dossier a-t-il changé, une fois les deux côtés normalisés (évite un « enregistrer » fantôme). */
export function documentsModifies(avant: PieceDocumentaire[], apres: PieceDocumentaire[]): boolean {
  return JSON.stringify(construireDocuments(avant)) !== JSON.stringify(construireDocuments(apres));
}

/** Dénombrement affiché sous le formulaire : rien qui viendrait de la maquette. */
export function comptePieces(pieces: PieceDocumentaire[]): { total: number; declarees: number; verifiees: number } {
  // `pieceValidee` reste la seule source du verdict : la liste ne doit pas se colorer autrement que la puce.
  const verifiees = pieces.filter((p) => pieceValidee(p.statut)).length;
  return { total: pieces.length, declarees: pieces.length - verifiees, verifiees };
}
