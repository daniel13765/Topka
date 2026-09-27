import type { CategoryId } from '../types/models';

/** Catégorie réelle (ProductResource.categorie) -> filtre Stitch du catalogue. */
export function mapApiCategory(categorie?: { slug?: string | null; nom?: string | null } | null): CategoryId {
  const s = `${categorie?.slug ?? ''} ${categorie?.nom ?? ''}`.toLowerCase();
  if (/poisson|viande|chair|boeuf|porc|poulet/.test(s)) return 'fish';
  if (/c.r.al|graine|riz|ma.s|bl.|haricot/.test(s)) return 'grain';
  if (/.pice|condiment|aromate|ail|piment/.test(s)) return 'spice';
  if (/pack|bundle|lot/.test(s)) return 'pack';
  return 'vegetable';
}
