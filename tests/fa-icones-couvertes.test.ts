import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { faCircleQuestion, faPlus } from '@fortawesome/free-solid-svg-icons';

import { markupIcone } from '../src/components/shared/faIcones';

/** Vue 0 0 W H attendue pour une icône donnée — lue dans la définition Font Awesome, pas en dur. */
const cadre = (definition: { icon: (string | number)[] }): string =>
  `viewBox="0 0 ${definition.icon[0]} ${definition.icon[1]}"`;

/**
 * Garde de cohérence des icônes.
 *
 * Tous les écrans de l'application rendent leurs icônes par `FaIcon`, qui cherche le nom dans une
 * table de correspondance (héritée des ligatures Material Symbols de la maquette Stitch exportée).
 * Un nom absent de la table bascule silencieusement sur l'icône neutre : l'écran reste joli, mais une
 * icône devient un point d'interrogation. Ce test intercepte le cas au commit, pour les noms écrits
 * dans le code — y compris dans les scripts du design, qui fabriquent leur balise `<svg>` via
 * `markupIcone`. Les noms provenant de l'API (champ `icone` d'une catégorie) ne sont pas testables
 * ici : la table couvre les noms des seeders et `faCircleQuestion` sert d'appel à l'aide visible.
 */
const RACINE = process.cwd();

const REPETOIRES = [
  'src/pages/client',
  'src/pages/manager',
  'src/pages/auth',
  'src/pages/admin',
  'src/pages/livreur',
  'src/components/client',
  'src/components/layout/client',
  'src/components/layout/manager',
  'src/components/layout/admin',
  'src/components/shared',
];

const fichiersTs = (dossier: string): string[] => {
  const chemin = join(RACINE, dossier);
  let sortie: string[] = [];
  for (const entree of readdirSync(chemin)) {
    const plein = join(chemin, entree);
    if (statSync(plein).isDirectory()) sortie = sortie.concat(fichiersTs(relative(RACINE, plein)));
    else if (entree.endsWith('.tsx') || entree.endsWith('.ts')) sortie.push(plein);
  }
  return sortie;
};

const clesDeLaTable = (): Set<string> => {
  const source = readFileSync(join(RACINE, 'src/components/shared/faIcones.ts'), 'utf8');
  return new Set([...source.matchAll(/^ {2}([a-z_0-9]+):\s*fa[A-Za-z0-9]+,$/gm)].map((m) => m[1] as string));
};

/** Les scripts du design sont des chaînes exportées par défaut : c'est leur valeur qu'on contrôle. */
const scriptsDuDesign = async (): Promise<Array<{ nom: string; code: string }>> => {
  const dossier = 'src/pages/admin/_scripts';
  const sortie: Array<{ nom: string; code: string }> = [];
  for (const entree of readdirSync(join(RACINE, dossier)).sort()) {
    if (!entree.endsWith('.ts')) continue;
    const module = (await import(/* @vite-ignore */ `../${dossier}/${entree.replace(/\.ts$/, '')}`)) as { default?: unknown };
    sortie.push({ nom: entree, code: typeof module.default === 'string' ? module.default : '' });
  }
  return sortie;
};

describe('jeu d’icônes Font Awesome de toutes les espaces', () => {
  const cles = clesDeLaTable();

  it('la table de correspondance est peuplée', () => {
    expect(cles.size).toBeGreaterThan(150);
  });

  it('aucun écran ne rend encore de composant MIcon', () => {
    const fautifs: string[] = [];
    for (const repertoire of REPETOIRES) {
      for (const fichier of fichiersTs(repertoire)) {
        if (fichier.endsWith('FaIcon.tsx')) continue;
        const source = readFileSync(fichier, 'utf8');
        if (/<MIcon\b/.test(source) || /from '[^']*shared\/MIcon'/.test(source)) {
          fautifs.push(relative(RACINE, fichier));
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('la police Material Symbols a disparu du projet', () => {
    // composant retiré, import de la police retiré, règle CSS retirée, dépendance npm retirée
    expect(existsSync(join(RACINE, 'src/components/shared/MIcon.tsx'))).toBe(false);
    const fontes = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys({ ...fontes.dependencies, ...fontes.devDependencies })).not.toContain('material-symbols');
    const sources = [
      ...fichiersTs('src/pages'),
      ...fichiersTs('src/components'),
      'src/main.jsx',
      'src/theme/theme.css',
    ].map((f) => (f.startsWith('src/') ? join(RACINE, f) : f));
    const restants = sources.filter((f) => readFileSync(f, 'utf8').includes('material-symbols'));
    expect(restants.map((f) => relative(RACINE, f))).toEqual([]);
  });

  it('chaque nom d’icône écrit dans le code existe dans la table FaIcon', () => {
    const absents: string[] = [];
    for (const repertoire of REPETOIRES) {
      for (const fichier of fichiersTs(repertoire)) {
        if (fichier.endsWith('FaIcon.tsx')) continue;
        const source = readFileSync(fichier, 'utf8');
        const noms = new Set<string>();
        for (const m of source.matchAll(/<FaIcon\s+name=(?:"([a-z_0-9]+)"|'([a-z_0-9]+)')/g)) noms.add((m[1] ?? m[2]) as string);
        // ternaire : les deux branches sont des noms d'icône (le reste de l'expression ne doit pas être capté)
        for (const m of source.matchAll(/name=\{[^{}]*\?\s*['"]([a-z_0-9]+)['"]\s*:\s*['"]([a-z_0-9]+)['"]/g)) {
          noms.add(m[1] as string);
          noms.add(m[2] as string);
        }
        // repli de coalescence : `name={c.icone ?? 'restaurant'}`
        for (const m of source.matchAll(/name=\{[^{}]*\?\?\s*['"]([a-z_0-9]+)['"]/g)) noms.add(m[1] as string);
        for (const m of source.matchAll(/icon:\s*'([a-z_0-9]+)'/g)) noms.add(m[1] as string);
        for (const n of noms) if (n && !cles.has(n)) absents.push(`${relative(RACINE, fichier)} → ${n}`);
      }
    }
    expect(absents).toEqual([]);
  });
});

describe('scripts du design : icônes et syntaxe', () => {
  const cles = clesDeLaTable();

  it('restent du JavaScript valide après la conversion des icônes', async () => {
    for (const { nom, code } of await scriptsDuDesign()) {
      expect(code, nom).not.toHaveLength(0);
      // `new Function` parse sans exécuter : c'est exactement ce que fait le runtime du design
      expect(() => new Function('__ico', '__setIco', 'tx', code), nom).not.toThrow();
    }
  });

  it('ne citent plus aucune ligature Material Symbols', async () => {
    for (const { nom, code } of await scriptsDuDesign()) {
      expect(code.includes('material-symbols'), nom).toBe(false);
    }
  });

  it('n’appellent que des icônes présentes dans la table', async () => {
    const absentes: string[] = [];
    for (const { nom, code } of await scriptsDuDesign()) {
      const utilises = new Set<string>();
      for (const m of code.matchAll(/__ico\(\s*'([a-z_0-9]+)'/g)) utilises.add(m[1] as string);
      for (const m of code.matchAll(/__setIco\(\s*[\w.]+\s*,\s*'([a-z_0-9]+)'/g)) utilises.add(m[1] as string);
      for (const n of utilises) if (!cles.has(n)) absentes.push(`${nom} → ${n}`);
    }
    expect(absentes).toEqual([]);
  });

  it('markupIcone produit le même tracé que le composant, et un repli visible sinon', () => {
    const svg = markupIcone('add');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(cadre(faPlus));
    expect(svg).toContain('aria-hidden="true"');
    expect(markupIcone('add', 'text-[16px]')).toContain('class="text-[16px]"');
    // nom hors table : le même appel à l'aide que `FaIcon`, jamais une icône manquante
    expect(markupIcone('nom_inexistant')).toContain(cadre(faCircleQuestion));
  });
});
