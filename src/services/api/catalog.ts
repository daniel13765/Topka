import { apiClient } from './client';

export interface CatalogParams {
  q?: string;
  categorie_id?: number;
  sort?: 'nom' | 'prix' | 'created_at';
  dir?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface ApiProduct {
  id: number;
  nom: string;
  description?: string;
  prix: number;
  prix_minimum: number;
  devise: string;
  img_url?: string;
  /** Champ réel de ProductResource (l'API renvoie image_url, pas img_url). */
  image_url?: string | null;
  stock: number;
  disponible: boolean;
  categorie?: {
    id: number;
    nom: string;
    slug: string;
  };
}

/** Catégorie — GET /api/categories : racines (parent_id null) triées par nom, avec `children`. */
export interface ApiCategory {
  id: number;
  nom: string;
  slug: string;
  description?: string | null;
  parent_id?: number | null;
  children?: ApiCategory[];
  /** Prévus par le design mais pas encore persistés côté backend (B-17) : utilisés s'ils arrivent. */
  icone?: string | null;
  en_accueil?: boolean | null;
}

/** Produit inclus dans un pack — quantité dans `pivot.qte` (table produit_pack). */
export interface ApiBundleItem {
  id: number;
  nom: string;
  prix?: number | string;
  pivot?: { qte?: number | string };
}

/** Pack — modèle `Pack` brut (GET /bundles : disponibles + `products` ; admin : + `produits`). */
export interface ApiBundle {
  id: number;
  nom: string;
  description?: string | null;
  prix_total: number | string;
  prix_minimum?: number | string | null;
  img_url?: string | null;
  disponible?: boolean;
  products?: ApiBundleItem[];
  produits?: ApiBundleItem[];
}

/** Zone de livraison — exactement `ZoneResource` (GET /zones). */
export interface ApiZone {
  id: number;
  nom: string;
  open_zone?: boolean;
  min_prix: number;
  km_prix: number;
  tarif_km: number;
  maj_heure?: string | null;
  description?: string | null;
  polygone_geo?: unknown;
  points_repere?: Array<{
    id: number;
    nom: string;
    description?: string | null;
    latitude?: number | string;
    longitude?: number | string;
  }>;
}

export const catalogApi = {
  // GET /api/products -> catalogue paginé avec filtres
  getProducts: async (params?: CatalogParams) => {
    const response = await apiClient.get('/products', { params });
    return response.data;
  },

  // GET /api/products/{id} -> détail d'un produit
  getProduct: async (id: number | string) => {
    const response = await apiClient.get(`/products/${id}`);
    return response.data;
  },

  // GET /api/categories -> liste des catégories
  getCategories: async () => {
    const response = await apiClient.get('/categories');
    return response.data;
  },

  // GET /api/bundles -> packs de produits
  getBundles: async () => {
    const response = await apiClient.get('/bundles');
    return response.data;
  },

  // GET /api/zones -> zones de livraison
  getZones: async () => {
    const response = await apiClient.get('/zones');
    return response.data;
  },
};
