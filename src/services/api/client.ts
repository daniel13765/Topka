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

// Intercepteur pour intercepter les erreurs 401 et 423
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 423 + code `two_fa_required` (App\Http\Middleware\EnsureTwoFA) : le token Sanctum est valide,
    // mais le second facteur n'a pas été saisi dans cette session et TOUTE route authentifiée reste
    // verrouillée. Le code à 6 chiffres part par e-mail (TwoFAService, valable 10 min) : on rend
    // l'adresse disponible à /verification-2fa et l'evenement ci-dessous fait la navigation.
    if (error.response?.status === 423 && error.response?.data?.code === 'two_fa_required') {
      try {
        const email = JSON.parse(localStorage.getItem('tokpa_user') ?? '{}')?.email;
        if (email && !localStorage.getItem('tokpa_pending_email')) {
          localStorage.setItem('tokpa_pending_email', String(email));
        }
      } catch {
        // `tokpa_user` illisible : /verification-2fa renverra de lui-même vers /connexion
      }
      window.dispatchEvent(new Event('tokpa:2fa-required'));
      return Promise.reject(error);
    }
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
