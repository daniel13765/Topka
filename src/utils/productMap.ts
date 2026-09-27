import type { ApiProduct } from '../services/api/catalog';
import type { CategoryId, Product } from '../types/models';
import { absImageUrl } from './imageUrl';

const SLUG_TO_CATEGORY: Record<string, CategoryId> = {
  legume: 'vegetable',
  legumes: 'vegetable',
  fruit: 'vegetable',
  fruits: 'vegetable',
  poisson: 'fish',
  poissons: 'fish',
  cereale: 'grain',
  cereales: 'grain',
  grain: 'grain',
  epice: 'spice',
  epices: 'spice',
  pack: 'pack',
};

/** Fiche produit : ProductResource -> modèle d'affichage. */
export function mapApiProduct(p: ApiProduct): Product {
  const slug = p.categorie?.slug ?? '';
  return {
    id: String(p.id),
    nom: p.nom,
    origine: p.categorie?.nom ?? '',
    quantite: '',
    prix: Number(p.prix),
    prixMinimum: Number(p.prix_minimum),
    categorie: SLUG_TO_CATEGORY[slug] ?? 'vegetable',
    stock: p.disponible && p.stock > 0 ? 'available' : 'out',
    badges: [],
    image: absImageUrl(p.image_url ?? p.img_url) ?? undefined,
    description: p.description,
  };
}
