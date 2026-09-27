import { apiClient } from './client';

export const managerApi = {
  // GET /api/manager/orders -> commandes de la zone du manager
  getOrders: async (params?: { statut?: string; page?: number }) => {
    const response = await apiClient.get('/manager/orders', { params });
    return response.data;
  },

  // POST /api/manager/assign -> assignation livreur
  assignLivreur: async (orderId: number, livreurId: number) => {
    const response = await apiClient.post('/manager/assign', {
      order_id: orderId,
      livreur_id: livreurId,
    });
    return response.data;
  },

  // GET /api/manager/livreurs -> liste livreurs de la zone
  getLivreurs: async () => {
    const response = await apiClient.get('/manager/livreurs');
    return response.data;
  },

  // GET /api/manager/stats -> statistiques
  getStats: async (period: 'jour' | 'semaine' | 'mois' = 'jour') => {
    const response = await apiClient.get('/manager/stats', { params: { period } });
    return response.data;
  },
};
