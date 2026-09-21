import { baseApi } from './baseApi';
import type { AppNotification } from '../../types/domain';

const initialMockNotifications: AppNotification[] = [
  {
    id: 'notif-order-delivered',
    type: 'order',
    title: 'Commande livrée !',
    message: 'Votre commande #TOK-2847 a été remise à Kossi.',
    relativeTime: 'Il y a 10 min.',
    read: false,
  },
  {
    id: 'notif-promotion-weekend',
    type: 'promotion',
    title: 'Promotion exclusive',
    message: "Profitez de -20% sur les ignames du marché Dantokpa ce weekend. Ne ratez pas l'occasion !",
    relativeTime: 'Il y a 2 h.',
    read: false,
  },
  {
    id: 'notif-security-login',
    type: 'security',
    title: 'Nouvelle connexion',
    message: "Une connexion a été détectée depuis un nouvel appareil à Cotonou, Benin. Si ce n'est pas vous, changez votre mot de passe.",
    relativeTime: 'Ce matin',
    read: false,
  },
  {
    id: 'notif-order-confirmed',
    type: 'order',
    title: 'Commande confirmée',
    message: 'Le vendeur a accepté votre offre pour le pack de tomates. La livraison est en préparation.',
    relativeTime: 'Hier',
    read: true,
  },
  {
    id: 'notif-platform-update',
    type: 'info',
    title: 'Mise à jour TOKPa',
    message: 'Découvrez les nouveaux points de repère dans la zone Akpakpa pour faciliter vos livraisons.',
    relativeTime: '2 jours',
    read: true,
  },
  {
    id: 'notif-negotiation-counter',
    type: 'promotion',
    title: 'Nouvelle contre-proposition',
    message: 'Maman Africa Fruits a répondu à votre offre sur le lot d’ananas Pain de Sucre.',
    relativeTime: '3 jours',
    read: true,
  },
  {
    id: 'notif-delivery-assigned',
    type: 'order',
    title: 'Livreur affecté',
    message: 'Kossi peut maintenant suivre votre commande vers Cadjèhoun.',
    relativeTime: '4 jours',
    read: true,
  },
  {
    id: 'notif-account-secured',
    type: 'security',
    title: 'Compte sécurisé',
    message: 'La vérification en deux étapes est maintenant active sur votre compte.',
    relativeTime: 'La semaine dernière',
    read: true,
  },
];

let mockNotificationStore = initialMockNotifications.map((notification) => ({ ...notification }));
const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';

const pause = (duration = 380) => new Promise((resolve) => window.setTimeout(resolve, duration));

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listNotifications: builder.query<AppNotification[], void>({
      providesTags: ['Notification'],
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause();
          return { data: mockNotificationStore.map((notification) => ({ ...notification })) };
        }

        const response = await baseQuery({ url: '/notifications', method: 'GET' });
        if (response.error) return { error: response.error };
        return { data: response.data as AppNotification[] };
      },
    }),
    markAllNotificationsRead: builder.mutation<{ success: boolean }, void>({
      invalidatesTags: ['Notification'],
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(240);
          mockNotificationStore = mockNotificationStore.map((notification) => ({ ...notification, read: true }));
          return { data: { success: true } };
        }

        const response = await baseQuery({ url: '/notifications/read-all', method: 'POST' });
        if (response.error) return { error: response.error };
        return { data: { success: (response.data as { success?: boolean } | undefined)?.success ?? true } };
      },
    }),
    markNotificationRead: builder.mutation<{ success: boolean }, string>({
      invalidatesTags: ['Notification'],
      async queryFn(id, _api, _extraOptions, baseQuery) {
        if (useMocks) {
          await pause(180);
          mockNotificationStore = mockNotificationStore.map((notification) => notification.id === id ? { ...notification, read: true } : notification);
          return { data: { success: true } };
        }

        const response = await baseQuery({ url: `/notifications/${id}/read`, method: 'POST' });
        if (response.error) return { error: response.error };
        return { data: { success: (response.data as { success?: boolean } | undefined)?.success ?? true } };
      },
    }),
  }),
});

export const {
  useListNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} = notificationsApi;
