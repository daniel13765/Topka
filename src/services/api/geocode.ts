export type GeoPlace = { nom: string; detail: string; lat: number; lng: number };

/**
 * Recherche de lieux (géocodage OpenStreetMap / Nominatim) — comme Google Maps :
 * on tape un nom de lieu, on choisit une proposition, on récupère lat/lng.
 * Usage léger (admin), résultat en français.
 */
export async function searchPlaces(q: string): Promise<GeoPlace[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=fr&addressdetails=0&q=' +
    encodeURIComponent(q);
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Recherche de lieu indisponible (HTTP ${r.status})`);
  const rows: unknown = await r.json();
  if (!Array.isArray(rows)) return [];
  return (rows as any[])
    .map((p) => {
      const full = String(p.display_name ?? '');
      return {
        nom: full.split(',')[0]?.trim() || full,
        detail: full,
        lat: Number(p.lat),
        lng: Number(p.lon),
      };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
