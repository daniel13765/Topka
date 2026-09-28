import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Le test rend la page elle-même (chemin d'amorçage : profil non encore chargé) dans un environnement
 * node, sans DOM : il prouve que le graphe d'imports, le layout et l'état de chargement sont valides.
 * Les règles métier de l'écran sont couvertes dans `livreur-settings-rules.test.ts`.
 */
vi.mock('../src/components/layout/livreur/LivreurLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-chrome="livreur">{children}</div>,
}));
vi.mock('../src/components/shared/LangToggle', () => ({ default: () => <button type="button">Langue</button> }));
vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'fr',
    setLanguage: vi.fn(),
    toggleLanguage: vi.fn(),
    t: (cle: string) => cle,
    isFr: true,
    isEn: false,
  }),
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn(), Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../src/services/api', () => ({
  authApi: { getProfile: vi.fn(), updateProfile: vi.fn(), changePassword: vi.fn(), logout: vi.fn() },
  catalogApi: { getZones: vi.fn() },
  livreurApi: { getHistory: vi.fn(), getDeliveries: vi.fn() },
}));

import LivreurSettingsPage from '../src/pages/livreur/parametres/LivreurSettingsPage';

describe('écran Paramètres du livreur : amorçage', () => {
  it('affiche l’en-tête et l’état de chargement avant la réponse de /profile', () => {
    const html = renderToStaticMarkup(<LivreurSettingsPage />);
    expect(html).toContain('Paramètres du compte');
    expect(html).toContain('Espace Livreur \u2022 Préférences opérationnelles');
    expect(html).toContain('Chargement de votre profil…');
    // aucune carte de données tant que le profil n'est pas là : pas de squelette mensonger
    expect(html).not.toContain('Reversement des gains');
    // le switch de disponibilité est bien rendu désactivé
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('Seul un administrateur peut activer ou désactiver un livreur.');
  });
});
