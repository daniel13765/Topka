import { baseApi } from './baseApi';
import type { Negotiation, NegotiationStatus } from '../../types/domain';

export interface CreateNegotiationPayload {
  productId: number;
  productName: string;
  productImage: string;
  seller: string;
  sellerPrice: number;
  minOffer: number;
  quantity: number;
  offer: number;
}

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
const pause = (duration = 520) => new Promise((resolve) => window.setTimeout(resolve, duration));

let mockNegotiations: Negotiation[] = [
  {
    id: 'neg-demo-1',
    productId: 5,
    productName: 'Tomates fraîches locales',
    productImage: '/images/brand/market-fruits.jpg',
    seller: 'Afi Mensah',
    sellerPrice: 450,
    offer: 380,
    quantity: 2,
    status: 'countered',
    sellerOffer: 410,
    updatedAt: 'Il y a 2 h',
  },
  {
    id: 'neg-demo-2',
    productId: 4,
    productName: 'Panier tropical du marché',
    productImage: '/images/brand/tropical-still-life.jpg',
    seller: 'TOKPa Sélection',
    sellerPrice: 6500,
    offer: 5800,
    quantity: 1,
    status: 'accepted',
    sellerOffer: 5800,
    updatedAt: 'Hier',
  },
  {
    id: 'neg-demo-3',
    productId: 6,
    productName: 'Oignons violets',
    productImage: '/images/brand/tropical-still-life.jpg',
    seller: 'Maman Africa Fruits',
    sellerPrice: 800,
    offer: 650,
    quantity: 1,
    status: 'pending',
    updatedAt: 'Il y a 3 jours',
  },
];

const statusByValue: Record<NegotiationStatus, string> = {
  pending: 'En attente du vendeur',
  countered: 'Contre-proposition',
  accepted: 'Offre acceptée',
  rejected: 'Offre refusée',
};

export { statusByValue };

export const negotiationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listNegotiations: builder.query<Negotiation[], void>({
      providesTags: ['Negotiation'],
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(360);
          return { data: mockNegotiations.map((negotiation) => ({ ...negotiation })) };
        }
        const response = await baseQuery({ url: '/negotiations', method: 'GET' });
        if (response.error) return { error: response.error };
        return { data: response.data as Negotiation[] };
      },
    }),
    createNegotiation: builder.mutation<Negotiation, CreateNegotiationPayload>({
      invalidatesTags: ['Negotiation', 'Notification'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(640);
          const negotiation: Negotiation = {
            id: `neg-demo-${Date.now()}`,
            ...payload,
            status: 'pending',
            updatedAt: 'À l’instant',
          };
          mockNegotiations = [negotiation, ...mockNegotiations];
          return { data: negotiation };
        }
        const response = await baseQuery({ url: '/negotiations', method: 'POST', body: payload });
        if (response.error) return { error: response.error };
        return { data: response.data as Negotiation };
      },
    }),
    answerNegotiation: builder.mutation<Negotiation, { id: string; action: 'accept' | 'reject'; offer?: number }>({
      invalidatesTags: ['Negotiation', 'Notification'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(520);
          const status: NegotiationStatus = payload.action === 'accept' ? 'accepted' : 'rejected';
          mockNegotiations = mockNegotiations.map((negotiation) => negotiation.id === payload.id ? { ...negotiation, status, sellerOffer: payload.offer ?? negotiation.sellerOffer, updatedAt: 'À l’instant' } : negotiation);
          const updated = mockNegotiations.find((negotiation) => negotiation.id === payload.id);
          if (!updated) return { error: { status: 404, data: { message: 'Négociation introuvable.' } } };
          return { data: updated };
        }
        const response = await baseQuery({ url: `/negotiations/${payload.id}/answer`, method: 'POST', body: payload });
        if (response.error) return { error: response.error };
        return { data: response.data as Negotiation };
      },
    }),
  }),
});

export const {
  useListNegotiationsQuery,
  useCreateNegotiationMutation,
  useAnswerNegotiationMutation,
} = negotiationsApi;
