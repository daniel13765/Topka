import { apiClient } from './client';

export interface InitPaymentPayload {
  order_id: number;
}

export interface PaymentJson {
  id: number;
  order_id?: number;
  /** `payments.montant` est un `decimal:2` : Laravel le renvoie en chaîne (« 1500.00 »). */
  montant?: number | string;
  methode?: string;
  statut?: 'en_attente' | 'reussi' | 'echoue' | 'rembourse' | string;
  fedapay_ref?: string | null;
  recu_url?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  /* `fedapay_token` existe sur la table mais n'est volontairement pas typé ici : aucun écran ne
     doit l'afficher (PaymentController renvoie le modèle brut, jeton compris). */
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

  // GET /api/payments -> « mes paiements » (PaymentController::listClientPayments, route ajoutée
  // le 02/10/2026, groupe role:client,admin). Aucune pagination côté serveur.
  listMine: async () => {
    const response = await apiClient.get('/payments');
    return response.data;
  },
};
