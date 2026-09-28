import { authApi, catalogApi, livreurApi } from '../../services/api';
import { uiLang } from '../../i18n/tx';
import { listOf, unwrap } from '../../services/api/unwrap';
import { normaliserPolygone } from '../../utils/googleMaps';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Données de l'espace livreur — UNIQUEMENT l'API (routes `role:livreur` + `zone`) :
 *  GET /livreur/deliveries (courses assignées en_attente / en_preparation / en_livraison, non paginé),
 *  GET /livreur/history (livrées, 20 par page), PATCH …/accept | refuse | status, POST /livreur/position,
 *  GET /dashboard (commandes, en_cours du livreur), GET /profile (disponibilité, zone), GET /zones.
 * ⚠️ OrderResource n'expose ni le client (nom, téléphone) ni les coordonnées du point de repère (B-25).
 */
export interface LivreurOrderItem {
  id: number;
  product_id: number;
  nom?: string | null;
  quantite: number;
  prix_unitaire: number;
}

export interface LivreurOrder {
  id: number;
  montant_total: number;
  frais_livraison: number;
  statut: string;
  description_lieu?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items?: LivreurOrderItem[];
  landmark?: {
    id?: number;
    nom?: string | null;
    zone_id?: number | null;
  } | null;
}

/** OrderResource enveloppe chaque commande dans { success, message, data } (même en liste). */
export const unwrapOrder = (r: any): LivreurOrder => (r?.data ?? r) as LivreurOrder;

export const tokRef = (id: number | string) => `#TOK-${id}`;

export const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  livre: 'Livré',
  annule: 'Annulé',
};

const STATUT_LABEL_EN: Record<string, string> = {
  en_attente: 'Pending',
  en_preparation: 'Preparing',
  en_livraison: 'Out for delivery',
  livre: 'Delivered',
  annule: 'Cancelled',
};

export const statutLabel = (s: string) =>
  (uiLang() === 'en' ? STATUT_LABEL_EN[s] : STATUT_LABEL[s]) ?? STATUT_LABEL[s] ?? s;

/** Destination lisible : nom du point de repère + précision saisie par le client. */
export const destination = (o: LivreurOrder) =>
  [o.landmark?.nom, o.description_lieu].filter(Boolean).join(' — ') ||
  (uiLang() === 'en' ? 'Destination not provided' : 'Destination non renseignée');

export const articlesCount = (o: LivreurOrder) => (o.items ?? []).reduce((s, it) => s + Number(it.quantite ?? 0), 0);

/** Date et heure « 25/09 · 14:20 » (date de la commande : l'API ne donne pas l'heure de livraison en liste). */
export function dateHeure(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · ${d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export async function fetchDeliveries(): Promise<LivreurOrder[]> {
  return listOf(await livreurApi.getDeliveries()).map(unwrapOrder);
}

/**
 * Historique complet (20 par page) : au plus `maxPages` pages, `capped` si la limite est atteinte.
 * La page 1 porte `meta.last_page` → les pages suivantes sont demandées en parallèle.
 */
export async function fetchAllHistory(
  maxPages = 25,
): Promise<{ orders: LivreurOrder[]; total: number; capped: boolean }> {
  const first: any = await livreurApi.getHistory(1);
  const lastPage = Number(first?.meta?.last_page ?? 1);
  const pages = Math.min(Math.max(lastPage, 1), maxPages);
  const rest: any[] =
    pages > 1 ? await Promise.all(Array.from({ length: pages - 1 }, (_, i) => livreurApi.getHistory(i + 2))) : [];
  const orders = [first, ...rest].flatMap((res: any) => listOf(res).map(unwrapOrder));
  return { orders, total: Number(first?.meta?.total ?? 0) || orders.length, capped: lastPage > maxPages };
}

/** Zones (id → nom) via GET /zones (public). */
export async function fetchZoneNames(): Promise<Map<number, string>> {
  const list = listOf(unwrap(await catalogApi.getZones()));
  return new Map(list.map((z: any) => [Number(z.id), String(z.nom ?? '—')]));
}

/**
 * Coordonnées RÉELLES des points de repère.
 *
 * OrderResource ne renvoie que `landmark.id/nom/zone_id` (B-25) : sans cet index, impossible d'afficher
 * le marqueur de destination, l'itinéraire ou la distance. `GET /zones` (public) expose `points_repere[]`
 * avec latitude/longitude (ZoneResource), ce qui permet de résoudre le point de livraison de la commande.
 */
export interface LandmarkGeo {
  nom: string;
  lat: number;
  lng: number;
  zone: string | null;
}

const ZONE_TTL_MS = 10 * 60_000;
let geoCache: { at: number; value: Map<number, LandmarkGeo> } | null = null;

export async function fetchLandmarkGeo(force = false): Promise<Map<number, LandmarkGeo>> {
  if (!force && geoCache && Date.now() - geoCache.at < ZONE_TTL_MS) return geoCache.value;
  const zones = listOf(unwrap(await catalogApi.getZones())) as any[];
  /** `Number(null)` vaut 0 : sans ce filtre, un repère sans coordonnées créerait un marqueur à (0,0). */
  const toNum = (v: unknown) => (v == null || v === '' ? Number.NaN : Number(v));
  const value = new Map<number, LandmarkGeo>();
  for (const zone of zones) {
    const zoneName = zone?.nom ? String(zone.nom) : null;
    for (const lm of (zone?.points_repere ?? []) as any[]) {
      const id = toNum(lm?.id);
      const lat = toNum(lm?.latitude);
      const lng = toNum(lm?.longitude);
      if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      if (lat === 0 && lng === 0) continue; // « null island » = aucune géolocalisation enregistrée
      value.set(id, { nom: String(lm?.nom ?? '—'), lat, lng, zone: zoneName });
    }
  }
  geoCache = { at: Date.now(), value };
  return value;
}

/* ---------------------------------------------------------------------------
   Zone d'intervention : géométrie (polygone + repères) servie par `GET /zones`.
   --------------------------------------------------------------------------- */

export interface RepereZone {
  id: number;
  nom: string;
  lat: number;
  lng: number;
}

export interface ZoneGeo {
  id: number;
  nom: string;
  /** Anneaux déjà normalisés en `[lat, lng]` (le backend écrit du GeoJSON `[lng, lat]`). */
  polygone: [number, number][][];
  reperes: RepereZone[];
}

let zonesGeoCache: { at: number; value: ZoneGeo[] } | null = null;

/** Charge toutes les zones avec leur géométrie. Tolère une réponse plate ou enveloppée. */
export async function fetchZonesGeo(force = false): Promise<ZoneGeo[]> {
  if (!force && zonesGeoCache && Date.now() - zonesGeoCache.at < ZONE_TTL_MS) return zonesGeoCache.value;
  const brut = listOf(unwrap(await catalogApi.getZones())) as any[];
  const value: ZoneGeo[] = [];
  for (const zone of brut) {
    const id = Number(zone?.id);
    if (!Number.isFinite(id)) continue;
    const reperes: RepereZone[] = [];
    for (const lm of (zone?.points_repere ?? []) as any[]) {
      const lmId = Number(lm?.id);
      const lat = Number(lm?.latitude);
      const lng = Number(lm?.longitude);
      if (!Number.isFinite(lmId) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) continue;
      reperes.push({ id: lmId, nom: String(lm?.nom ?? '—'), lat, lng });
    }
    value.push({ id, nom: String(zone?.nom ?? '—'), polygone: normaliserPolygone(zone?.polygone_geo), reperes });
  }
  zonesGeoCache = { at: Date.now(), value };
  return value;
}

export function forgetZonesGeo() {
  zonesGeoCache = null;
}

/** `zone_id` est tantôt sur le modèle (`livreurs.zone_id`), tantôt dans la relation chargée. */
export function resoudreZoneId(profil: any): number | null {
  const candidat = profil?.zone_id ?? profil?.zone?.id;
  const n = Number(candidat);
  return candidat == null || candidat === '' || !Number.isFinite(n) || n <= 0 ? null : n;
}

/**
 * Retrouve la zone du compte : d'abord par `zone_id`, puis par nom normalisé (casse et accents
 * ignorés) car la ressource `profile` n'expose parfois que `zone.nom`.
 */
export function zoneCorrespond(zones: ZoneGeo[], zoneId: number | null, nomZone: string | null): ZoneGeo | null {
  if (zoneId != null) {
    const parId = zones.find((z) => z.id === zoneId);
    if (parId) return parId;
  }
  const cible = normaliserNom(nomZone);
  if (!cible) return null;
  return zones.find((z) => normaliserNom(z.nom) === cible) ?? null;
}

export function normaliserNom(valeur: string | null | undefined): string {
  return (valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function forgetLandmarkGeo() {
  geoCache = null;
}

/** Distance à vol d'oiseau (haversine) — même base que GPSTrackingService::estimatedDistanceKm côté back. */
export function haversineKm(from: [number, number], to: [number, number]): number {
  const R = 6371;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(to[0] - from[0]);
  const dLng = rad(to[1] - from[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from[0])) * Math.cos(rad(to[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Vitesse urbaine de référence (Cotonou, moto) servant à ESTIMER l'heure d'arrivée : le backend ne calcule
 * aucune ETA pour le livreur (`/orders/{id}/tracking` est réservé au rôle client). Aucun horodatage inventé :
 * l'estimation est dérivée de la distance réelle et annoncée comme telle dans l'interface.
 */
export const URBAN_SPEED_KMH = 20;

export const etaMinutes = (km: number | null): number | null =>
  km == null || !Number.isFinite(km) || km <= 0 ? null : Math.max(1, Math.round((km / URBAN_SPEED_KMH) * 60));

/** « 3,4 km » (virgule française, comme la maquette) ; tiret si la donnée manque. */
export const fmtKm = (km: number | null): string =>
  km == null || !Number.isFinite(km) ? '—' : `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;

/** Somme des frais réellement rattachés aux commandes (aucun autre gain n'est exposé au livreur). */
export const sommeFrais = (orders: LivreurOrder[]): number =>
  orders.reduce((s, o) => s + montantSur(o.frais_livraison), 0);

/** Lundi 00:00 de la semaine contenant `ref` (semaine ISO, comme la maquette L → D). */
export function debutSemaine(ref: Date = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Les montants backend peuvent arriver en chaîne ou absents : jamais un NaN qui annulerait un cumul. */
const montantSur = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Frais de livraison jour par jour, lundi → dimanche, calculés sur les dates réelles des commandes. */
export function revenusParJour(orders: LivreurOrder[], ref: Date = new Date()): { date: Date; total: number }[] {
  const start = debutSemaine(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const total = orders.reduce(
      (s, o) => (o.created_at && memeJour(new Date(o.created_at), date) ? s + montantSur(o.frais_livraison) : s),
      0,
    );
    return { date, total };
  });
}

/**
 * Comparatif semaine en cours / semaine précédente, en nombre de courses.
 * `deltaPct` reste null quand la semaine précédente est vide : aucun pourcentage n'est inventé.
 */
export function comparaisonSemaines(
  orders: LivreurOrder[],
  ref: Date = new Date(),
): { cetteSemaine: number; semainePrecedente: number; deltaPct: number | null } {
  const start = debutSemaine(ref);
  const prevStart = new Date(start);
  prevStart.setDate(start.getDate() - 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const between = (o: LivreurOrder, from: Date, to: Date) => {
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= from && d < to;
  };
  const cetteSemaine = orders.filter((o) => between(o, start, end)).length;
  const semainePrecedente = orders.filter((o) => between(o, prevStart, start)).length;
  const deltaPct =
    semainePrecedente > 0 ? Math.round(((cetteSemaine - semainePrecedente) / semainePrecedente) * 100) : null;
  return { cetteSemaine, semainePrecedente, deltaPct };
}

/** Durée réelle entre deux horodatages (création de la commande → livraison), en minutes. */
export function dureeMinutes(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.max(1, Math.round((b - a) / 60_000));
}

/** « 18 min » — libellé de la maquette ; tiret quand l'horodatage de livraison manque. */
export const fmtDuree = (min: number | null): string => (min == null ? '—' : `${min} min`);

/**
 * Recherche une commande livrée dans GET /livreur/history (20 par page, sans `updated_at`).
 * Borné à `maxPages` : le récapitulatif est consulté juste après la course, la commande est
 * donc dans les premières pages ; au-delà on renvoie null plutôt que de pager tout l'historique.
 */
export async function fetchDeliveredOrder(orderId: number, maxPages = 3): Promise<LivreurOrder | null> {
  for (let page = 1; page <= maxPages; page++) {
    const res: any = await livreurApi.getHistory(page);
    const found = listOf(res)
      .map(unwrapOrder)
      .find((o) => Number(o.id) === Number(orderId));
    if (found) return found;
    if (page >= Number(res?.meta?.last_page ?? 1)) break;
  }
  return null;
}

/** Profil du livreur (GET /profile) : disponibilité réelle et zone assignée. */
/** Pièce justificative du livreur (`livreurs.documents`, JSON libre côté backend). */
export interface DocumentProfil {
  libelle: string;
  valeur?: string;
  statut?: string;
}

export interface LivreurProfile {
  id?: number;
  nom?: string;
  prenom?: string;
  nom_complet?: string;
  email?: string;
  telephone?: string | null;
  image_profil?: string | null;
  disponible: boolean | null;
  zone: string | null;
  /**
   * `livreurs.zone_id` (chargée avec le modèle) : seul un administrateur la change, mais elle permet
   * de retrouver le polygone de la zone dans `GET /zones` sans dépendre de l'orthographe du nom.
   */
  zoneId: number | null;
  /** `users.statut` : 'actif' | 'inactif' | 'suspendu' (Utilisateur::STATUT_*). */
  statut: string | null;
  /** `livreurs.id_vehicule` : simple FK — aucun endpoint ne permet de résoudre le véhicule. */
  vehiculeId: number | null;
  documents: DocumentProfil[];
}

/**
 * `documents` est un JSON libre (le contrôleur accepte n'importe quel tableau) : on normalise les
 * formes rencontrées (chaîne, objet nommé, objet générique) sans rien inventer d'autre.
 */
export function normaliserDocuments(raw: unknown): DocumentProfil[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d): DocumentProfil | null => {
      if (typeof d === 'string' && d.trim()) return { libelle: d.trim() };
      if (!d || typeof d !== 'object') return null;
      const o = d as Record<string, unknown>;
      const libelle = [o.nom, o.libelle, o.type, o.name, o.document].find((v) => typeof v === 'string' && (v as string).trim());
      if (typeof libelle !== 'string') return null;
      const valeur = [o.numero, o.value, o.url, o.reference].find((v) => typeof v === 'string' && (v as string).trim());
      const statut = [o.statut, o.status].find((v) => typeof v === 'string' && (v as string).trim());
      return {
        libelle: libelle.trim(),
        ...(typeof valeur === 'string' ? { valeur: valeur.trim() } : {}),
        ...(typeof statut === 'string' ? { statut: statut.trim() } : {}),
      };
    })
    .filter((d): d is DocumentProfil => d !== null);
}

let profileCache: { at: number; value: LivreurProfile } | null = null;

export async function fetchLivreurProfile(force = false): Promise<LivreurProfile> {
  if (!force && profileCache && Date.now() - profileCache.at < 60_000) return profileCache.value;
  const u: any = unwrap(await authApi.getProfile());
  const profil = u?.profil ?? {};
  const value: LivreurProfile = {
    id: u?.id,
    nom: u?.nom,
    prenom: u?.prenom,
    nom_complet: u?.nom_complet,
    email: u?.email,
    telephone: u?.telephone ?? null,
    image_profil: typeof u?.image_profil === 'string' && u.image_profil.trim() ? u.image_profil.trim() : null,
    disponible: profil?.disponibilite == null ? null : Boolean(profil.disponibilite),
    zone: profil?.zone?.nom ?? null,
    zoneId: resoudreZoneId(profil),
    statut: typeof u?.statut === 'string' && u.statut.trim() ? u.statut.trim() : null,
    vehiculeId: Number.isFinite(Number(profil?.id_vehicule)) && profil?.id_vehicule != null ? Number(profil.id_vehicule) : null,
    documents: normaliserDocuments(profil?.documents),
  };
  profileCache = { at: Date.now(), value };
  return value;
}

export function forgetLivreurProfile() {
  profileCache = null;
}
