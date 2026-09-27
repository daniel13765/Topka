/**
 * Famille d'une catégorie réelle (GET /api/categories, ProductResource.categorie), déduite de son nom/slug.
 * Sert uniquement à choisir l'icône du design : le backend ne persiste pas encore `icone` (B-17).
 * Chaque page associe ensuite la famille à l'icône de SA maquette Stitch (catalogue ≠ accueil).
 */
export type CategoryKind = 'vegetable' | 'fish' | 'grain' | 'spice' | 'pack' | 'other';

export function categoryKind(c?: { nom?: string | null; slug?: string | null } | null): CategoryKind {
  const s = `${c?.slug ?? ''} ${c?.nom ?? ''}`.toLowerCase();
  if (/poisson|viande|chair|boeuf|porc|poulet|volaille/.test(s)) return 'fish';
  if (/c.r.al|graine|riz|ma.s|haricot/.test(s)) return 'grain';
  if (/.pice|condiment|aromate|piment/.test(s)) return 'spice';
  if (/pack|bundle/.test(s)) return 'pack';
  if (/l.gume|fruit|tubercule|vivrier/.test(s)) return 'vegetable';
  return 'other';
}
