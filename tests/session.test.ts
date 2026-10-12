import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `services/session.ts`, la source unique de la session.
 *
 * Les écrans ne relèvent plus `tokpa_user` chacun de leur côté : ils interrogent ce module. Ce qui
 * était toléré à la main à trois endroits (rôle en chaîne ou en objet, utilisateur nu ou sous `data`,
 * JSON illisible) doit donc être toléré ici, une seule fois, et ne doit jamais se transformer en
 * valeur inventée : un `id` approximatif aurait cassé la messagerie (comparaison au `sender_id` du
 * backend), un `role` deviné aurait ouvert le mauvais espace de travail. `null` veut dire « absent ou
 * illisible », et l'écran qui reçoit `null` affiche son état vide.
 */

import {
  aUneSession,
  CLE_COURRIEL_EN_ATTENTE,
  CLE_JETON,
  CLE_UTILISATEUR,
  courriel,
  courrielEnAttente,
  effacerSession,
  enregistrerSession,
  identifiant,
  jalon,
  memoriserCourrielEnAttente,
  nomComplet,
  oublierCourrielEnAttente,
  rafraichirUtilisateur,
  role,
  utilisateur,
  zone,
} from '../src/services/session';

const stocker = (valeur: unknown) => localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(valeur));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('jeton', () => {
  it('est la seule chose qui ouvre une session', () => {
    expect(jalon()).toBeNull();
    expect(aUneSession()).toBe(false);
    localStorage.setItem(CLE_JETON, '1|abc');
    expect(jalon()).toBe('1|abc');
    expect(aUneSession()).toBe(true);
  });

  it('purge le jeton d’ancienne démo au lieu de le faire passer pour valide', () => {
    localStorage.setItem(CLE_JETON, 'demo_token_sanctum_123');
    stocker({ id: 7, role: 'livreur' });

    expect(jalon()).toBeNull();
    expect(aUneSession()).toBe(false);
    // la session était fausse : le faux utilisateur part avec elle
    expect(localStorage.getItem(CLE_JETON)).toBeNull();
    expect(localStorage.getItem(CLE_UTILISATEUR)).toBeNull();
  });

  it('survit sans magasin (localStorage inaccessible = session absente, pas d’exception)', () => {
    localStorage.setItem(CLE_JETON, '1|abc');
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage is denied');
      },
    });
    try {
      expect(jalon()).toBeNull();
      expect(utilisateur()).toBeNull();
      expect(identifiant()).toBeNull();
      expect(() => enregistrerSession('2|def', { id: 3 })).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
    }
  });
});

describe('utilisateur stocké', () => {
  it('rend null sur un JSON illisible plutôt que de vider l’écran', () => {
    localStorage.setItem(CLE_UTILISATEUR, '{');
    expect(utilisateur()).toBeNull();
    expect(role()).toBeNull();
    expect(nomComplet()).toBeNull();
    localStorage.setItem(CLE_UTILISATEUR, '[]');
    expect(utilisateur()).toBeNull(); // un tableau n'est pas un utilisateur
  });

  it('accepte le rôle en chaîne ou en objet RoleResource', () => {
    stocker({ role: 'livreur' });
    expect(role()).toBe('livreur');
    stocker({ role: { id: 2, nom: ' manager ' } });
    expect(role()).toBe('manager');
    stocker({ role: { id: 2 } }); // objet sans nom : on ne devine pas l'espace de travail
    expect(role()).toBeNull();
    stocker({ role: null });
    expect(role()).toBeNull();
  });

  it('compose le nom affiché ou le prend tout fait', () => {
    stocker({ prenom: 'Jean', nom: 'Kouassi' });
    expect(nomComplet()).toBe('Jean Kouassi');
    stocker({ nom_complet: 'Awa D.' });
    expect(nomComplet()).toBe('Awa D.');
    stocker({ prenom: null, nom: null, nom_complet: '   ' });
    expect(nomComplet()).toBeNull();
  });

  it('lit la zone du profil, absente si le backend ne l’a pas chargée', () => {
    stocker({ profil: { zone: { id: 4, nom: ' Cotonou ' } } });
    expect(zone()).toBe('Cotonou');
    stocker({ profil: null });
    expect(zone()).toBeNull();
    stocker({});
    expect(zone()).toBeNull();
  });

  it('exige un identifiant entier positif (comparé au sender_id côté conversations)', () => {
    stocker({ id: '9' });
    expect(identifiant()).toBe(9);
    stocker({ id: 0 });
    expect(identifiant()).toBeNull();
    stocker({ id: 'produit retire' }); // un `id` de ressource dégradée n'est pas un identifiant
    expect(identifiant()).toBeNull();
    localStorage.setItem(CLE_UTILISATEUR, '{');
    expect(identifiant()).toBeNull();
  });

  it('expose le courriel pour le diagnostic, null s’il n’est pas une chaîne', () => {
    stocker({ email: ' a@b.c ' });
    expect(courriel()).toBe('a@b.c');
    stocker({ email: null });
    expect(courriel()).toBeNull();
  });
});

describe('ouverture et rafraîchissement', () => {
  it('stocke l’utilisateur nu même quand la réponse est sous `data`', () => {
    enregistrerSession('1|tok', { success: true, data: { id: 12, role: 'livreur' } });

    expect(localStorage.getItem(CLE_JETON)).toBe('1|tok');
    expect(utilisateur()).toEqual({ id: 12, role: 'livreur' });
    expect(role()).toBe('livreur');
  });

  it('refuse une ouverture sans jeton et ferme la session à la place', () => {
    enregistrerSession('1|tok', { id: 12 });
    enregistrerSession('', { id: 13 });

    expect(aUneSession()).toBe(false);
    expect(utilisateur()).toBeNull();
  });

  it('fusionne un `PUT /profile` sans perdre ce qu’il ne renvoie pas', () => {
    enregistrerSession('1|tok', { id: 12, role: 'livreur', email: 'a@b.c', profil: { zone_id: 4 } });

    rafraichirUtilisateur({ nom: 'Kpatcho', disponibilite: true });

    expect(utilisateur()).toMatchObject({ id: 12, role: 'livreur', email: 'a@b.c', nom: 'Kpatcho', disponibilite: true });
    // rien d'autre n'a bougé
    expect(localStorage.getItem(CLE_JETON)).toBe('1|tok');
  });

  it('ignore un rafraîchissement vide (réponse 204, erreur réseau)', () => {
    enregistrerSession('1|tok', { id: 12, role: 'livreur' });

    rafraichirUtilisateur(null);
    rafraichirUtilisateur('nope');

    expect(utilisateur()).toEqual({ id: 12, role: 'livreur' });
  });

  it('la fermeture ne laisse rien derrière elle, sauf l’adresse en attente de 2FA', () => {
    enregistrerSession('1|tok', { id: 12 });
    memoriserCourrielEnAttente('a@b.c');

    effacerSession();

    expect(localStorage.getItem(CLE_JETON)).toBeNull();
    expect(localStorage.getItem(CLE_UTILISATEUR)).toBeNull();
    // un 401 croisé pendant /verification-2fa ne doit pas casser le parcours de second facteur
    expect(localStorage.getItem(CLE_COURRIEL_EN_ATTENTE)).toBe('a@b.c');
  });
});

describe('adresse en attente de second facteur', () => {
  it('ne mémorise que ce qui ressemble à une adresse', () => {
    memoriserCourrielEnAttente(null);
    memoriserCourrielEnAttente('   ');
    memoriserCourrielEnAttente(42);
    expect(courrielEnAttente()).toBeNull();

    memoriserCourrielEnAttente(' a@b.c ');
    expect(courrielEnAttente()).toBe('a@b.c');
  });

  it('ne réamorce pas une demande déjà en cours (423 tardif)', () => {
    memoriserCourrielEnAttente('a@b.c');
    memoriserCourrielEnAttente('autre@b.c');

    expect(courrielEnAttente()).toBe('a@b.c');

    oublierCourrielEnAttente();
    expect(courrielEnAttente()).toBeNull();
    memoriserCourrielEnAttente('autre@b.c');
    expect(courrielEnAttente()).toBe('autre@b.c');
  });
});

describe('contrat du module', () => {
  it('les clés sont exportées, donc un appelant n’a pas à les recopier en dur', () => {
    expect([CLE_JETON, CLE_UTILISATEUR, CLE_COURRIEL_EN_ATTENTE]).toEqual([
      'tokpa_token',
      'tokpa_user',
      'tokpa_pending_email',
    ]);
  });

});
