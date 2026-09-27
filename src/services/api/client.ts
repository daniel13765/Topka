import axios from 'axios';

// Base URL vers l'API Laravel (default: http://localhost:8000/api ou variable d'environnement VITE_API_BASE_URL)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000,
});

// Intercepteur pour injecter le token Sanctum Bearer s'il existe
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tokpa_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur pour intercepter les erreurs 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadSession = !!localStorage.getItem('tokpa_token');
      localStorage.removeItem('tokpa_token');
      localStorage.removeItem('tokpa_user');
      // Session expirée ou révoquée (et pas un simple visiteur) : le panier et le temps réel se
      // débranchent (SystemBridge), et la garde du router renvoie vers /connexion (routes/router.tsx).
      if (hadSession) {
        window.dispatchEvent(new Event('tokpa:auth-changed'));
        window.dispatchEvent(new Event('tokpa:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);
