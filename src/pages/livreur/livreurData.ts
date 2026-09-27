import { authApi, catalogApi, livreurApi } from '../../services/api';
import { uiLang } from '../../i18n/tx';
import { listOf, unwrap } from '../../services/api/unwrap';

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
  landmark?: { id?: number; nom?: string | null; zone_id?: number | null } | null;
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

/** Historique complet (20 par page) : au plus `maxPages` pages, `capped` si la limite est atteinte. */
export async function fetchAllHistory(maxPages = 25): Promise<{ orders: LivreurOrder[]; total: number; capped: boolean }> {
  const orders: LivreurOrder[] = [];
  let total = 0;
  for (let page = 1; page <= maxPages; page++) {
    const res: any = await livreurApi.getHistory(page);
    orders.push(...listOf(res).map(unwrapOrder));
    total = Number(res?.meta?.total ?? orders.length);
    if (page >= Number(res?.meta?.last_page ?? 1)) return { orders, total, capped: false };
  }
  return { orders, total, capped: true };
}

/** Zones (id → nom) via GET /zones (public). */
export async function fetchZoneNames(): Promise<Map<number, string>> {
  const list = listOf(unwrap(await catalogApi.getZones()));
  return new Map(list.map((z: any) => [Number(z.id), String(z.nom ?? '—')]));
}

/** Profil du livreur (GET /profile) : disponibilité réelle et zone assignée. */
export interface LivreurProfile {
  id?: number;
  nom?: string;
  prenom?: string;
  nom_complet?: string;
  email?: string;
  telephone?: string | null;
  disponible: boolean | null;
  zone: string | null;
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
    disponible: profil?.disponibilite == null ? null : Boolean(profil.disponibilite),
    zone: profil?.zone?.nom ?? null,
  };
  profileCache = { at: Date.now(), value };
  return value;
}

export function forgetLivreurProfile() {
  profileCache = null;
}
