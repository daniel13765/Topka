export interface ParsedLandmark {
  key: string;
  nom: string;
  description: string;
}

/** Repères stockés dans `profil.point_repere` (chaîne ou objet). */
export function parseLandmarks(profil: Record<string, unknown> | undefined): ParsedLandmark[] {
  const raw = profil?.point_repere;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      if (typeof item === 'string') return { key: `lm-${i}`, nom: item, description: '' };
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        return {
          key: `lm-${i}-${o.nom ?? o.landmark ?? ''}`,
          nom: String(o.nom ?? 'Point de repère'),
          description: String(o.landmark ?? o.description ?? ''),
        };
      }
      return null;
    })
    .filter((l): l is ParsedLandmark => l !== null);
}
