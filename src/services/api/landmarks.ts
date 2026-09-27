import { apiClient } from './client';

/** PointRepere — exactement le modèle backend (fillable : zone_id, nom, description, latitude, longitude). */
export interface PointRepereItem {
  id?: number;
  user_id?: number;
  nom: string;
  description?: string;
  /** decimal:7 côté backend (peut arriver en string) */
  latitude?: number | string;
  longitude?: number | string;
  zone_id?: number;
}

export const landmarksApi = {
  // GET /api/landmarks -> points de repère de l'utilisateur
  getLandmarks: async () => {
    const response = await apiClient.get('/landmarks');
    return response.data;
  },

  // POST /api/landmarks -> ajouter un point de repère
  createLandmark: async (data: PointRepereItem) => {
    const response = await apiClient.post('/landmarks', data);
    return response.data;
  },

  // DELETE /api/landmarks/{id} -> supprimer un point de repère
  deleteLandmark: async (id: number | string) => {
    const response = await apiClient.delete(`/landmarks/${id}`);
    return response.data;
  },
};
