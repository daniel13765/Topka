import { apiClient } from './client';

export interface CreateProposalPayload {
  product_id: number;
  prix_propose: number;
  quantite?: number;
}

export const negotiationApi = {
  // GET /api/budget-proposals -> mes propositions
  getProposals: async (page = 1) => {
    const response = await apiClient.get('/budget-proposals', { params: { page } });
    return response.data;
  },

  // POST /api/budget-proposals -> envoyer une offre de prix
  createProposal: async (payload: CreateProposalPayload) => {
    const response = await apiClient.post('/budget-proposals', payload);
    return response.data;
  },

  // PUT /api/budget-proposals/{id} -> modifier une offre
  updateProposal: async (id: number | string, payload: CreateProposalPayload) => {
    const response = await apiClient.put(`/budget-proposals/${id}`, payload);
    return response.data;
  },
};
