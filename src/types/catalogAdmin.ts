import type { Product } from './domain';

export type AdminItemStatus = 'active' | 'draft' | 'archived';

export interface AdminCatalogProduct extends Product {
  sku: string;
  stock: number;
  status: AdminItemStatus;
  updatedAt: string;
}

export interface StandalonePack {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  compareAtPrice: number;
  stock: number;
  status: AdminItemStatus;
  image: string;
  description: string;
  unit: string;
  updatedAt: string;
}

export interface CatalogAdminSnapshot {
  products: AdminCatalogProduct[];
  packs: StandalonePack[];
}
