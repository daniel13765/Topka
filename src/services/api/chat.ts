import { apiClient } from './client';

export interface ConversationItem {
  id: number;
  order_id: number;
  client_id: number;
  livreur_id: number;
  created_at: string;
  updated_at: string;
  order?: Record<string, unknown>;
}

export interface MessageItem {
  id: number;
  conversation_id: number;
  sender_id: number;
  contenu: string;
  lu: boolean;
  created_at: string;
  sender?: {
    id: number;
    nom: string;
    prenom: string;
    nom_complet: string;
  };
}

export const chatApi = {
  // GET /api/conversations -> liste des conversations
  getConversations: async () => {
    const response = await apiClient.get<{ data: ConversationItem[] }>('/conversations');
    return response.data;
  },

  // GET /api/conversations/{id}/messages -> messages d'une conversation
  getMessages: async (conversationId: number | string, page = 1) => {
    const response = await apiClient.get(`/conversations/${conversationId}/messages`, {
      params: { page },
    });
    return response.data;
  },

  // POST /api/conversations/{id}/messages -> envoyer un message
  sendMessage: async (conversationId: number | string, contenu: string) => {
    const response = await apiClient.post<{ data: MessageItem }>(
      `/conversations/${conversationId}/messages`,
      { contenu }
    );
    return response.data;
  },
};
