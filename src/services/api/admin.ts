import { apiClient } from './client';

export const adminApi = {
  // Produits
  getProducts: async (params?: Record<string, unknown> | number) => {
    const response = await apiClient.get('/admin/products', {
      params: typeof params === 'number' ? { page: params } : (params ?? {}),
    });
    return response.data;
  },
  createProduct: async (formData: FormData | Record<string, unknown>) => {
    if (formData instanceof FormData) {
      // Adaptateur fetch : supprime le Content-Type sans boundary (sinon illisible pour Laravel),
      // le navigateur régénère multipart/form-data; boundary=… ; timeout 60s (upload fichier ≤ 4 Mo).
      const response = await apiClient.post('/admin/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        adapter: 'fetch',
        timeout: 60000,
      });
      return response.data;
    }
    const response = await apiClient.post('/admin/products', formData);
    return response.data;
  },
  updateProduct: async (id: number | string, formData: FormData | Record<string, unknown>) => {
    if (formData instanceof FormData) {
      // PHP ne remplit $_FILES que pour un vrai POST → spoofing Laravel _method=PUT.
      if (!formData.has('_method')) formData.append('_method', 'PUT');
      const response = await apiClient.post(`/admin/products/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-HTTP-Method-Override': 'PUT',
        },
        adapter: 'fetch',
        timeout: 60000,
      });
      return response.data;
    }
    const response = await apiClient.put(`/admin/products/${id}`, formData);
    return response.data;
  },
  deleteProduct: async (id: number | string) => {
    const response = await apiClient.delete(`/admin/products/${id}`);
    return response.data;
  },

  // Categories
  getCategories: async () => {
    const response = await apiClient.get('/admin/categories');
    return response.data;
  },
  createCategory: async (data: { nom: string; description?: string; parent_id?: number; icone?: string; couleur?: string; en_accueil?: boolean }) => {
    const response = await apiClient.post('/admin/categories', data);
    return response.data;
  },
  updateCategory: async (id: number, data: { nom?: string; description?: string; parent_id?: number; icone?: string; couleur?: string; en_accueil?: boolean }) => {
    const response = await apiClient.put(`/admin/categories/${id}`, data);
    return response.data;
  },
  deleteCategory: async (id: number) => {
    const response = await apiClient.delete(`/admin/categories/${id}`);
    return response.data;
  },

  // Bundles / Packs
  getBundles: async () => {
    const response = await apiClient.get('/admin/bundles');
    return response.data;
  },
  createBundle: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/admin/bundles', data);
    return response.data;
  },
  updateBundle: async (id: number, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/admin/bundles/${id}`, data);
    return response.data;
  },
  deleteBundle: async (id: number) => {
    const response = await apiClient.delete(`/admin/bundles/${id}`);
    return response.data;
  },

  // Zones
  getZones: async () => {
    const response = await apiClient.get('/admin/zones');
    return response.data;
  },
  createZone: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/admin/zones', data);
    return response.data;
  },
  updateZone: async (id: number, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/admin/zones/${id}`, data);
    return response.data;
  },
  deleteZone: async (id: number) => {
    const response = await apiClient.delete(`/admin/zones/${id}`);
    return response.data;
  },

  // Landmarks
  getLandmarks: async () => {
    const response = await apiClient.get('/admin/landmarks');
    return response.data;
  },
  createLandmark: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/admin/landmarks', data);
    return response.data;
  },
  updateLandmark: async (id: number, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/admin/landmarks/${id}`, data);
    return response.data;
  },
  deleteLandmark: async (id: number) => {
    const response = await apiClient.delete(`/admin/landmarks/${id}`);
    return response.data;
  },

  // Users
  getUsers: async (params?: { role?: string; page?: number; per_page?: number }) => {
    const response = await apiClient.get('/admin/users', { params });
    return response.data;
  },
  createUser: async (data: Record<string, unknown>) => {
    const response = await apiClient.post('/admin/users', data);
    return response.data;
  },
  updateUser: async (id: number, data: Record<string, unknown>) => {
    const response = await apiClient.put(`/admin/users/${id}`, data);
    return response.data;
  },
  deleteUser: async (id: number) => {
    const response = await apiClient.delete(`/admin/users/${id}`);
    return response.data;
  },
  // POST /admin/users/{user}/managers (AdminUserController::addAsManager) — le backend n'accepte
  // qu'un client ou un admin (sinon 400), exige zone_id, et répond 400 si le compte est déjà manager.
  promoteAsManager: async (id: number, data: { zone_id: number; heure_debut?: string; heure_fin?: string }) => {
    const response = await apiClient.post(`/admin/users/${id}/managers`, data);
    return response.data;
  },

  // POST /admin/assign - ManagerAssignmentController, la meme méthode que côté manager, réutilisée
  // pour l'administration (route déclarée dans le groupe `role:admin`). Trois refus possibles, tous
  // en 422 : `Ce livreur n'est pas disponible.` (middleware `available`), `Le livreur n'appartient
  // pas à cette zone.` et `Commande et livreur ne sont pas dans la même zone.` Le succès renvoie la
  // commande fraîche (`{ data: Commande }`, modèle brut) et crée la conversation client-livreur.
  assignLivreur: async (orderId: number, livreurId: number) => {
    const response = await apiClient.post('/admin/assign', { order_id: orderId, livreur_id: livreurId });
    return response.data;
  },

  // Budget proposals (Négociations)
  getProposals: async (params?: { statut?: string; page?: number }) => {
    const response = await apiClient.get('/admin/budget-proposals', { params });
    return response.data;
  },
  respondProposal: async (
    id: number,
    data: { decision: 'accepte' | 'refuse'; admin_response?: string; landmark_id?: number }
  ) => {
    const response = await apiClient.patch(`/admin/budget-proposals/${id}`, data);
    return response.data;
  },

  // Orders
  getOrders: async (params?: { statut?: string; zone_id?: number; page?: number }) => {
    const response = await apiClient.get('/admin/orders', { params });
    return response.data;
  },
  updateOrderStatus: async (orderId: number, statut: string) => {
    const response = await apiClient.patch(`/admin/orders/${orderId}/status`, { statut });
    return response.data;
  },

  // Paiements — GET /admin/payments (PaymentController::listAllPayments) et
  // GET /admin/clients/payments (listClientPayments). Ces deux routes renvoient le MODÈLE BRUT
  // (`response()->json(['success' => true, 'data' => $payments])`) : ni ressource, ni pagination,
  // ni filtre. Attention : le modèle porte `fedapay_token`, que l'interface ne lit jamais.
  getPayments: async () => {
    const response = await apiClient.get('/admin/payments');
    return response.data;
  },
  getClientsPayments: async () => {
    const response = await apiClient.get('/admin/clients/payments');
    return response.data;
  },

  // Dashboard & Audit Logs
  getDashboard: async () => {
    const response = await apiClient.get('/admin/dashboard');
    return response.data;
  },
  getAuditLogs: async (params?: { action?: string; user_id?: number; from?: string; page?: number }) => {
    const response = await apiClient.get('/admin/audit-logs', { params });
    return response.data;
  },
};
