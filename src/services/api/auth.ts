import { apiClient } from './client';
import { initEcho, shutdownEcho } from '../realtime/echo';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  password: string;
  role?: 'client' | 'manager' | 'livreur' | 'admin' | 'super_admin';
  quartier?: string;
  zone_id?: number;
  heure_debut?: string;
  heure_fin?: string;
  documents?: unknown[];
}

export interface Verify2FAPayload {
  email: string;
  code: string;
}

export interface UserProfile {
  id: number;
  nom: string;
  prenom: string;
  nom_complet: string;
  email: string;
  telephone: string;
  image_profil?: string;
  id_role: number;
  role?: {
    id: number;
    nom: string;
    permissions?: string[];
  };
  statut: string;
  stats?: {
    commandes_effectuees?: number;
    points_repere_enregistres?: number;
  };
  profil?: Record<string, unknown>;
}

export const authApi = {
  // POST /api/auth/login -> declenche l'envoi du code 2FA
  login: async (payload: LoginPayload) => {
    const response = await apiClient.post('/auth/login', payload);
    return response.data;
  },

  // POST /api/auth/verify-2fa -> valide le code OTP et retourne le token Sanctum
  verify2fa: async (payload: Verify2FAPayload) => {
    const response = await apiClient.post('/auth/verify-2fa', payload);
    if (response.data?.token) {
      localStorage.setItem('tokpa_token', response.data.token);
      // Laravel peut renvoyer une JsonResource directement ou sous une enveloppe `data`.
      // On stocke toujours l'objet utilisateur lui-même afin que currentRole() puisse
      // calculer correctement l'espace de destination après la 2FA.
      const rawUser = response.data.user;
      const user = rawUser?.data ?? rawUser;
      localStorage.setItem('tokpa_user', JSON.stringify(user));
      // Connexion réussie → on branche le temps réel Reverb (canaux privés)
      // et on notifie le SystemBridge (panier serveur + notifications).
      initEcho();
      window.dispatchEvent(new Event('tokpa:auth-changed'));
    }
    return response.data;
  },

  // POST /api/auth/register -> creation de compte et envoi 2FA
  register: async (payload: RegisterPayload) => {
    const response = await apiClient.post('/auth/register', payload);
    return response.data;
  },

  // POST /api/auth/resend-2fa -> renvoi du code 2FA
  resend2fa: async (email: string) => {
    const response = await apiClient.post('/auth/resend-2fa', { email });
    return response.data;
  },

  // GET /api/profile -> profil utilisateur authentifie
  getProfile: async () => {
    const response = await apiClient.get('/profile');
    return response.data;
  },

  // PUT /api/profile -> mise a jour profil
  updateProfile: async (data: Partial<UserProfile> & Record<string, unknown>) => {
    const response = await apiClient.put('/profile', data);
    return response.data;
  },

  // GET /api/dashboard -> tableau de bord minimal (F-21), filtre selon le role :
  // { commandes, en_cours, ca } — ca renseigne pour l'admin uniquement (null sinon)
  getDashboard: async (): Promise<{ commandes: number; en_cours: number; ca: number | string | null }> => {
    const response = await apiClient.get('/dashboard');
    return response.data;
  },

  // POST /api/auth/change-password -> changement de mot de passe
  changePassword: async (payload: { current_password: string; new_password: string; new_password_confirmation: string }) => {
    const response = await apiClient.post('/auth/change-password', payload);
    return response.data;
  },

  // POST /api/auth/forgot-password -> mot de passe oublie
  forgotPassword: async (email: string) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  // POST /api/auth/reset-password -> reinitialisation mot de passe
  resetPassword: async (payload: { email: string; token: string; password: string; password_confirmation: string }) => {
    const response = await apiClient.post('/auth/reset-password', payload);
    return response.data;
  },

  // POST /api/auth/logout -> deconnexion
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('tokpa_token');
      localStorage.removeItem('tokpa_user');
      shutdownEcho();
      window.dispatchEvent(new Event('tokpa:auth-changed'));
    }
  },
};
