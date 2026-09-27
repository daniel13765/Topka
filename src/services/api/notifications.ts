import { apiClient } from './client';

export interface ApiNotification {
  id: string | number;
  user_id: number;
  type: string;
  /** Payload backend : {order_id, statut}, {proposal_id, statut, order_id}, {payment_id, order_id}… */
  data: {
    title?: string;
    message?: string;
    [key: string]: unknown;
  };
  /** Non-lue tant que false (backend). */
  lu?: boolean;
  read_at: string | null;
  created_at: string;
}

export const notificationsApi = {
  // GET /api/notifications -> liste paginee des notifications
  getNotifications: async (page = 1) => {
    const response = await apiClient.get('/notifications', { params: { page } });
    return response.data;
  },

  // PATCH /api/notifications/{id}/read -> marquer comme lue
  markRead: async (notificationId: string | number) => {
    const response = await apiClient.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },
};
