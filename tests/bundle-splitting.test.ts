import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Garde-fous du découpage du bundle (`src/routes/router.tsx`).
 *
 * Le point d'entrée pesait 1 845 Ko minifiés (496 Ko gzip) parce que chaque page y était importée en
 * statique ; ces tests empêchent la régression (un import statique réintroduit par confort) et, au
 * passage, une faute plus sournoise : une `createRoute` déclarée mais oubliée dans `addChildren`,
 * donc une route morte.
 */
const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const ROUTER = lire('../src/routes/router.tsx');
const REPERTOIRE = fileURLToPath(new URL('../src/routes/', import.meta.url));

describe('point d’entrée du routeur', () => {
  it('n’importe aucune page en statique, sauf la page 404', () => {
    const statiques = [...ROUTER.matchAll(/^import\s+\w+\s+from\s+'(\.\.\/pages\/[^']+)'/gm)].map((m) => m[1]);
    expect(statiques).toEqual(['../pages/NotFoundPage']);
  });

  it('charge chaque page par import() dynamique', () => {
    const dynamiques = [...ROUTER.matchAll(/import\('(\.\.\/pages\/[^']+)'\)/g)].map((m) => m[1]);
    expect(dynamiques.length).toBeGreaterThanOrEqual(43);
    for (const chemin of dynamiques) {
      // Vite résout sans extension : on vérifie l'existence réelle du module visé.
      const base = REPERTOIRE + chemin;
      const trouve = ['.tsx', '.ts', '/index.tsx', '/index.ts'].some((ext) => existsSync(base + ext));
      expect(trouve, `module introuvable pour ${chemin}`).toBe(true);
    }
  });

  it('précharge au survol et encadre le point de sortie par une frontière de suspension', () => {
    expect(ROUTER).toContain("defaultPreload: 'intent'");
    expect(ROUTER).toMatch(/<Suspense fallback=\{<LoadingState \/>\}>\s*<Outlet \/>\s*<\/Suspense>/);
  });

  it('enregistre bien toutes les routes déclarées', () => {
    const declarees = (ROUTER.match(/^const \w+Route = createRoute\(/gm) ?? []).length;
    const debut = ROUTER.indexOf('addChildren([') + 'addChildren(['.length;
    const liste = ROUTER.slice(debut, ROUTER.indexOf(']);', debut));
    const enregistrees = (liste.match(/\b\w+Route\b/g) ?? []).length;
    expect(declarees).toBeGreaterThan(40);
    expect(enregistrees).toBe(declarees);
  });

  it('ne encapsule aucune page dans un composant inline', () => {
    // Un `component: () => <Page />` recâblerait le chunk de la page dans le point d'entrée :
    // `lazy()` doit être passé tel quel. La coquille de la route racine (multi-ligne) est l'exception.
    expect(ROUTER).not.toMatch(/component: \(\) => </);
  });
});
