import type { PieceDocumentaire } from '../pages/livreur/parametres/profilUtils';

/**
 * Règles de l'écran « Livreurs » de l'administration, isolées du rendu.
 *
 * Tout part d'une seule source : la ligne renvoyée par `GET /admin/users?role=livreur`, c'est-à-dire
 * `UserResource` avec `livreur` chargé en modèle brut sous la clé `profil`. Colonnes réellement
 * présentes sur `livreurs` (migration `create_livreur_profiles_table` puis `schema_francais_tokpa`
 * qui renomme la table et ajoute les deux dernières) : `user_id`, `zone_id`, `disponibilite`,
 * `position_lat`, `position_lng`, `documents` (json), `id_vehicule`, `created_at`, `updated_at`.
 *
 * Ce qui n'existe nulle part et n'est donc jamais affiché comme s'il existait :
 * - le nom du véhicule : `Vehicule` a `nom`, `type`, `immatriculation` en base, mais aucune route
 *   n'expose cette table — seul `livreurs.id_vehicule` (un numéro nu) circule ;
 * - l'horodatage de la position : la table n'a pas de colonne `position_*_at`, et `updated_at`
 *   bouge à la moindre écriture du profil, ce qui n'est pas une heure de GPS ;
 * - la validation des pièces : `documents` n'est écritible que par le livreur lui-même
 *   (`PUT /profile`), `PUT /admin/users/{id}` ne le valide pas ;
 * - les horaires du livreur : `heure_debut`/`heure_fin` sont validés par `PUT /admin/users/{id}` mais
 *   appliqués au seul manager, et la table `livreurs` n'a pas ces colonnes.
 */

/** Ligne telle que reçue de l'API (ressource + modèle brut sous `profil`). */
export type LivreurRow = {
  id?: number | string;
  nom_complet?: string | null;
  statut?: string | null;
  telephone?: string | null;
  email?: string | null;
  image_profil?: string | null;
  profil?: Record<string, unknown> | null;
  [champ: string]: unknown;
};

type Repere = { lat: number; lng: number };

export const profilDe = (l: LivreurRow | null | undefined): Record<string, unknown> =>
  (l?.profil && typeof l.profil === 'object' ? l.profil : {}) as Record<string, unknown>;

/**
 * Disponibilité telle que la base la renvoie (`boolean` casté côté Laravel).
 * `null` quand le profil n'est pas chargé : l'écran affiche alors « inconnu », jamais « hors ligne ».
 */
export const disponibleDe = (l: LivreurRow | null | undefined): boolean | null => {
  const p = profilDe(l);
  if (!('disponibilite' in p) || p.disponibilite == null) return null;
  return Boolean(p.disponibilite);
};

/** `zone_id` brut (la relation `zone` n'est chargée que sur `livreur`, pas toujours résolue). */
export const zoneIdDe = (l: LivreurRow | null | undefined): number | null => {
  const brut = profilDe(l).zone_id ?? (l as { zone_id?: unknown })?.zone_id;
  const n = Number(brut);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Dernière position transmise par `POST /livreur/position` (GPSTrackingService la `forceFill` sur la
 * ligne du livreur). Bornes de validation identiques à `UpdateTrackingRequest` ; en dehors, on
 * considère la donnée comme inutilisable plutôt que de l'afficher.
 */
export const positionDe = (l: LivreurRow | null | undefined): Repere | null => {
  const p = profilDe(l);
  const lat = Number(p.position_lat);
  const lng = Number(p.position_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null; // coordonnées par défaut d'un capteur non renseigné
  return { lat, lng };
};

/** Lien vers le repère, sans clé d'API : OpenStreetMap lit les coordonnées dans l'URL. */
export const lienCarte = ({ lat, lng }: Repere): string =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

/** Coordonnées affichées avec la précision stockée (`decimal(10,7)`). */
export const decrirePosition = (r: Repere): string => `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`;

/**
 * Pièces déclarées par le livreur dans `livreurs.documents` (json).
 *
 * Le champ est `nullable` : `null` = le champ n'a jamais été écrit, `[]` = dossier ouvert et vide
 * (le `store` de l'administration crée le profil avec `documents => []`). Les deux se lisent
 * différemment à l'écran. Une entrée peut être un objet `{ libelle, valeur, statut }` (la forme que
 * la page Paramètres du livreur écrit) ou une simple chaîne (quelqu'un a posté le tableau à la main).
 */
export function piecesDe(l: LivreurRow | null | undefined): { connues: boolean; pieces: PieceDocumentaire[] } {
  const brut = profilDe(l).documents;
  if (!Array.isArray(brut)) return { connues: false, pieces: [] };
  const pieces = brut
    .map((d): PieceDocumentaire | null => {
      if (typeof d === 'string') {
        const v = d.trim();
        return v ? { libelle: v } : null;
      }
      if (d && typeof d === 'object') {
        const o = d as Record<string, unknown>;
        const libelle = String(o.libelle ?? o.nom ?? '').trim();
        if (!libelle) return null;
        const valeur = o.valeur != null ? String(o.valeur).trim() : o.url != null ? String(o.url).trim() : '';
        const statut = o.statut != null ? String(o.statut).trim() : '';
        return {
          libelle,
          ...(valeur ? { valeur } : {}),
          ...(statut ? { statut } : {}),
        };
      }
      return null;
    })
    .filter((d): d is PieceDocumentaire => d !== null);
  return { connues: true, pieces };
}

/** Une référence de pièce est une URL absolue quand elle peut être ouverte, sinon un numéro. */
export const estUrl = (valeur: string | undefined): boolean =>
  !!valeur && /^(https?:)?\/\/\S+/i.test(valeur.trim());

/**
 * `livreurs.id_vehicule` : un numéro. Le nom du véhicule n'est exposé par aucune route — l'écran
 * doit le dire au lieu de sortir une marque et une plaque de la maquette.
 */
export const vehiculeDe = (l: LivreurRow | null | undefined): { id: string | null } => {
  const brut = profilDe(l).id_vehicule;
  if (brut == null || brut === '') return { id: null };
  return { id: String(brut) };
};

/** Filtre local (la route `GET /admin/users` ne lit que `role` et `page`). */
export type FiltreLivreurs = { recherche: string; zone: string; etat: 'tous' | 'en_ligne' | 'hors_ligne' | 'en_course'; pieces: 'tous' | 'avec' | 'sans' };

export const FILTRE_NEUTRE: FiltreLivreurs = { recherche: '', zone: '', etat: 'tous', pieces: 'tous' };

export function filtrerLivreurs(
  rows: LivreurRow[],
  filtre: FiltreLivreurs,
  enCourse: (id: number) => boolean,
): LivreurRow[] {
  const q = filtre.recherche.trim().toLowerCase();
  return rows.filter((l) => {
    if (q) {
      const nom = String(l.nom_complet ?? '').toLowerCase();
      const tel = String(l.telephone ?? '').replace(/\D/g, '');
      const attendu = q.replace(/\D/g, '');
      const nomOk = nom.includes(q) || l.email?.toLowerCase().includes(q);
      const telOk = attendu.length >= 3 && tel.includes(attendu);
      if (!nomOk && !telOk) return false;
    }
    if (filtre.zone) {
      const zone = zoneIdDe(l);
      if (zone !== Number(filtre.zone)) return false;
    }
    if (filtre.etat === 'en_course') {
      if (!enCourse(Number(l.id))) return false;
    } else if (filtre.etat === 'en_ligne') {
      if (disponibleDe(l) !== true || enCourse(Number(l.id))) return false;
    } else if (filtre.etat === 'hors_ligne') {
      if (disponibleDe(l) === true) return false;
    }
    if (filtre.pieces !== 'tous') {
      const { pieces } = piecesDe(l);
      if (filtre.pieces === 'avec' ? pieces.length === 0 : pieces.length > 0) return false;
    }
    return true;
  });
}

/** Totaux calculés sur ce qui a été reçu — aucune agrégation n'existe côté `admin/users`. */
export function kpiLivreurs(rows: LivreurRow[], enCourse: (id: number) => boolean) {
  let enLigne = 0;
  let avecPieces = 0;
  let sansPosition = 0;
  let enCourseNombre = 0;
  for (const l of rows) {
    if (disponibleDe(l) === true) enLigne += 1;
    if (piecesDe(l).pieces.length > 0) avecPieces += 1;
    if (!positionDe(l)) sansPosition += 1;
    if (enCourse(Number(l.id))) enCourseNombre += 1;
  }
  return { total: rows.length, enLigne, enCourseNombre, avecPieces, sansPosition };
}

/** Commande telle que l'administration la reçoit après déshabillage de l'enveloppe `OrderResource`. */
export type CommandeAssignable = {
  id?: number | string;
  statut?: string | null;
  montant_total?: number | string | null;
  client?: { nom_complet?: string | null } | null;
  landmark?: { zone_id?: number | string | null } | null;
  livreur?: unknown;
  [champ: string]: unknown;
};

/**
 * Commandes qu'un livreur peut encore recevoir : `AssignLivreurRequest` exige un `order_id` existant,
 * le middleware `available` refuse un livreur non disponible, et le contrôleur compare les zones.
 * Côté état de la commande, la seule qui se laisse affecter est `en_attente` (voir
 * `Commande::TRANSITIONS` : aucune autre transition n'accepte l'arrivée d'un livreur).
 */
export function commandesAssignables(orders: Array<Record<string, unknown>>): CommandeAssignable[] {
  return orders.filter(
    (o) => (o as CommandeAssignable)?.statut === 'en_attente' && (o as CommandeAssignable)?.livreur == null,
  ) as CommandeAssignable[];
}
