export interface CheckoutRequest {
  orderId: number;
  amount: number;
  currency?: 'XOF';
}

export interface CheckoutResult {
  transactionId: string;
  redirectUrl: string;
}

/**
 * Le paiement réel doit être créé et confirmé par Laravel.
 * Cette fonction sert de contrat frontend jusqu'à l'ajout de l'endpoint backend.
 */
export async function createFedaPayCheckout(_request: CheckoutRequest): Promise<CheckoutResult> {
  throw new Error('Le checkout FedaPay sera activé lorsque l’API Laravel sera disponible.');
}
