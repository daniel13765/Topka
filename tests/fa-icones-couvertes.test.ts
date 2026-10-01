import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Garde de cohérence des icônes.
 *
 * La partie clientèle, l’espace manager et les écrans d’authentification rendent leurs icônes par
 * `FaIcon`, qui cherche le nom dans une table de correspondance (héritée des ligatures Material Symbols
 * de la maquette). Un nom absent de la table bascule silencieusement sur l’icône neutre : l’écran reste
 * joli, mais une icône devient un point d’interrogation. Ce test intercepte le cas au commit, pour les
 * noms écrits dans le code. Les noms provenant de l’API (champ `icone` d’une catégorie) ne sont pas
 * testables ici : la table couvre les noms des seeders et `faCircleQuestion` sert d’appel à l’aide visible.
 */
const RACINE = process.cwd();

const REPETOIRES = [
  'src/pages/client',
  'src/pages/manager',
  'src/pages/auth',
  'src/components/client',
  'src/components/layout/client',
  'src/components/layout/manager',
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
  const source = readFileSync(join(RACINE, 'src/components/shared/FaIcon.tsx'), 'utf8');
  return new Set([...source.matchAll(/^ {2}([a-z_0-9]+):\s*fa[A-Za-z0-9]+,$/gm)].map((m) => m[1] as string));
};

describe('jeu d’icônes Font Awesome des espaces client et manager', () => {
  const cles = clesDeLaTable();

  it('la table de correspondance est peuplée', () => {
    expect(cles.size).toBeGreaterThan(150);
  });

  it('aucun écran client ou manager ne rend encore de ligature Material Symbols', () => {
    const fautifs: string[] = [];
    for (const repertoire of REPETOIRES) {
      for (const fichier of fichiersTs(repertoire)) {
        if (fichier.endsWith('FaIcon.tsx') || fichier.endsWith('MIcon.tsx')) continue;
        const source = readFileSync(fichier, 'utf8');
        if (/<MIcon\b/.test(source) || /from '[^']*shared\/MIcon'/.test(source)) {
          fautifs.push(relative(RACINE, fichier));
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('chaque nom d’icône écrit dans le code existe dans la table FaIcon', () => {
    const absents: string[] = [];
    for (const repertoire of REPETOIRES) {
      for (const fichier of fichiersTs(repertoire)) {
        if (fichier.endsWith('FaIcon.tsx')) continue;
        const source = readFileSync(fichier, 'utf8');
        const noms = new Set<string>();
        for (const m of source.matchAll(/<FaIcon\s+name=(?:"([a-z_0-9]+)"|'([a-z_0-9]+)')/g)) noms.add((m[1] ?? m[2]) as string);
        for (const m of source.matchAll(/name=\{[^}]*?['"]([a-z_0-9]+)['"]/g)) noms.add(m[1] as string);
        for (const m of source.matchAll(/icon:\s*'([a-z_0-9]+)'/g)) noms.add(m[1] as string);
        for (const n of noms) if (n && !cles.has(n)) absents.push(`${relative(RACINE, fichier)} → ${n}`);
      }
    }
    expect(absents).toEqual([]);
  });
});
