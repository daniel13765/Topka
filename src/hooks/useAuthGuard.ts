import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import { tx } from '../i18n/tx';

export interface AuthUser {
  id?: number;
  nom?: string;
  prenom?: string;
  nom_complet?: string;
  email?: string;
  telephone?: string;
  role?: string | { id: number; nom: string };
  statut?: string;
}

/**
 * Hook pour sécuriser les routes nécessitant une authentification Sanctum (Token Bearer)
 */
export function useAuthGuard(redirectTo = '/connexion') {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem('tokpa_token');
    const storedUser = localStorage.getItem('tokpa_user');

    if (!token) {
      toast.error(tx('Veuillez vous connecter pour accéder à cette page.'));
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);
      navigate({ to: redirectTo });
      return;
    }

    setIsAuthenticated(true);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse tokpa_user:', e);
      }
    }
    setIsLoading(false);
  }, [navigate, redirectTo]);

  return { isAuthenticated, user, isLoading };
}
