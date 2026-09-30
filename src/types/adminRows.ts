/**
 * Formes de lignes admin — miroir tolérant des ressources Laravel telles que les écrans de
 * l'administration les lisent réellement (pas de schéma contractuel côté backend : `ZoneResource`,
 * `PointRepereResource` et `UserResource` renvoient des champs optionnels selon les chargements).
 *
 * Chaque champ est typé `| null | undefined` parce que l'API renvoie les deux ; les index signatures
 * `unknown` laissent passer les champs non encore inventoriés sans retomber dans `any`.
 */

/** Ligne de `GET /admin/zones` (ZoneResource). */
export type ZoneRow = {
  id: number | string;
  nom?: string | null;
  description?: string | null;
  km_prix?: number | string | null;
  manager_id?: number | string | null;
  /** L'API charge parfois la relation ; la page ne lit que son identifiant. */
  manager?: { id?: number | string | null } | null;
  actif?: boolean | number | string | null;
  /** GeoJSON `[lng, lat]` ou tableau de `[lat, lng]` — réduit par `polyPoints()`. */
  /** Horodatage d'affiliation rendu par la grille tarifaire de /admin/parametres. */
  maj_heure?: string | null;
  polygone_geo?: unknown;
  points_repere?: unknown;
  [champ: string]: unknown;
};

/** Ligne de `GET /admin/landmarks` (PointRepereResource). */
export type LandmarkRow = {
  id: number | string;
  nom?: string | null;
  zone_id?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  [champ: string]: unknown;
};

/** Ligne de `GET /admin/users` (UserResource, avec sa relation zone selon les chargements). */
export type UserRow = {
  id: number | string;
  nom_complet?: string | null;
  email?: string | null;
  telephone?: string | null;
  role?: string | null;
  actif?: boolean | number | string | null;
  disponible?: boolean | number | string | null;
  zone_id?: number | string | null;
  zone?: { id?: number | string | null; nom?: string | null } | null;
  profil?: { zone_id?: number | string | null; zone?: { id?: number | string | null } | null } | null;
  [champ: string]: unknown;
};

/** Ligne de `GET /admin/categories` (CategoryResource). */
export type CategoryRow = {
  id: number | string | null;
  nom?: string | null;
  description?: string | null;
  icone?: string | null;
  couleur?: string | null;
  parent_id?: number | string | null;
  actif?: boolean | number | string | null;
  /** Le backend renvoie un booléen, parfois 0/1 selon les ressources. */
  en_accueil?: boolean | number | string | null;
  [champ: string]: unknown;
};

/** Ligne de `GET /admin/products`, réduite aux champs lus par l'écran des catégories. */
export type ProductRow = {
  id: number | string;
  nom?: string | null;
  categorie_id?: number | string | null;
  categorie?: { id?: number | string | null; nom?: string | null } | null;
  stock?: number | string | null;
  prix?: number | string | null;
  prix_minimum?: number | string | null;
  description?: string | null;
  /** Les deux clés circulent selon les versions de la ressource. */
  image_url?: string | null;
  img_url?: string | null;
  disponible?: boolean | number | string | null;
  [champ: string]: unknown;
};

/** Ligne de `GET /admin/orders` (OrderResource). */
export type OrderRow = {
  id: number | string;
  statut?: string | null;
  montant_total?: number | string | null;
  user?: { nom_complet?: string | null } | null;
  landmark?: { id?: number | string | null; zone_id?: number | string | null; nom?: string | null } | null;
  client?: { nom_complet?: string | null; telephone?: string | null } | null;
  created_at?: string | null;
  payment?: { methode?: string | null } | null;
  commission_plateforme?: number | string | null;
  commission?: number | string | null;
  frais_livraison?: number | string | null;
  items?: Array<{ nom?: string | null; quantite?: number | string | null }> | null;
  [champ: string]: unknown;
};

/** Booléen tolérant : le backend alternentre `true`/`false` et `1`/`0` selon les ressources. */
export const versBooleen = (v: unknown, parDefaut = false): boolean =>
  v == null ? parDefaut : !(v === false || v === 0 || v === '0' || v === '');

/** Charge utile de `GET /admin/dashboard` (AdminDashboardController : ca, commandes, utilisateurs_actifs, par_statut). */
export type DashboardRow = {
  ca?: number | string | null;
  commandes?: number | string | null;
  utilisateurs_actifs?: number | string | null;
  par_statut?: Record<string, number> | null;
  [champ: string]: unknown;
};

/** Ligne de `GET /admin/bundles` — un pack est une composition de produits avec quantités (F-08). */
export type BundleRow = {
  id: number | string;
  nom?: string | null;
  description?: string | null;
  prix_total?: number | string | null;
  prix_minimum?: number | string | null;
  disponible?: boolean | number | string | null;
  image_url?: string | null;
  img_url?: string | null;
  /** Lignes liées : la ressource les nomme `produits` ou `products`, avec un pivot `qte`. */
  produits?: Array<{ id?: number | string | null; pivot?: { qte?: number | string | null } | null }> | null;
  products?: Array<{ id?: number | string | null; pivot?: { qte?: number | string | null } | null }> | null;
  [champ: string]: unknown;
};
