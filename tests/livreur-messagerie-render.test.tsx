import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Rendu de la page elle-même (amorçage, sans effet) dans l'environnement node des tests : il prouve
 * que le graphe d'imports, le chrome livreur et l'état vide sont valides. La lecture des fils, les
 * aperçus et le composeur sont couverts par `livreur-messagerie.test.ts`.
 */
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../src/services/realtime/echo', () => ({ listenPrivate: () => ({ stop: () => undefined }) }));
vi.mock('../src/components/layout/livreur/LivreurLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-chrome="livreur">{children}</div>,
}));
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
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('../src/services/api', () => ({
  chatApi: { getConversations: vi.fn(), getMessages: vi.fn(), sendMessage: vi.fn() },
  authApi: { getProfile: vi.fn() },
}));

import LivreurMessagingPage from '../src/pages/livreur/messagerie/LivreurMessagingPage';

describe('écran Messagerie du livreur : amorçage', () => {
  it('affiche la liste en chargement et aucune conversation sélectionnée', () => {
    const html = renderToStaticMarkup(<LivreurMessagingPage />);
    expect(html).toContain('Messagerie');
    expect(html).toContain('Rechercher…');
    expect(html).toContain('Aucune conversation sélectionnée');
    // le bouton « nouvelle conversation » de la maquette existe, mais reste fermé (aucune route)
    expect(html).toContain('disabled');
    expect(html).toContain('Aucune route de création de conversation');
    // aucun fantôme : ni nom de client, ni aperçu, avant la réponse de l'API
    expect(html).not.toContain('Amina');
    expect(html).not.toContain('Écrire un message…');
  });
});
