import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import { tx } from '../i18n/tx';
import { jalon, utilisateur, type UtilisateurSession } from '../services/session';

/** Forme de l'utilisateur de session ; le stockage et sa tolérance vivent dans `services/session.ts`. */
export type AuthUser = UtilisateurSession;

/**
 * Hook pour sécuriser les routes nécessitant une authentification Sanctum (Token Bearer)
 */
export function useAuthGuard(redirectTo = '/connexion') {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = jalon();
    const storedUser = utilisateur();

    if (!token) {
      toast.error(tx('Veuillez vous connecter pour accéder à cette page.'));
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);
      navigate({ to: redirectTo });
      return;
    }

    setIsAuthenticated(true);
    // `utilisateur()` a deja tolere le JSON illisible : null = pas d'utilisateur en memoire, et
    // l'ecran s'appuie alors sur ses propres appels (GET /profile) plutot que sur un objet invente.
    setUser(storedUser);
    setIsLoading(false);
  }, [navigate, redirectTo]);

  return { isAuthenticated, user, isLoading };
}
