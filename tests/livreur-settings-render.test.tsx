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
// Leaflet lit `navigator` au chargement du module : sans ces bouchons, la simple import de la carte
// ferait planter tout test rendu en node (renderToStaticMarkup). Les tuiles ne sont pas le sujet.
vi.mock('leaflet', () => ({ default: { icon: (options: unknown) => options } }));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-carte="osm">{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  Polygon: () => null,
  Popup: ({ children }: { children: ReactNode }) => <div data-pave>{children}</div>,
  Marker: ({ children, position }: { children: ReactNode; position: [number, number] }) => (
    <div data-marqueur={position.join(',')}>{children}</div>
  ),
  useMap: () => ({ panTo: () => undefined }),
}));
vi.mock('../src/services/api', () => ({
  authApi: { getProfile: vi.fn(), updateProfile: vi.fn(), changePassword: vi.fn(), logout: vi.fn() },
  catalogApi: { getZones: vi.fn() },
  livreurApi: { getHistory: vi.fn(), getDeliveries: vi.fn() },
}));

import LivreurSettingsPage from '../src/pages/livreur/parametres/LivreurSettingsPage';
import { Carte } from '../src/components/maps/Carte';
import { CarteZoneGoogle } from '../src/pages/livreur/parametres/CarteZoneGoogle';

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

describe('bloc « Zone & position d’intervention »', () => {
  it('attend la géométrie de zone avant de dessiner quoi que ce soit', () => {
    const html = renderToStaticMarkup(<CarteZoneGoogle zoneId={4} zoneNom="Dantokpa" />);
    // le titre contient un « & » : React l'échappe, on teste donc la partie stable du libellé
    expect(html).toContain('position d’intervention');
    expect(html).toContain('Chargement de la carte de zone…');
    expect(html).toContain('Me localiser');
    // aucun marqueur fantôme : la carte n'est pas rendue pendant le chargement
    expect(html).not.toContain('data-carte');
  });

  it('sans clé Google Maps, la carte bascule sur le repli OpenStreetMap et le dit', () => {
    const html = renderToStaticMarkup(
      <Carte
        marqueurs={[
          { role: 'depart', position: [6.3725, 2.4332], etiquette: 'Marché Dantokpa' },
          { role: 'inconnu' as never, position: [0, 0], etiquette: 'À ignorer' },
        ]}
        trace={[
          [6.3725, 2.4332],
          [6.36, 2.42],
        ]}
        polygone={[[[6.355, 2.415], [6.375, 2.445], [6.36, 2.43]]]}
      />,
    );
    expect(html).toContain('data-carte="osm"');
    expect(html).toContain('data-marqueur="6.3725,2.4332"');
    // le second marqueur est hors contrat (0,0) : il n'est pas posé
    expect(html).not.toContain('À ignorer');
    expect(html).toContain('Google Maps non configuré — repli OpenStreetMap');
  });

});
