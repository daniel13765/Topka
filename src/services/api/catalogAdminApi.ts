import { baseApi } from './baseApi';
import { mockProducts } from '../../data/mockProducts';
import type { AdminCatalogProduct, AdminItemStatus, CatalogAdminSnapshot, StandalonePack } from '../../types/catalogAdmin';

export type ProductFormPayload = Omit<AdminCatalogProduct, 'id' | 'updatedAt'>;
export type PackFormPayload = Omit<StandalonePack, 'id' | 'updatedAt'>;

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
const pause = (duration = 360) => new Promise((resolve) => window.setTimeout(resolve, duration));

const seededProducts: AdminCatalogProduct[] = mockProducts.map((product, index) => ({
  ...product,
  sku: `TOK-${String(product.id).padStart(4, '0')}`,
  stock: [48, 26, 13, 18, 72, 34, 9, 42, 21, 16, 28, 37, 0][index] ?? 20,
  status: product.available === false ? 'archived' : index % 5 === 3 ? 'draft' : 'active',
  updatedAt: index % 2 === 0 ? 'Aujourd’hui, 09:42' : 'Hier, 16:18',
}));

let mockProductsAdmin = seededProducts;
let mockPacks: StandalonePack[] = [
  {
    id: 101,
    name: 'Pack Petit-déjeuner béninois',
    sku: 'PACK-0101',
    category: 'Packs repas',
    price: 7_500,
    compareAtPrice: 8_400,
    stock: 24,
    status: 'active',
    image: '/images/brand/tropical-still-life.jpg',
    description: 'Un pack autonome prêt à commander pour commencer la journée : fruits, boisson et accompagnement local.',
    unit: 'le pack',
    updatedAt: 'Aujourd’hui, 10:26',
  },
  {
    id: 102,
    name: 'Pack Sauce maison',
    sku: 'PACK-0102',
    category: 'Packs cuisine',
    price: 5_900,
    compareAtPrice: 6_600,
    stock: 18,
    status: 'active',
    image: '/images/products/tomate.jpg',
    description: 'Le nécessaire de base pour préparer une sauce maison avec des produits frais sélectionnés.',
    unit: 'le pack',
    updatedAt: 'Hier, 14:08',
  },
  {
    id: 103,
    name: 'Pack Découverte du marché',
    sku: 'PACK-0103',
    category: 'Sélection TOKPa',
    price: 12_500,
    compareAtPrice: 14_000,
    stock: 6,
    status: 'draft',
    image: '/images/brand/tokpa-market-illustration-alt.jpg',
    description: 'Une offre découverte en cours de préparation pour faire connaître les producteurs partenaires.',
    unit: 'le pack',
    updatedAt: '12 sept. 2026',
  },
];

function cloneSnapshot(): CatalogAdminSnapshot {
  return {
    products: mockProductsAdmin.map((product) => ({ ...product })),
    packs: mockPacks.map((pack) => ({ ...pack })),
  };
}

function error(message: string, status = 400) {
  return { error: { status, data: { message } } } as const;
}

export const catalogAdminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCatalogAdmin: builder.query<CatalogAdminSnapshot, void>({
      providesTags: ['Product'],
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause();
          return { data: cloneSnapshot() };
        }
        const response = await baseQuery({ url: '/admin/catalog', method: 'GET' });
        if (response.error) return { error: response.error };
        return { data: response.data as CatalogAdminSnapshot };
      },
    }),
    createCatalogProduct: builder.mutation<AdminCatalogProduct, ProductFormPayload>({
      invalidatesTags: ['Product'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(480);
          const id = Math.max(...mockProductsAdmin.map((product) => product.id), 0) + 1;
          const product: AdminCatalogProduct = { ...payload, id, updatedAt: 'À l’instant' };
          mockProductsAdmin = [product, ...mockProductsAdmin];
          return { data: { ...product } };
        }
        const response = await baseQuery({ url: '/admin/catalog/products', method: 'POST', body: payload });
        if (response.error) return { error: response.error };
        return { data: response.data as AdminCatalogProduct };
      },
    }),
    updateCatalogProduct: builder.mutation<AdminCatalogProduct, { id: number; changes: Partial<ProductFormPayload> }>({
      invalidatesTags: ['Product'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(420);
          const current = mockProductsAdmin.find((product) => product.id === payload.id);
          if (!current) return error('Produit introuvable.', 404);
          const updated = { ...current, ...payload.changes, updatedAt: 'À l’instant' };
          mockProductsAdmin = mockProductsAdmin.map((product) => product.id === payload.id ? updated : product);
          return { data: { ...updated } };
        }
        const response = await baseQuery({ url: `/admin/catalog/products/${payload.id}`, method: 'PATCH', body: payload.changes });
        if (response.error) return { error: response.error };
        return { data: response.data as AdminCatalogProduct };
      },
    }),
    archiveCatalogProduct: builder.mutation<AdminCatalogProduct, { id: number; status: AdminItemStatus }>({
      invalidatesTags: ['Product'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(320);
          const current = mockProductsAdmin.find((product) => product.id === payload.id);
          if (!current) return error('Produit introuvable.', 404);
          const updated = { ...current, status: payload.status, available: payload.status === 'active', updatedAt: 'À l’instant' };
          mockProductsAdmin = mockProductsAdmin.map((product) => product.id === payload.id ? updated : product);
          return { data: { ...updated } };
        }
        const response = await baseQuery({ url: `/admin/catalog/products/${payload.id}`, method: 'PATCH', body: { status: payload.status } });
        if (response.error) return { error: response.error };
        return { data: response.data as AdminCatalogProduct };
      },
    }),
    createCatalogPack: builder.mutation<StandalonePack, PackFormPayload>({
      invalidatesTags: ['Product'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(480);
          const id = Math.max(...mockPacks.map((pack) => pack.id), 100) + 1;
          const pack: StandalonePack = { ...payload, id, updatedAt: 'À l’instant' };
          mockPacks = [pack, ...mockPacks];
          return { data: { ...pack } };
        }
        const response = await baseQuery({ url: '/admin/catalog/packs', method: 'POST', body: payload });
        if (response.error) return { error: response.error };
        return { data: response.data as StandalonePack };
      },
    }),
    updateCatalogPack: builder.mutation<StandalonePack, { id: number; changes: Partial<PackFormPayload> }>({
      invalidatesTags: ['Product'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(420);
          const current = mockPacks.find((pack) => pack.id === payload.id);
          if (!current) return error('Pack introuvable.', 404);
          const updated = { ...current, ...payload.changes, updatedAt: 'À l’instant' };
          mockPacks = mockPacks.map((pack) => pack.id === payload.id ? updated : pack);
          return { data: { ...updated } };
        }
        const response = await baseQuery({ url: `/admin/catalog/packs/${payload.id}`, method: 'PATCH', body: payload.changes });
        if (response.error) return { error: response.error };
        return { data: response.data as StandalonePack };
      },
    }),
    archiveCatalogPack: builder.mutation<StandalonePack, { id: number; status: AdminItemStatus }>({
      invalidatesTags: ['Product'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(320);
          const current = mockPacks.find((pack) => pack.id === payload.id);
          if (!current) return error('Pack introuvable.', 404);
          const updated = { ...current, status: payload.status, updatedAt: 'À l’instant' };
          mockPacks = mockPacks.map((pack) => pack.id === payload.id ? updated : pack);
          return { data: { ...updated } };
        }
        const response = await baseQuery({ url: `/admin/catalog/packs/${payload.id}`, method: 'PATCH', body: { status: payload.status } });
        if (response.error) return { error: response.error };
        return { data: response.data as StandalonePack };
      },
    }),
  }),
});

export const {
  useListCatalogAdminQuery,
  useCreateCatalogProductMutation,
  useUpdateCatalogProductMutation,
  useArchiveCatalogProductMutation,
  useCreateCatalogPackMutation,
  useUpdateCatalogPackMutation,
  useArchiveCatalogPackMutation,
} = catalogAdminApi;
