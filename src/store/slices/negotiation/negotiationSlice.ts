import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type NegotiationStatus = 'idle' | 'pending' | 'accepted' | 'counter_offer' | 'rejected' | 'expired';

export interface NegotiationItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  vendorName?: string;
  originalPrice: number;
  proposedPrice: number;
  counterPrice?: number;
  minPrice: number;
  /** Quantité proposée (backend `quantite`). */
  quantite?: number;
  /** Réponse/justification de l'admin (backend `admin_response`). */
  adminResponse?: string;
  status: NegotiationStatus;
  createdAt: string;
}

interface NegotiationState {
  activeNegotiations: Record<string, NegotiationItem>; // key: productId
  history: NegotiationItem[];
}

const initialState: NegotiationState = {
  activeNegotiations: {},
  history: [],
};

const negotiationSlice = createSlice({
  name: 'negotiation',
  initialState,
  reducers: {
    setProposals(state, action: PayloadAction<NegotiationItem[]>) {
      state.history = action.payload;
      state.activeNegotiations = Object.fromEntries(action.payload.map((n) => [n.productId, n]));
    },
    submitOffer(
      state,
      action: PayloadAction<{
        productId: string;
        productName: string;
        productImage?: string;
        vendorName?: string;
        originalPrice: number;
        proposedPrice: number;
        minPrice: number;
      }>
    ) {
      const { productId, productName, productImage, vendorName, originalPrice, proposedPrice, minPrice } = action.payload;

      // L'offre part à l'administrateur (POST /budget-proposals, CDC §4.1 : il accepte ou refuse) : elle
      // reste « en attente » jusqu'à sa réponse réelle (GET /budget-proposals + temps réel
      // budget.responded). Plus de réponse inventée côté front (acceptée / contre-offre / refusée).
      const status: NegotiationStatus = 'pending';
      const counterPrice: number | undefined = undefined;

      const item: NegotiationItem = {
        id: `neg_${Date.now()}`,
        productId,
        productName,
        productImage,
        vendorName: vendorName ?? '',
        originalPrice,
        proposedPrice,
        counterPrice,
        minPrice,
        status,
        createdAt: 'À l’instant',
      };

      state.activeNegotiations[productId] = item;
      const existingIndex = state.history.findIndex((h) => h.productId === productId);
      if (existingIndex >= 0) {
        state.history[existingIndex] = item;
      } else {
        state.history.unshift(item);
      }
    },
    acceptCounterOffer(state, action: PayloadAction<{ productId: string }>) {
      const { productId } = action.payload;
      const neg = state.activeNegotiations[productId];
      if (neg && neg.counterPrice) {
        neg.status = 'accepted';
        neg.proposedPrice = neg.counterPrice;
      }
      const histItem = state.history.find((h) => h.productId === productId);
      if (histItem && histItem.counterPrice) {
        histItem.status = 'accepted';
        histItem.proposedPrice = histItem.counterPrice;
      }
    },
    cancelNegotiation(state, action: PayloadAction<{ productId: string }>) {
      delete state.activeNegotiations[action.payload.productId];
      state.history = state.history.filter((h) => h.productId !== action.payload.productId);
    },
  },
});

export const { setProposals, submitOffer, acceptCounterOffer, cancelNegotiation } = negotiationSlice.actions;

export default negotiationSlice.reducer;
