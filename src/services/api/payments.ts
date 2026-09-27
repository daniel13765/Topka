import { apiClient } from './client';

export interface InitPaymentPayload {
  order_id: number;
}

export interface PaymentJson {
  id: number;
  order_id?: number;
  montant?: number;
  methode?: string;
  statut?: 'en_attente' | 'reussi' | 'echoue' | 'rembourse' | string;
  fedapay_ref?: string | null;
  recu_url?: string | null;
  paid_at?: string | null;
}

export interface InitPaymentResponse {
  payment?: PaymentJson;
  token?: string | null;
  redirect_url?: string | null;
  currency?: string;
}

export const paymentsApi = {
  // POST /api/payments/init -> initialise le paiement FedaPay
  initPayment: async (payload: InitPaymentPayload) => {
    const response = await apiClient.post('/payments/init', payload);
    return response.data;
  },

  // GET /api/payments/{id} -> détails du paiement
  getPayment: async (id: number | string) => {
    const response = await apiClient.get(`/payments/${id}`);
    return response.data;
  },
};
