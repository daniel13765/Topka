import { apiClient } from './client';

export interface CreateOrderPayload {
  items: Array<{
    product_id: number;
    quantite: number;
  }>;
  landmark_id: number;
  description_lieu?: string;
  payment_method: 'cash' | 'card' | 'fedapay';
}

export const ordersApi = {
  // GET /api/orders -> liste des commandes du client
  getOrders: async (page = 1, statut?: string) => {
    const response = await apiClient.get('/orders', { params: { page, ...(statut ? { statut } : {}) } });
    return response.data;
  },

  // GET /api/orders/{id} -> détails d'une commande
  getOrder: async (id: number | string) => {
    const response = await apiClient.get(`/orders/${id}`);
    return response.data;
  },

  // POST /api/orders -> passer une commande
  createOrder: async (payload: CreateOrderPayload) => {
    const response = await apiClient.post('/orders', payload);
    return response.data;
  },

  // DELETE /api/orders/{id} -> annuler une commande
  cancelOrder: async (id: number | string) => {
    const response = await apiClient.delete(`/orders/${id}`);
    return response.data;
  },

  // GET /api/orders/{id}/tracking -> suivi d'une commande
  getTracking: async (id: number | string) => {
    const response = await apiClient.get(`/orders/${id}/tracking`);
    return response.data;
  },
};
