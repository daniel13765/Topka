import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fous sur le code de l'espace livreur, un par « ici on ne fait pas ça » remonté en revue :
 * pas d'`any` ni d'`eslint-disable` pour faire taire un fichier, pas de texte humain en dur hors
 * dictionnaire, pas de session relue à la main dans chaque écran.
 *
 * Aucune de ces règles n'est déductible du typage : un `any` qui revient ou un `localStorage.getItem`
 * bien placé laissent le build intact. D'où le test sur le texte source des fichiers réels, selon le
 * même principe que `sans-contenu-fabrique.test.ts` (même arborescence parcourue, même plancher).
 */
const RACINE = process.cwd();

const fichiers = (dossier: string): string[] => {
  const chemin = join(RACINE, dossier);
  let sortie: string[] = [];
  for (const entree of readdirSync(chemin)) {
    const plein = join(chemin, entree);
    if (statSync(plein).isDirectory()) sortie = sortie.concat(fichiers(relative(RACINE, plein)));
    else if (/\.(ts|tsx)$/.test(entree)) sortie.push(relative(RACINE, plein));
  }
  return sortie;
};

const source = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');

const DONNEES_LIVREUR = 'src/pages/livreur/livreurData.ts';
const TABLEAU_BORD = 'src/pages/livreur/dashboard/LivreurDashboardPage.tsx';
const COURSE = 'src/pages/livreur/course-active/LivreurCoursePage.tsx';
const PAGES_LIVREUR = fichiers('src/pages/livreur');

describe('contrôle du périmètre', () => {
  it('les pages livreur sont bien toutes examinées', () => {
    expect(PAGES_LIVREUR.length).toBeGreaterThanOrEqual(8);
    for (const page of [TABLEAU_BORD, COURSE]) expect(PAGES_LIVREUR).toContain(page);
  });
});

describe('pas de `any` ni d’`eslint-disable` pour lire les réponses', () => {
  it('le module de données ne désactive plus une règle sur tout le fichier', () => {
    const t = source(DONNEES_LIVREUR);
    expect(t).not.toMatch(/eslint-disable/u);
    expect(t).not.toMatch(/@ts-\w+/u);
  });

  it('aucune annotation `any` ni contournement par `as unknown as`', () => {
    // les commentaires sont retirés : le doc explique justement pourquoi il n'y a pas d'`any`
    const code = source(DONNEES_LIVREUR).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
    expect(code).not.toMatch(/\bany\b/u);
    expect(code).not.toMatch(/as unknown as/u);
  });

  it('toute ligne API lue est un type tolérant déclaré dans types/livreurRows', () => {
    const t = source(DONNEES_LIVREUR);
    expect(t).toContain("from '../../types/livreurRows'");
    const declares = new Set(
      [...source('src/types/livreurRows.ts').matchAll(/export (?:interface|type) (\w+)/g)].map((m) => m[1]),
    );
    const utilisees = [...t.matchAll(/\b([A-Z]\w*Row)\b/g)].map((m) => m[1] as string);
    expect(utilisees.length).toBeGreaterThanOrEqual(6);
    // une ligne non typee ne peut etre declaree qu'a cet endroit-la : pas de type local de secours
    expect([...new Set(utilisees.filter((n) => !declares.has(n)))], 'types non declares').toEqual([]);
  });
});

describe('pas de texte humain en dur dans l’espace livreur', () => {
  it('aucune page ne demande l’avis du livreur elle-même', () => {
    for (const f of PAGES_LIVREUR) {
      const t = source(f);
      expect(t, `${f} doit passer par demanderConfirmation`).not.toMatch(/\bconfirm\(/u);
      expect(t, `${f} ne doit pas porter de question FR hors dictionnaire`).not.toMatch(
        /(?:Confirmer la livraison|Elle sera remise en file)/u,
      );
    }
  });

  it('les deux confirmations passent par le dictionnaire et l’utilitaire partagé', () => {
    for (const f of [TABLEAU_BORD, COURSE]) {
      const t = source(f);
      expect(t, `${f} doit demander l'avis du livreur via demanderConfirmation`).toContain('demanderConfirmation');
      expect(t, `${f} n'appelle plus confirm() à la main`).not.toMatch(/(?<!window\.)\bconfirm\(/u);
    }
    expect(source(TABLEAU_BORD)).toContain('CONFIRMATION_REFUS');
    expect(source(COURSE)).toContain('CONFIRMATION_LIVRAISON');
  });

  it('les gabarits existent bien dans le dictionnaire (sinon tx retombe sur la clé)', () => {
    const d = source('src/i18n/phrases.ts');
    expect(d).toContain('"Refuser la course {course} ? Elle sera remise en file."');
    expect(d).toContain('"Confirmer la livraison de la commande {course} ?"');
    expect(d).toMatch(/"Refuser la course \{course\} \? Elle sera remise en file\.": "[^"]+\{course\}[^"]+"/u);
  });
});

describe('la session a une seule source', () => {
  it('aucun écran livreur ne relit le stockage', () => {
    for (const f of PAGES_LIVREUR) {
      expect(source(f), f).not.toMatch(/tokpa_(?:token|user|pending_email)/u);
      expect(source(f), f).not.toMatch(/(?:localStorage|sessionStorage)/u);
    }
  });

  it('les trois clés de session ne sont manipulées que dans services/session', () => {
    const contrevenants = fichiers('src').filter((f) => {
      if (f === 'src/services/session.ts') return false;
      return /\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['"]tokpa_(?:token|user|pending_email)['"]/u.test(
        source(f),
      );
    });
    expect(contrevenants, `lecture manuelle de la session : ${contrevenants.join(', ')}`).toEqual([]);
  });

  it('le garde de route et le hook délèguent à ce service', () => {
    expect(source('src/routes/authGuard.ts')).toContain("from '../services/session'");
    expect(source('src/hooks/useAuthGuard.ts')).toContain("from '../services/session'");
    // le garde ne conserve que ce qui n'est pas la session : la route where go après connexion
    expect(source('src/routes/authGuard.ts')).not.toMatch(/JSON\.parse/u);
  });

  it('la messagerie et les paramètres lisent l’identité via le service', () => {
    expect(source('src/pages/livreur/messagerie/LivreurMessagingPage.tsx')).toContain('identifiant');
    expect(source('src/pages/livreur/parametres/LivreurSettingsPage.tsx')).toContain('rafraichirUtilisateur');
    expect(source('src/pages/livreur/parametres/LivreurSettingsPage.tsx')).not.toMatch(/JSON\.parse/u);
  });
});

describe('les écritures de course délèguent au backend', () => {
  it('le tableau de bord ne bricole plus la liste lui-même', () => {
    const t = source(TABLEAU_BORD);
    for (const nom of ['accepterCourse', 'refuserCourse', 'retirerCourse']) expect(t, `absence de ${nom}`).toContain(nom);
    expect(t, "plus d'appel direct à l'API dans la page").not.toMatch(/livreurApi\.(?:accept|refuse)/u);
  });

  it('la page de course ne devine pas le statut suivant', () => {
    const t = source(COURSE);
    expect(t).toContain('changerStatutCourse');
    expect(t).toContain('appliquerStatut');
    expect(t).not.toMatch(/livreurApi\.updateStatus/u);
  });

  it('les deux écrans restent muets côté frontend sur un refus', () => {
    // toute mutation locale de la liste se fait dans la branche de succès : le module ne propose
    // aucune API qui retirer une course avant la réponse, ce qui rend l'erreur d'usage impossible.
    const module = source('src/utils/livreurCourses.ts');
    expect(module).toMatch(/export function retirerCourse/u);
    expect(module).not.toMatch(/setDeliveries|useState/u);
  });
});
