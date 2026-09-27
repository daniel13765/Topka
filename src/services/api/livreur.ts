import { apiClient } from './client';

export const livreurApi = {
  // GET /api/livreur/deliveries -> courses assignees au livreur
  getDeliveries: async () => {
    const response = await apiClient.get('/livreur/deliveries');
    return response.data;
  },

  // PATCH /api/livreur/deliveries/{order}/accept -> accepter une course
  acceptDelivery: async (orderId: number) => {
    const response = await apiClient.patch(`/livreur/deliveries/${orderId}/accept`);
    return response.data;
  },

  // PATCH /api/livreur/deliveries/{order}/refuse -> refuser une course
  refuseDelivery: async (orderId: number) => {
    const response = await apiClient.patch(`/livreur/deliveries/${orderId}/refuse`);
    return response.data;
  },

  // POST /api/livreur/position -> transmission GPS
  updatePosition: async (data: { latitude: number; longitude: number; order_id?: number }) => {
    const response = await apiClient.post('/livreur/position', data);
    return response.data;
  },

  // PATCH /api/livreur/deliveries/{order}/status -> statut de livraison (en_livraison | livre)
  updateStatus: async (orderId: number, statut: 'en_livraison' | 'livre') => {
    const response = await apiClient.patch(`/livreur/deliveries/${orderId}/status`, { statut });
    return response.data;
  },

  // GET /api/livreur/history -> historique
  getHistory: async (page = 1) => {
    const response = await apiClient.get('/livreur/history', { params: { page } });
    return response.data;
  },
};
