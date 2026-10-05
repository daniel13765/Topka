import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Garde « aucun contenu fabriqué ».
 *
 * La maquette d'origine (Stitch) montrait l'administration telle qu'elle serait un jour peuplée :
 * noms de clients, chiffres d'infrastructure, secrets, heures de dernière synchronisation. Un site
 * professionnel ne rend pas ces éléments : soit la donnée vient du backend, soit l'écran est vide et
 * le dit. Ce test verrouille la règle en passant `src/` au crible des motifs qui trahissaient du
 * contenu inventé, et en contrôlant le rendu des écrans concernés.
 */
const RACINE = process.cwd();

const fichiers = (dossier: string): string[] => {
  const chemin = join(RACINE, dossier);
  let sortie: string[] = [];
  for (const entree of readdirSync(chemin)) {
    const plein = join(chemin, entree);
    if (statSync(plein).isDirectory()) sortie = sortie.concat(fichiers(relative(RACINE, plein)));
    else if (/\.(ts|tsx)$/.test(entree)) sortie.push(plein);
  }
  return sortie;
};

const INTERDITS: Array<[string, RegExp]> = [
  ['référence de commande ou de ticket inventée', /#(?:TOK|LIT|CMD|ORD|OPS|N)-\d{3,}/],
  ['secret ou identifiant d’intégration fabriqué', /tokpa_live_[a-z0-9_]+|tk_srv_[a-z0-9_]+/i],
  ['nom de personne (identité d’emprunt)', /\b(?:Koffi|Kossi|Ouédraogo|Agossou|Dossou|Mensah|Hounnou|Hounsa|Sèklo|Aïcha|Fatou|Bintou|Marceline|Viviane|Blandine|Patrice|Boris|Salifou|Afi)\b/],
  // FedaPay est le prestataire réellement intégré (routes payments, événement PaymentConfirmed) :
  // ce n'est pas une marque d'emprunt, contrairement à l'outillage d'infrastructure inventé par la maquette.
  ['nom d’hébergeur ou d’outil d’infra inventé', /HashiCorp|Cloudflare|AWS KMS|Supabase|Vercel|Kube|MQTT/],
  ['compteur d’infra inventé', /\b\d{1,3},\d{3}\s*(?:Attaques|requêtes|sessions|jobs)\b/i],
  ['ancienneté figée dans une donnée', /\b(Il y a|il y a) \d+ ?(ms|s\b|min|h\b|jour)/],
  ['horodatage figé dans une donnée', /(Aujourd|hier)("|’)h?ui?,? \d{1,2}[:h]\d{2}|Hier \d{2}:\d{2}/],
  ['taux ou compteur inventé', /\b(?:9[0-9]|100)(?:\.\d+)? ?% (?:success|Enforced|opérationnel|de disponibilité)/i],
  ['badge de maquette', /\bMAQUETTE\b/],
  ['donnée de démo dans une table', /(const|let) [A-Z_]*(?:DEMO|DEMO_DATA|SAMPLE|FAKE|FIXTURE)[A-Z_]*/],
];

/**
 * Les indices de format (`placeholder`) et les commentaires ne sont pas des données rendues : la ligne
 * est coupée à son commentaire final avant l'examen, pour que `// ex. : « Il y a 10 min. »` ne compte pas.
 */
const ligneExemptee = (ligne: string): boolean => {
  const horsCommentaire = ligne.split(/(?<!:)\/\/ /)[0] as string;
  return /placeholder=/.test(horsCommentaire) || /^\s*(\/\/|\*|\/\*)/.test(ligne);
};

describe('aucun contenu fabriqué dans le code de la maquette', () => {
  const sources = ['src'].flatMap((d) => fichiers(d));

  it('le crible examine bien tout src', () => {
    // un plancher, pas un chiffre épinglé : le crible doit continuer de voir tous les dossiers
    expect(sources.length).toBeGreaterThanOrEqual(130);
    for (const dossier of ['src/pages', 'src/components', 'src/hooks', 'src/services', 'src/i18n']) {
      expect(sources.some((f) => f.includes(dossier)), dossier).toBe(true);
    }
  });

  it('ne contient ni nom d’emprunt, ni secret, ni chiffre d’infrastructure inventé', () => {
    const fautes: string[] = [];
    for (const fichier of sources) {
      const lignes = readFileSync(fichier, 'utf8').split('\n');
      lignes.forEach((ligne, index) => {
        if (ligneExemptee(ligne)) return;
        const examinee = ligne.split(/(?<!:)\/\/ /)[0] as string;
        for (const [motif, regex] of INTERDITS) {
          if (regex.test(examinee)) {
            fautes.push(`${relative(RACINE, fichier)}:${index + 1} — ${motif} — ${ligne.trim().slice(0, 90)}`);
            break;
          }
        }
      });
    }
    expect(fautes).toEqual([]);
  });

  it('ne rend aucune ligne de tableau sans source de données', async () => {
    // les cinq écrans admin sans endpoint et les deux écrans manager concernés sont des cadres vides
    const { EcranSansEndpoint } = await import('../src/components/shared/EcranSansEndpoint').then((m) => ({
      EcranSansEndpoint: m.default,
    }));
    expect(typeof EcranSansEndpoint).toBe('function');
    const attendus = [
      'src/pages/admin/AdminSystemePage.tsx',
      'src/pages/admin/AdminBddPage.tsx',
      'src/pages/admin/AdminClesApiPage.tsx',
      'src/pages/admin/AdminSecuritePage.tsx',
      'src/pages/admin/AdminParametresPage.tsx',
      'src/pages/manager/ManagerLitigesPage.tsx',
      'src/pages/manager/ManagerParametresPage.tsx',
    ];
    for (const chemin of attendus) {
      const source = readFileSync(join(RACINE, chemin), 'utf8');
      expect(source, chemin).toContain('EcranSansEndpoint');
      expect(source.includes('<tr'), chemin).toBe(false);
      expect(source.includes('defaultValue'), chemin).toBe(false);
    }
  });

  it('ne garde aucune clé de traduction orpheline', () => {
    // 1 911 clés venues de la maquette (chiffres d’infrastructure, secrets, noms d’emprunt) ont été
    // supprimées : une clé sans libellé équivalent dans le code est une traduction morte, souvent le
    // vestige d’un écran retiré. Fenêtre de 24 caractères : les chaînes construites (tr(\`…\`)) comptent.
    const phrases = readFileSync(join(RACINE, 'src/i18n/phrases.ts'), 'utf8');
    const cle = /^ {2}"((?:[^"\\]|\\.)*)":/gm;
    const corpus = fichiers('src')
      .filter((f) => !f.endsWith('phrases.ts'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const orphelines: string[] = [];
    for (const m of phrases.matchAll(cle)) {
      const texte = m[1] as string;
      const trouve =
        corpus.includes(texte) || (texte.length > 24 && (corpus.includes(texte.slice(0, 24)) || corpus.includes(texte.slice(-24))));
      if (!trouve) orphelines.push(texte.slice(0, 60));
    }
    expect(orphelines).toEqual([]);
  });

  it('les composants morts de la maquette client ne reviennent pas', () => {
    // ils portaient une identité d’emprunt et trois commandes inventées
    expect(existsSync(join(RACINE, 'src/components/client/profil'))).toBe(false);
  });
});
