import { baseApi } from './baseApi';
import type { Landmark, ManagerZone } from '../../types/zones';

export interface CreateZonePayload {
  name: string;
  deliveryFee: number;
  managerName: string;
  description: string;
}

export interface UpdateZonePayload {
  id: string;
  changes: Partial<Pick<ManagerZone, 'name' | 'deliveryFee' | 'managerName' | 'description'>>;
}

export interface AddLandmarkPayload {
  zoneId: string;
  name: string;
}

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
const pause = (duration = 380) => new Promise((resolve) => window.setTimeout(resolve, duration));

let mockZones: ManagerZone[] = [
  {
    id: 'akpakpa',
    name: 'Akpakpa',
    status: 'active',
    managers: 3,
    drivers: 12,
    deliveryFee: 500,
    managerName: 'Moussa Soglo (Zone Manager)',
    description: 'Zone commerciale dense incluant le grand marché. Accès facile via le pont, mais forte congestion aux heures de pointe.',
    landmarks: [
      { id: 'ak-1', name: 'Carrefour Cadjehoun' },
      { id: 'ak-2', name: 'Pharmacie Sainte-Marie' },
      { id: 'ak-3', name: 'Marché Dantokpa' },
      { id: 'ak-4', name: 'École primaire CEG' },
      { id: 'ak-5', name: 'Place Bulgarie' },
      { id: 'ak-6', name: 'Pont de Porto-Novo' },
      { id: 'ak-7', name: 'Station JNP' },
      { id: 'ak-8', name: 'Carrefour PK3' },
    ],
    polygon: '420,135 510,105 560,155 530,240 440,220 402,170',
    labelX: 480,
    labelY: 170,
  },
  {
    id: 'cadjehoun',
    name: 'Cadjehoun',
    status: 'active',
    managers: 2,
    drivers: 8,
    deliveryFee: 400,
    managerName: 'Moussa Soglo (Zone Manager)',
    description: 'Zone résidentielle et administrative proche de l’aéroport, desservie par des points de repère très fréquentés.',
    landmarks: [
      { id: 'ca-1', name: 'Aéroport de Cotonou' },
      { id: 'ca-2', name: 'Place de l’Étoile Rouge' },
      { id: 'ca-3', name: 'Pharmacie Cadjehoun' },
      { id: 'ca-4', name: 'Carrefour Haie Vive' },
      { id: 'ca-5', name: 'Église Saint-Michel' },
    ],
    polygon: '180,88 275,55 330,125 282,195 190,180 150,125',
    labelX: 238,
    labelY: 128,
  },
  {
    id: 'fidjrosse',
    name: 'Fidjrossè',
    status: 'active',
    managers: 4,
    drivers: 15,
    deliveryFee: 600,
    managerName: 'Aminata Hounkpatin (Zone Manager)',
    description: 'Zone littorale avec une forte demande le soir et des trajets plus longs vers les quartiers résidentiels.',
    landmarks: [
      { id: 'fi-1', name: 'Plage de Fidjrossè' },
      { id: 'fi-2', name: 'Carrefour Houéyiho' },
      { id: 'fi-3', name: 'Pharmacie Les Cocotiers' },
      { id: 'fi-4', name: 'École La Fontaine' },
      { id: 'fi-5', name: 'Route des Pêches' },
      { id: 'fi-6', name: 'Carrefour Vodjè' },
      { id: 'fi-7', name: 'Marché de Fidjrossè' },
      { id: 'fi-8', name: 'Hôtel du Lac' },
      { id: 'fi-9', name: 'Station JNP' },
      { id: 'fi-10', name: 'Rond-point Erevan' },
      { id: 'fi-11', name: 'Carrefour Agla' },
      { id: 'fi-12', name: 'Clinique Les Grâces' },
    ],
    polygon: '300,65 375,45 425,105 395,160 315,145 280,100',
    labelX: 350,
    labelY: 100,
  },
];

export const zonesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listZones: builder.query<ManagerZone[], void>({
      providesTags: ['User'],
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause();
          return { data: mockZones.map((zone) => ({ ...zone, landmarks: zone.landmarks.map((landmark) => ({ ...landmark })) })) };
        }
        const response = await baseQuery({ url: '/manager/zones', method: 'GET' });
        if (response.error) return { error: response.error };
        return { data: response.data as ManagerZone[] };
      },
    }),
    createZone: builder.mutation<ManagerZone, CreateZonePayload>({
      invalidatesTags: ['User'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(520);
          const zone: ManagerZone = {
            id: `zone-${Date.now()}`,
            name: payload.name,
            status: 'active',
            managers: 1,
            drivers: 0,
            deliveryFee: payload.deliveryFee,
            managerName: payload.managerName,
            description: payload.description,
            landmarks: [],
            polygon: '80,270 150,235 225,260 215,325 125,340',
            labelX: 150,
            labelY: 290,
          };
          mockZones = [...mockZones, zone];
          return { data: zone };
        }
        const response = await baseQuery({ url: '/manager/zones', method: 'POST', body: payload });
        if (response.error) return { error: response.error };
        return { data: response.data as ManagerZone };
      },
    }),
    updateZone: builder.mutation<ManagerZone, UpdateZonePayload>({
      invalidatesTags: ['User'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(480);
          mockZones = mockZones.map((zone) => zone.id === payload.id ? { ...zone, ...payload.changes } : zone);
          const zone = mockZones.find((item) => item.id === payload.id);
          if (!zone) return { error: { status: 404, data: { message: 'Zone introuvable.' } } };
          return { data: zone };
        }
        const response = await baseQuery({ url: `/manager/zones/${payload.id}`, method: 'PATCH', body: payload.changes });
        if (response.error) return { error: response.error };
        return { data: response.data as ManagerZone };
      },
    }),
    addLandmark: builder.mutation<Landmark, AddLandmarkPayload>({
      invalidatesTags: ['User'],
      async queryFn(payload, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(350);
          const landmark = { id: `landmark-${Date.now()}`, name: payload.name };
          mockZones = mockZones.map((zone) => zone.id === payload.zoneId ? { ...zone, landmarks: [...zone.landmarks, landmark] } : zone);
          return { data: landmark };
        }
        const response = await baseQuery({ url: `/manager/zones/${payload.zoneId}/landmarks`, method: 'POST', body: { name: payload.name } });
        if (response.error) return { error: response.error };
        return { data: response.data as Landmark };
      },
    }),
  }),
});

export const {
  useListZonesQuery,
  useCreateZoneMutation,
  useUpdateZoneMutation,
  useAddLandmarkMutation,
} = zonesApi;
