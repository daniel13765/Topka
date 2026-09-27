/** Modèles de données frontend — miroir du modèle Eloquent CDC §6. */

export type CategoryId = 'vegetable' | 'fish' | 'grain' | 'spice' | 'pack';

export interface Category {
  id: CategoryId;
  nom: string;
}

export type StockState = 'available' | 'low' | 'out';
export type ProductBadge = 'promo' | 'pack' | 'new';

export interface Product {
  id: string;
  nom: string;
  origine: string;          // marché d'origine (ex : Marché Dantokpa)
  quantite: string;         // poids / lot (ex : 1kg, Lot de 3)
  prix: number;             // FCFA
  prixMinimum: number;      // FCFA — plancher de négociation (F-10)
  categorie: CategoryId;
  stock: StockState;
  badges: ProductBadge[];
  image?: string;           // URL Cloudinary future ; sinon placeholder dégradé
  /** Description (backend ProductResource.description) */
  description?: string;
  /** Offre de négociation acceptée (badge + prix barré, maquette panier) */
  negotiated?: { oldPrice: number };
}

export interface Market {
  id: string;
  nom: string;
}

export interface Zone {
  id: string;
  nom: string;
}

export interface LandMark {
  id: string;
  zoneId: string;
  nom: string;
}

export interface CartItem {
  product: Product;
  quantite: number;
}

export type NotificationType = 'order' | 'promo' | 'security' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;             // libellé relatif affiché (ex : « Il y a 10 min. »)
  unread: boolean;
}
