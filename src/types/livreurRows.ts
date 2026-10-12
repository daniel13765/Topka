/**
 * Formes des réponses lues par l'espace livreur — miroir tolérant des ressources Laravel
 * telles que les écrans les lisent vraiment (`OrderResource`, `ZoneResource`, `UserResource`
 * du dépôt backend du 02/10/2026). Aucun schéma contractuel n'existe côté serveur : chaque
 * champ est donc `| null | undefined` (l'API rend les deux) et les index signatures `unknown`
 * laissent passer les champs non encore inventoriés, sans retomber dans `any`.
 *
 * Ces types ne normalisent rien : la normalisation (et elle seule) vit dans
 * `src/pages/livreur/livreurData.ts`.
 */

/** Éléments chargés par `whenLoaded` : la clé est absente de la réponse quand la relation n'est pas chargée. */
type Chargeable<T> = T | null | undefined;

/** Ligne de `commandes.items` (`OrderResource::items`, chargée par `with('items.product')`). */
export type CommandeItemRow = {
  id?: number | string | null;
  /** `null` depuis la migration du 29/09 : un produit retiré du catalogue ne supprime plus la ligne. */
  product_id?: number | string | null;
  /** Libellé figé sur la ligne (migration du 01/10) : c'est lui qui survit au retrait du produit. */
  nom?: string | null;
  quantite?: number | string | null;
  /** `(float)` dans la ressource. */
  prix_unitaire?: number | string | null;
  [champ: string]: unknown;
};

/**
 * Ligne de `GET /livreur/deliveries` et de `GET /livreur/history` (`OrderResource`).
 * `id` est typé large parce que la ressource écrit `'produit retiré'` quand le modèle est nul
 * (`$this?->id ?? 'produit retiré'`) : les écrans comparent donc `Number(order.id)`.
 */
export type CommandeLivreurRow = {
  id?: number | string | null;
  montant_total?: number | string | null;
  frais_livraison?: number | string | null;
  devise?: string | null;
  statut?: string | null;
  description_lieu?: string | null;
  /** `created_at?->toIso8601String()` — `updated_at` n'est PAS rendu par la ressource. */
  created_at?: string | null;
  updated_at?: string | null;
  items?: Chargeable<CommandeItemRow[]>;
  landmark?: Chargeable<{ id?: number | string | null; nom?: string | null; zone_id?: number | string | null }>;
  /** Chargé par `LivreurDeliveryController::index` (`with('client')`) ; absent de `history`. */
  client?: Chargeable<{ id?: number | string | null; nom_complet?: string | null; telephone?: string | null }>;
  livreur?: Chargeable<{ id?: number | string | null; nom_complet?: string | null; telephone?: string | null }>;
  payment?: Chargeable<{
    id?: number | string | null;
    montant?: number | string | null;
    statut?: string | null;
    methode?: string | null;
  }>;
  [champ: string]: unknown;
};

/**
 * `OrderResource` enveloppe chaque commande dans `{ success, message, data }` (même en liste) :
 * c'est ce que lit `unwrapOrder()`. La pagination, elle, est Laravel brute (`data` + `meta`).
 */
export type EnveloppeCommandeRow = { success?: boolean; message?: string; data?: CommandeLivreurRow };

/** Paginateur Laravel tel que `GET /livreur/history` le rend (20 par page). */
export type PageLivreurRow = {
  data?: unknown;
  meta?: {
    current_page?: number | string | null;
    from?: number | string | null;
    last_page?: number | string | null;
    per_page?: number | string | null;
    to?: number | string | null;
    total?: number | string | null;
    [champ: string]: unknown;
  };
  links?: unknown;
  [champ: string]: unknown;
};

/** Repère tel que `ZoneResource::points_repere` le construit (aucune ressource dédiée côté backend). */
export type RepereZoneRow = {
  id?: number | string | null;
  nom?: string | null;
  description?: string | null;
  /** Colonnes `decimal` du modèle : chaîne ou nombre selon les chargements. */
  latitude?: number | string | null;
  longitude?: number | string | null;
  zone_id?: number | string | null;
  [champ: string]: unknown;
};

/** Ligne de `GET /zones` (route publique, `ZoneResource`). */
export type ZonePubliqueRow = {
  id?: number | string | null;
  nom?: string | null;
  description?: string | null;
  open_zone?: boolean | number | string | null;
  min_prix?: number | string | null;
  km_prix?: number | string | null;
  tarif_km?: number | string | null;
  maj_heure?: string | null;
  /** GeoJSON brut (`[lng, lat]`) — réduit par `normaliserPolygone()`. */
  polygone_geo?: unknown;
  points_repere?: unknown;
  [champ: string]: unknown;
};

/** Profil `livreurs` tel que `UserResource::profil` le rend : le modèle brut, sans ressource. */
export type LivreursProfilRow = {
  id?: number | string | null;
  utilisateur_id?: number | string | null;
  disponibilite?: boolean | number | string | null;
  zone_id?: number | string | null;
  /** Simple FK : aucune route ne sert la table `vehicules`, donc aucun nom ni plaque. */
  id_vehicule?: number | string | null;
  /** Colonne JSON libre ; `note` et `statut` d'un document n'existent pas côté backend. */
  documents?: unknown;
  position_lat?: number | string | null;
  position_lng?: number | string | null;
  /** Chargée par certains écrans admin seulement. */
  zone?: { id?: number | string | null; nom?: string | null } | null;
  [champ: string]: unknown;
};

/** Ligne de `GET /profile` et du `PUT /profile` (`UserResource`). */
export type UtilisateurRow = {
  id?: number | string | null;
  nom?: string | null;
  prenom?: string | null;
  nom_complet?: string | null;
  email?: string | null;
  telephone?: string | null;
  image_profil?: string | null;
  id_role?: number | string | null;
  /** Objet `{ id, nom, permissions }` si la relation est chargée, sinon la chaîne du rôle. */
  role?: string | { id?: number | string | null; nom?: string | null; permissions?: unknown } | null;
  /** `Utilisateur::STATUT_*` : actif | inactif | suspendu. */
  statut?: string | null;
  is_verified?: boolean | null;
  stats?: { "commandes_effectuees\""?: number; points_repere_enregistres?: number; [champ: string]: unknown };
  profil?: LivreursProfilRow | null;
  [champ: string]: unknown;
};

/** Enveloppe `{ success, message, data }` d'une ressource unique (profile, mise à jour de profil…). */
export type EnveloppeUtilisateurRow = { success?: boolean; message?: string; data?: UtilisateurRow };

/** Réponse plate ou enveloppée d'une liste de zones (`GET /zones` passe par `unwrap` puis `listOf`). */
export type ListeZonesRow = ZonePubliqueRow[] | { data?: unknown };

/** Réponse de `POST /livreur/position` : le contrôleur ne renvoie qu'un message. */
export type PositionAckRow = { success?: boolean; message?: string; [champ: string]: unknown };

/** Corps d'une erreur de validation Laravel (422) ou d'un refus métier (403). */
export type RejetApiRow = {
  message?: string;
  errors?: Record<string, string[]>;
  [champ: string]: unknown;
};

/** Un jeton `whenLoaded` absent n'est pas `null` : ces trois valeurs veulent dire « la clé n'est pas là ». */
export const estAbsent = (v: unknown): boolean => v === undefined || v === null;
