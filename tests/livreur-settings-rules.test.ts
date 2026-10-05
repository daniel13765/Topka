import { describe, expect, it } from 'vitest';

import {
  TYPES_PIECE,
  comptePieces,
  construireCorpsProfil,
  construireDocuments,
  documentsModifies,
  erreurPiece,
  normaliserPiece,
  pieceDejaPresente,
  erreurMotDePasse,
  forceDuMotDePasse,
  iconePiece,
  libelleDisponibilite,
  pieceValidee,
  puceConformite,
  telephoneValide,
  urlPhotoValide,
} from '../src/pages/livreur/parametres/profilUtils';
import { normaliserDocuments } from '../src/pages/livreur/livreurData';

describe('Paramètres livreur : contrôle des saisies', () => {
  it('accepte un numéro beninois avec ou sans indicatif, rejette un numéro tronqué', () => {
    expect(telephoneValide('+229 97 00 12 34')).toBe(true);
    expect(telephoneValide('97001234')).toBe(true);
    expect(telephoneValide('09700123')).toBe(true); // 00097… : seuls les chiffres comptent
    expect(telephoneValide('12 34 56')).toBe(false);
    expect(telephoneValide('+229 ' + '1'.repeat(21))).toBe(false);
  });

  it('n’accepte la photo que sous forme d’URL, vide autorisé pour retirer l’image', () => {
    expect(urlPhotoValide('')).toBe(true);
    expect(urlPhotoValide('  ')).toBe(true);
    expect(urlPhotoValide('https://cdn.tokpa.bj/j.png')).toBe(true);
    expect(urlPhotoValide('//cdn.tokpa.bj/j.png')).toBe(true);
    expect(urlPhotoValide('photos/j.png')).toBe(false);
    expect(urlPhotoValide('javascript:alert(1)')).toBe(false);
  });
});

describe('Paramètres livreur : corps de la requête PUT /profile', () => {
  it('ne renvoie que les quatre colonnes persistées, avec le nom complet recomposé', () => {
    const corps = construireCorpsProfil({
      prenom: '  Jean  ',
      nom: ' Kouassi ',
      telephone: ' +229 97 00 12 34 ',
      imageProfil: 'https://cdn/j.png',
      imageProfilServeur: 'https://cdn/j.png',
    });
    expect(corps).toEqual({
      prenom: 'Jean',
      nom: 'Kouassi',
      nom_complet: 'Jean Kouassi',
      telephone: '+229 97 00 12 34',
    });
    expect(Object.keys(corps).sort()).toEqual(['nom', 'nom_complet', 'prenom', 'telephone']);
  });

  it('envoie image_profil seulement si la photo a changé, vide pour l’effacer', () => {
    expect(
      construireCorpsProfil({
        prenom: 'Jean',
        nom: 'Kouassi',
        telephone: '97001234',
        imageProfil: 'https://cdn/nouveau.png',
        imageProfilServeur: 'https://cdn/j.png',
      }).image_profil,
    ).toBe('https://cdn/nouveau.png');

    const effacee = construireCorpsProfil({
      prenom: 'Jean',
      nom: 'Kouassi',
      telephone: '97001234',
      imageProfil: '   ',
      imageProfilServeur: 'https://cdn/j.png',
    });
    expect(effacee.image_profil).toBe('');

    const sansPhoto = construireCorpsProfil({
      prenom: 'Jean',
      nom: 'Kouassi',
      telephone: '97001234',
      imageProfil: '',
      imageProfilServeur: null,
    });
    expect('image_profil' in sansPhoto).toBe(false);
  });

  it('compose un nom complet même si un seul des deux noms est renseigné', () => {
    const unSeul = construireCorpsProfil({
      prenom: '',
      nom: 'Kouassi',
      telephone: '97001234',
      imageProfil: '',
      imageProfilServeur: null,
    });
    expect(unSeul.nom_complet).toBe('Kouassi');
  });
});

describe('Paramètres livreur : mot de passe', () => {
  it('refuse la saisie tant que les règles du backend ne sont pas remplies', () => {
    expect(erreurMotDePasse({ actuel: '', nouveau: 'abcdef12', confirmation: 'abcdef12' })).toBe(
      'Mot de passe actuel requis.',
    );
    expect(erreurMotDePasse({ actuel: 'ancien12', nouveau: 'court', confirmation: 'court' })).toBe(
      'Le nouveau mot de passe doit contenir au moins 8 caractères.',
    );
    expect(erreurMotDePasse({ actuel: 'memo12345', nouveau: 'memo12345', confirmation: 'memo12345' })).toBe(
      'Le nouveau mot de passe doit différer de l’ancien.',
    );
    expect(
      erreurMotDePasse({ actuel: 'ancien12', nouveau: 'nouveau2026', confirmation: 'autre12345' }),
    ).toBe('La confirmation ne correspond pas au nouveau mot de passe.');
    expect(
      erreurMotDePasse({ actuel: 'ancien12', nouveau: 'nouveau2026', confirmation: 'nouveau2026' }),
    ).toBeNull();
  });

  it('note la force sur cinq critères, sans jamais envoyer le mot de passe ailleurs', () => {
    expect(forceDuMotDePasse('')).toBe(0);
    expect(forceDuMotDePasse('abcdefg')).toBe(0);
    expect(forceDuMotDePasse('nouveau2026')).toBe(2);
    expect(forceDuMotDePasse('Nouveau2026')).toBe(3);
    expect(forceDuMotDePasse('Nouveau2026!')).toBe(5);
  });
});

describe('Paramètres livreur : pièces et statut affichés', () => {
  it('déduit l’icône du libellé du dossier', () => {
    expect(iconePiece('Assurance professionnelle Course')).toBe('policy');
    expect(iconePiece('Police RC Pro')).toBe('policy');
    expect(iconePiece("Carte d'Identité Nationale (CIP / CNI)")).toBe('fingerprint');
    expect(iconePiece('Passeport')).toBe('fingerprint');
    expect(iconePiece('Permis de conduire (Catégorie A)')).toBe('badge');
  });

  it('ne colorie la pastille que sur un statut positif du dossier', () => {
    expect(pieceValidee('valide')).toBe(true);
    expect(pieceValidee('vérifié')).toBe(true);
    expect(pieceValidee('en_attente')).toBe(false);
    expect(pieceValidee('expiré')).toBe(false);
    expect(pieceValidee(undefined)).toBe(false);
  });

  it('annonce un dossier vide plutôt qu’un faux pourcentage', () => {
    expect(puceConformite(0)).toEqual({ cle: 'Dossier vide', ton: 'warn' });
    expect(puceConformite(2)).toEqual({ cle: '2 pièce au dossier', ton: 'ok' });
  });

  it('dit « Statut inconnu » quand l’API ne renvoie pas la disponibilité', () => {
    expect(libelleDisponibilite(null)).toEqual({ cle: 'Statut inconnu', enService: false });
    expect(libelleDisponibilite(true)).toEqual({ cle: 'En service', enService: true });
    expect(libelleDisponibilite(false)).toEqual({ cle: 'Hors service', enService: false });
  });
});

/* ---------------------------------------------------------------------------
 * Pièces justificatives : `documents` est le seul champ du livreur que la page
 * écrive hors des quatre colonnes de profil, et `PUT /profile` le REMPLACE.
 * Les règles ci-dessous sont donc celles qui décident de ce qui part sur le serveur.
 * ------------------------------------------------------------------------- */

describe('Paramètres livreur : déclaration d’une pièce justificative', () => {
  it('exige un nom et une référence, chacun borné en longueur', () => {
    expect(erreurPiece({ libelle: '', valeur: 'https://x/y.pdf' })).toBe('Nomme la pièce que tu déclares.');
    expect(erreurPiece({ libelle: '   ', valeur: '' })).toBe('Nomme la pièce que tu déclares.');
    expect(erreurPiece({ libelle: 'Permis de conduire', valeur: '  ' })).toBe(
      'Indique l’URL du document ou sa référence.',
    );
    expect(erreurPiece({ libelle: 'a'.repeat(121), valeur: '12345' })).toBe(
      'Le nom de la pièce dépasse 120 caractères.',
    );
    expect(erreurPiece({ libelle: 'Permis', valeur: 'u'.repeat(501) })).toBe('La référence dépasse 500 caractères.');
    expect(erreurPiece({ libelle: 'Permis de conduire', valeur: 'https://cdn.tokpa.bj/permis.jpg' })).toBeNull();
    expect(erreurPiece({ libelle: 'Assurance', valeur: 'RC-2026-004578' })).toBeNull();
  });

  it('propose des libellés d’usage qui passent tous le contrôle', () => {
    expect(new Set(TYPES_PIECE).size).toBe(TYPES_PIECE.length);
    for (const type of TYPES_PIECE) {
      expect(type.length).toBeLessThanOrEqual(120);
      expect(erreurPiece({ libelle: type, valeur: 'Réf. 0000' })).toBeNull();
    }
  });

  it('nettoie la saisie et refuse un doublon, casse et espaces insignifiants', () => {
    const nette = normaliserPiece({ libelle: '  Permis de conduire ', valeur: ' https://cdn/permis.pdf ' });
    expect(nette).toEqual({ libelle: 'Permis de conduire', valeur: 'https://cdn/permis.pdf' });
    expect(pieceDejaPresente(nette, [{ libelle: 'PERMIS DE CONDUIRE' }])).toBe(true);
    expect(pieceDejaPresente(nette, [{ libelle: 'Assurance responsabilité civile' }])).toBe(false);
  });
});

describe('Paramètres livreur : corps `documents` envoyé à PUT /profile', () => {
  it('renvoie la liste complète, le statut de l’administration conservé tel quel', () => {
    expect(
      construireDocuments([
        { libelle: '  Permis de conduire ', valeur: ' 12 345 678 ', statut: 'valide' },
        { libelle: 'Assurance', valeur: '   ' },
        { libelle: '   ', valeur: 'oubliée' },
      ]),
    ).toEqual([{ libelle: 'Permis de conduire', valeur: '12 345 678', statut: 'valide' }, { libelle: 'Assurance' }]);
    // tableau vide autorisé : c'est ce que le backend reçoit quand le livreur a tout retiré
    expect(construireDocuments([])).toEqual([]);
  });

  it('ne signale une modification que si le serveur recevrait autre chose', () => {
    const avant = [
      { libelle: 'Permis', valeur: '1', statut: 'valide' },
      { libelle: 'Assurance' },
    ];
    expect(documentsModifies(avant, avant)).toBe(false);
    expect(
      documentsModifies(
        avant,
        avant.map((p) => ({ ...p, libelle: `  ${p.libelle}  `, valeur: `  ${p.valeur ?? ''}  ` })),
      ),
    ).toBe(false);
    expect(documentsModifies(avant, [...avant, { libelle: 'CNI', valeur: '456' }])).toBe(true);
    expect(documentsModifies(avant, [avant[0]])).toBe(true);
    // retirer un statut déjà validé est une modification réelle : le livreur n'en a pas le pouvoir,
    // mais la liste envoyée changerait, donc le bouton doit s'activer.
    expect(documentsModifies(avant, [{ libelle: 'Permis', valeur: '1' }, avant[1]])).toBe(true);
  });

  it('survit à l’aller-retour avec le serveur', () => {
    const envoye = construireDocuments([
      { libelle: 'Permis de conduire', valeur: 'https://cdn.tokpa.bj/permis.pdf', statut: 'valide' },
      { libelle: 'Carte grise' },
    ]);
    expect(normaliserDocuments(envoye)).toEqual(envoye);
    // un JSON d'un autre module (nom / numero / status, ou de simples chaînes) se relit proprement
    const relu = normaliserDocuments([
      { nom: ' Assurance ', numero: ' AC-2026-004578 ', status: 'en_attente' },
      'Permis de conduire',
      { id: 7 },
      null,
    ]);
    expect(relu).toEqual([
      { libelle: 'Assurance', valeur: 'AC-2026-004578', statut: 'en_attente' },
      { libelle: 'Permis de conduire' },
    ]);
    expect(construireDocuments(relu)).toEqual(relu);
    // le validateur du backend (`documents.*.libelle` requis) ne peut rien rejeter ici
    for (const ligne of construireDocuments(relu)) {
      expect(typeof ligne.libelle).toBe('string');
      expect(ligne.libelle.length).toBeGreaterThan(0);
    }
  });

  it('dénombre le dossier sans inventer de taux de conformité', () => {
    expect(comptePieces([])).toEqual({ total: 0, declarees: 0, verifiees: 0 });
    expect(
      comptePieces([
        { libelle: 'Permis', statut: 'valide' },
        { libelle: 'CNI' },
        { libelle: 'Assurance', statut: 'expiré' },
      ]),
    ).toEqual({ total: 3, declarees: 2, verifiees: 1 });
    // le verdict vient de `pieceValidee`, donc la liste et la puce ne peuvent pas se contredire
    for (const piece of [
      { libelle: 'a', statut: 'valide' },
      { libelle: 'a', statut: 'vérifié' },
      { libelle: 'a', statut: 'en_attente' },
      { libelle: 'a' },
    ]) {
      expect(comptePieces([piece]).verifiees).toBe(pieceValidee(piece.statut) ? 1 : 0);
    }
  });
});
