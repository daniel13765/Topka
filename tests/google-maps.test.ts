import { beforeEach, describe, expect, it, vi } from 'vitest';

// `livreurData` tire l'API du dépôt : sans ce mock, la chaîne d'imports (axios, react-hot-toast)
// casse le rendu node du test. Convention identique à tests/livreur-data.test.ts.
vi.mock('../src/services/api', () => ({
  livreurApi: { getDeliveries: vi.fn(), getHistory: vi.fn() },
  catalogApi: { getZones: vi.fn() },
  authApi: { getProfile: vi.fn() },
}));

import { configTrace, optionsCarte, positionGoogle, stylePolygone } from '../src/components/maps/carteGoogleOptions';
import { dataUriMarqueur, svgMarqueur } from '../src/components/maps/marqueurIcones';
import { positionExploitable } from '../src/components/maps/carteTypes';
import {
  fetchLivreurProfile,
  fetchZonesGeo,
  forgetLivreurProfile,
  forgetZonesGeo,
  normaliserNom,
  resoudreZoneId,
  zoneCorrespond,
  type ZoneGeo,
} from '../src/pages/livreur/livreurData';
import { authApi, catalogApi } from '../src/services/api';
import {
  centrePolygone,
  etatGoogleMaps,
  estValide,
  googleMapsConfigure,
  normaliserPolygone,
  normaliserSommet,
  urlSdkGoogleMaps,
} from '../src/utils/googleMaps';

describe('urlSdkGoogleMaps', () => {
  it('pointe sur l’hôte officiel et porte la langue, la région et le callback async', () => {
    const url = urlSdkGoogleMaps('CLE-TEST', 'fr');
    expect(url.startsWith('https://maps.googleapis.com/maps/api/js?')).toBe(true);
    expect(url).toContain('key=CLE-TEST');
    expect(url).toContain('language=fr');
    expect(url).toContain('region=bj');
    expect(url).toContain('libraries=geometry');
    expect(url).toContain('loading=async');
    expect(url).toContain('callback=__tokpaGoogleMapsInit');
  });

  it('suit la langue de l’interface', () => {
    expect(urlSdkGoogleMaps('C', 'en')).toContain('language=en');
  });

  it('nettoie la clé et ne laisse aucun espace traîner dans l’URL', () => {
    expect(urlSdkGoogleMaps('  CLE  ', 'fr')).not.toContain(' ');
  });
});

describe('estValide / configuration', () => {
  it('une clé existe dès qu’elle n’est pas vide', () => {
    expect(estValide('AIzaSyExemple')).toBe(true);
    expect(estValide('  ')).toBe(false);
    expect(estValide('')).toBe(false);
    expect(estValide(undefined)).toBe(false);
    expect(estValide(null)).toBe(false);
  });

  it('sans clé, Google Maps est désactivé et le SDK n’est jamais demandé', () => {
    expect(typeof googleMapsConfigure()).toBe('boolean');
    if (!googleMapsConfigure()) expect(etatGoogleMaps()).toBe('inactif');
  });
});

describe('normaliserPolygone', () => {
  const dantokpa = {
    type: 'Polygon',
    coordinates: [[[2.415, 6.355], [2.445, 6.355], [2.445, 6.375], [2.415, 6.375], [2.415, 6.355]]],
  };

  it('convertit les anneaux GeoJSON [lng, lat] en [lat, lng]', () => {
    const [anneau] = normaliserPolygone(dantokpa);
    expect(anneau[0]).toEqual([6.355, 2.415]);
    expect(anneau[2]).toEqual([6.375, 2.445]);
    expect(anneau).toHaveLength(5);
  });

  it('accepte un anneau brut sans enveloppe GeoJSON', () => {
    expect(normaliserPolygone([[[2.316, 6.357], [2.345, 6.357], [2.345, 6.38]]])).toEqual([
      [[6.357, 2.316], [6.357, 2.345], [6.38, 2.345]],
    ]);
  });

  it('jette un anneau trop court pour être une surface', () => {
    expect(normaliserPolygone({ coordinates: [[[2.4, 6.3], [2.5, 6.4]]] })).toEqual([]);
  });

  it('renvoie un tableau vide sur tout ce qui n’est pas une géométrie', () => {
    expect(normaliserPolygone(null)).toEqual([]);
    expect(normaliserPolygone(undefined)).toEqual([]);
    expect(normaliserPolygone('polygone')).toEqual([]);
    expect(normaliserPolygone({ coordinates: null })).toEqual([]);
    expect(normaliserPolygone({ coordinates: [[['a', 'b'], ['c', 'd'], ['e', 'f']]] })).toEqual([]);
    expect(normaliserPolygone({ coordinates: [[[0, 0], [1, 1], [2, 2]]] })).toEqual([]);
  });
});

describe('normaliserSommet', () => {
  it('lit aussi la forme objet { lat, lng }', () => {
    expect(normaliserSommet({ lat: 6.37, lng: 2.43 })).toEqual([6.37, 2.43]);
    expect(normaliserSommet({ latitude: '6.37', longitude: '2.43' })).toEqual([6.37, 2.43]);
  });

  it('rejette un sommet hors bornes ou nul', () => {
    expect(normaliserSommet([2.43])).toBeNull();
    expect(normaliserSommet([2.43, 120])).toBeNull();
    expect(normaliserSommet([0, 0])).toBeNull();
    expect(normaliserSommet('2.43,6.37')).toBeNull();
    expect(normaliserSommet({ lat: null, lng: null })).toBeNull();
  });
});

describe('centrePolygone', () => {
  it('donne le centre de la boîte englobante', () => {
    const anneaux = normaliserPolygone({
      coordinates: [[[2, 6], [4, 6], [4, 8], [2, 8], [2, 6]]],
    });
    expect(centrePolygone(anneaux)).toEqual([7, 3]);
  });

  it('renvoie null sans sommet', () => {
    expect(centrePolygone([])).toBeNull();
  });
});

describe('positionExploitable', () => {
  it('garde des coordonnées dans les bornes et non nulles', () => {
    expect(positionExploitable([6.37, 2.43])).toBe(true);
    expect(positionExploitable(null)).toBe(false);
    expect(positionExploitable(undefined)).toBe(false);
    expect(positionExploitable([0, 0])).toBe(false);
    expect(positionExploitable([Number.NaN, 2.43])).toBe(false);
    expect(positionExploitable([95, 2.43])).toBe(false);
    expect(positionExploitable([6.37, 181])).toBe(false);
  });
});

describe('marqueurs Font Awesome embarqués', () => {
  it('produit un SVG autonome, à la couleur du rôle', () => {
    const svg = svgMarqueur('livreur', 46, { pulsation: true });
    expect(svg).toContain('width="46"');
    expect(svg).toContain('#10b981');
    expect(svg).toContain('<path d="M');
    expect(svg).toContain('<animate');
  });

  it('n’appelle aucune ressource externe (hors namespace SVG)', () => {
    const svg = svgMarqueur('destination', 40);
    expect(svg.split('http').length - 1).toBe(1);
    expect(svg).not.toContain('src=');
    expect(svg).not.toContain('material-symbols');
  });

  it('fabrique une data URI relisible', () => {
    const uri = dataUriMarqueur('depart', 40);
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const svg = decodeURIComponent(uri.slice('data:image/svg+xml;charset=utf-8,'.length));
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('#f97316');
  });

  it('tombe sur le glyphe « repère » pour un rôle inconnu', () => {
    expect(svgMarqueur('inconnu' as never)).toContain('#64748b');
  });
});

describe('GET /zones → géométrie de zone', () => {
  beforeEach(() => {
    forgetZonesGeo();
    forgetLivreurProfile();
    vi.clearAllMocks();
  });

  it('normalise le polygone GeoJSON et écarte les repères sans coordonnées', async () => {
    vi.mocked(catalogApi.getZones).mockResolvedValue({
      data: [
        {
          id: 4,
          nom: 'Dantokpa',
          polygone_geo: {
            type: 'Polygon',
            coordinates: [[[2.415, 6.355], [2.445, 6.355], [2.445, 6.375], [2.415, 6.375], [2.415, 6.355]]],
          },
          points_repere: [
            { id: 11, nom: 'Marché Dantokpa', latitude: 6.3725, longitude: 2.4332 },
            { id: 12, nom: 'Sans coordonnées', latitude: null, longitude: null },
            { id: 13, nom: 'Null island', latitude: 0, longitude: 0 },
          ],
        },
        { id: 7, nom: 'Cadjehoun', polygone_geo: null },
      ],
    } as never);

    const zones = await fetchZonesGeo();
    expect(zones.map((z) => z.id)).toEqual([4, 7]);
    expect(zones[0].polygone[0][0]).toEqual([6.355, 2.415]);
    expect(zones[0].reperes).toEqual([{ id: 11, nom: 'Marché Dantokpa', lat: 6.3725, lng: 2.4332 }]);
    expect(zones[1].polygone).toEqual([]);
    expect(zones[1].reperes).toEqual([]);
  });

  it('met en cache 10 minutes et n’écoute `force` que sur demande', async () => {
    vi.mocked(catalogApi.getZones).mockResolvedValue({ data: [{ id: 1, nom: 'Akpakpa' }] } as never);
    await fetchZonesGeo();
    await fetchZonesGeo();
    expect(catalogApi.getZones).toHaveBeenCalledTimes(1);
    await fetchZonesGeo(true);
    expect(catalogApi.getZones).toHaveBeenCalledTimes(2);
  });

  it('expose zone_id du profil pour cadrer la carte de zone', async () => {
    vi.mocked(authApi.getProfile).mockResolvedValue({
      data: { success: true, data: { id: 12, nom_complet: 'Jean Kouassi', profil: { zone_id: 4, zone: { id: 4, nom: 'Dantokpa' }, disponibilite: 1, documents: [] } } },
    } as never);
    expect(await fetchLivreurProfile()).toMatchObject({ zone: 'Dantokpa', zoneId: 4 });
  });
});

describe('zone du compte livreur', () => {
  const zones: ZoneGeo[] = [
    { id: 4, nom: 'Dantokpa', polygone: [[[6.355, 2.415], [6.375, 2.445]]], reperes: [{ id: 11, nom: 'Marché Dantokpa', lat: 6.3725, lng: 2.4332 }] },
    { id: 7, nom: 'Cadjehoun', polygone: [], reperes: [] },
  ];

  it('résout zone_id depuis le modèle ou la relation chargée', () => {
    expect(resoudreZoneId({ zone_id: 3 })).toBe(3);
    expect(resoudreZoneId({ zone_id: '3' })).toBe(3);
    expect(resoudreZoneId({ zone: { id: 8 } })).toBe(8);
    expect(resoudreZoneId({ zone_id: null })).toBeNull();
    expect(resoudreZoneId({ zone_id: 0 })).toBeNull();
    expect(resoudreZoneId({})).toBeNull();
    expect(resoudreZoneId(undefined)).toBeNull();
  });

  it('normalise les noms (casse, accents, espaces)', () => {
    expect(normaliserNom('  Dantokpa ')).toBe('dantokpa');
    expect(normaliserNom('Pèdèdji')).toBe('pededji');
    expect(normaliserNom(null)).toBe('');
  });

  it('cherche par identifiant d’abord, puis par nom', () => {
    expect(zoneCorrespond(zones, 7, 'Dantokpa')?.nom).toBe('Cadjehoun');
    expect(zoneCorrespond(zones, null, ' dantokpa ')?.id).toBe(4);
    expect(zoneCorrespond(zones, 99, 'CADJEHOUN')?.id).toBe(7);
    expect(zoneCorrespond(zones, 99, 'Inconnue')).toBeNull();
    expect(zoneCorrespond(zones, null, null)).toBeNull();
  });
});

describe('options du moteur Google', () => {
  it('sans position exploitable, la carte s’ouvre sur le point de retrait réel', () => {
    const options = optionsCarte(null) as Record<string, any>;
    expect(options.center).toEqual({ lat: 6.3725, lng: 2.4332 });
    expect(options.zoom).toBe(14);
    expect(options.disableDefaultUI).toBe(true);
    expect(options.gestureHandling).toBe('cooperative');
    expect(options.styles[0]).toMatchObject({ featureType: 'poi', elementType: 'labels' });
  });

  it('convertit [lat, lng] en { lat, lng } et écarte « null island »', () => {
    expect((optionsCarte([6.36, 2.42], 13) as Record<string, any>).center).toEqual({ lat: 6.36, lng: 2.42 });
    expect(positionGoogle([6.36, 2.42])).toEqual({ lat: 6.36, lng: 2.42 });
    expect(positionGoogle([0, 0])).toBeNull();
    expect(positionGoogle([Number.NaN, 2.42])).toBeNull();
    expect(positionGoogle(null)).toBeNull();
  });

  it('trace pointillée et polygone reprennent les styles de la maquette', () => {
    const trace = configTrace() as Record<string, any>;
    expect(trace.strokeColor).toBe('#f97316');
    expect(trace.icons[0]).toMatchObject({ repeat: '20px', path: 'M 0,0 L 12,0' });
    expect(stylePolygone()).toMatchObject({ strokeColor: '#f97316', fillOpacity: 0.08, clickable: false });
  });
});
