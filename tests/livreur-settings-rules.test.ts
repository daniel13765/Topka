import { describe, expect, it } from 'vitest';

import {
  construireCorpsProfil,
  erreurMotDePasse,
  forceDuMotDePasse,
  iconePiece,
  libelleDisponibilite,
  pieceValidee,
  puceConformite,
  telephoneValide,
  urlPhotoValide,
} from '../src/pages/livreur/parametres/profilUtils';

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
