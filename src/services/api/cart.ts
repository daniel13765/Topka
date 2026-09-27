import { apiClient } from './client';

export interface CartApiItem {
  product_id: number;
  nom: string;
  prix: number;
  quantite: number;
}

export const cartApi = {
  // GET /api/cart -> recupere le panier en cache backend
  getCart: async () => {
    const response = await apiClient.get<{ data: CartApiItem[] }>('/cart');
    return response.data;
  },

  // POST /api/cart/add -> ajoute un produit au panier
  addToCart: async (productId: number, quantite = 1) => {
    const response = await apiClient.post<{ data: CartApiItem[] }>('/cart/add', {
      product_id: productId,
      quantite,
    });
    return response.data;
  },

  // PUT /api/cart/update -> met a jour la quantite d'un produit
  updateCart: async (productId: number, quantite: number) => {
    const response = await apiClient.put<{ data: CartApiItem[] }>('/cart/update', {
      product_id: productId,
      quantite,
    });
    return response.data;
  },

  // DELETE /api/cart/remove/{id} -> supprime un produit du panier
  removeFromCart: async (productId: number) => {
    const response = await apiClient.delete<{ data: CartApiItem[] }>(`/cart/remove/${productId}`);
    return response.data;
  },
};
