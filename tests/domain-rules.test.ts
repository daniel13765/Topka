import { describe, expect, it } from 'vitest';
import { fedapayStatus } from '../src/utils/paymentStatus';
import { passwordScore } from '../src/utils/passwordScore';
import { mapApiCategory } from '../src/utils/catalogMap';
import { mapApiProduct } from '../src/utils/productMap';
import { parseLandmarks } from '../src/utils/landmarks';
import { statutLivreur } from '../src/utils/riderStatus';
import { acteur, categorie, detail, quand, titre } from '../src/utils/auditLog';

describe('confirmation payment status', () => {
  it.each([
    ['approved', 'reussi'],
    ['TRANSFERRED', 'reussi'],
    ['paid', 'reussi'],
    ['reussi', 'reussi'],
    ['declined', 'echoue'],
    ['canceled', 'echoue'],
    ['cancelled', 'echoue'],
    ['failed', 'echoue'],
    ['pending', 'en_attente'],
    ['en_attente', 'en_attente'],
  ])('maps %s to %s', (raw, expected) => {
    expect(fedapayStatus(raw)).toBe(expected);
  });

  it('ignores an unknown or empty status', () => {
    expect(fedapayStatus('refunded')).toBeNull();
    expect(fedapayStatus()).toBeNull();
    expect(fedapayStatus('')).toBeNull();
  });
});

describe('registration password score', () => {
  it('starts at zero for a short password', () => {
    expect(passwordScore('abc')).toBe(0);
  });

  it('scores length, digit, uppercase and a symbol', () => {
    expect(passwordScore('abcdefgh')).toBe(1);
    expect(passwordScore('abcdefg1')).toBe(2);
    expect(passwordScore('Abcdefg1')).toBe(3);
    expect(passwordScore('Abcdefg1!')).toBe(4);
  });

  it('treats twelve characters as the symbol rule', () => {
    expect(passwordScore('abcdefghijkl')).toBe(2);
  });
});

describe('catalog category mapping', () => {
  it.each([
    [{ nom: 'Poulet fermier' }, 'fish'],
    [{ slug: 'riz-local' }, 'grain'],
    [{ nom: 'Ail frais' }, 'spice'],
    [{ nom: 'Lot découverte' }, 'pack'],
    [{ nom: 'Tomates' }, 'vegetable'],
    [null, 'vegetable'],
  ])('maps %j', (category, expected) => {
    expect(mapApiCategory(category)).toBe(expected);
  });
});

describe('product page mapping', () => {
  it('maps a fish product that is in stock', () => {
    const product = mapApiProduct({
      id: 9,
      nom: 'Tilapia',
      prix: 2500,
      prix_minimum: 2000,
      devise: 'XOF',
      stock: 4,
      disponible: true,
      image_url: 'https://cdn.test/tilapia.jpg',
      description: 'Frais',
      categorie: { id: 2, nom: 'Poissons', slug: 'poisson' },
    });
    expect(product).toMatchObject({
      id: '9',
      categorie: 'fish',
      stock: 'available',
      prix: 2500,
      prixMinimum: 2000,
      image: 'https://cdn.test/tilapia.jpg',
      origine: 'Poissons',
    });
  });

  it('marks an unavailable product as out of stock', () => {
    const product = mapApiProduct({
      id: 3,
      nom: 'Riz',
      prix: 800,
      prix_minimum: 700,
      devise: 'XOF',
      stock: 0,
      disponible: true,
      categorie: { id: 1, nom: 'Céréales', slug: 'inconnu' },
    });
    expect(product.stock).toBe('out');
    expect(product.categorie).toBe('vegetable');
    expect(product.image).toBeUndefined();
  });
});

describe('profile landmarks', () => {
  it('returns an empty list when the profile has no landmarks', () => {
    expect(parseLandmarks(undefined)).toEqual([]);
    expect(parseLandmarks({ point_repere: 'Dantokpa' })).toEqual([]);
  });

  it('accepts strings and objects', () => {
    expect(parseLandmarks({
      point_repere: ['Marché', { nom: 'Stade', landmark: 'Face entrée' }, 4],
    })).toEqual([
      { key: 'lm-0', nom: 'Marché', description: '' },
      { key: 'lm-1-Stade', nom: 'Stade', description: 'Face entrée' },
    ]);
  });
});

describe('rider display status', () => {
  it('prefers account status over an active delivery', () => {
    expect(statutLivreur({ statut: 'suspendu', profil: { disponibilite: true } }, true).label).toBe('Suspendu');
    expect(statutLivreur({ statut: 'inactif' }, true).label).toBe('Inactif');
  });

  it('shows an active delivery before availability', () => {
    expect(statutLivreur({ statut: 'actif', profil: { disponibilite: false } }, true).label).toBe('En course');
  });

  it('falls back to availability', () => {
    expect(statutLivreur({ profil: { disponibilite: true } }, false).label).toBe('En ligne');
    expect(statutLivreur({ profil: { disponibilite: false } }, false).label).toBe('Hors ligne');
  });
});

describe('admin audit log text', () => {
  it('classifies routes and domain events', () => {
    expect(categorie({ action: 'POST api/admin/products' })).toBe('CATALOGUE');
    expect(categorie({ action: 'DELETE api/admin/users/4' })).toBe('UTILISATEUR');
    expect(categorie({ action: 'PATCH api/budget-proposals/8' })).toBe('VALIDATION');
    expect(categorie({ action: 'POST api/webhooks/fedapay' })).toBe('PAYMENT');
    expect(categorie({ action: 'POST api/auth/login' })).toBe('AUTH');
    expect(categorie({ action: 'OrderStatusChanged' })).toBe('COMMANDE');
    expect(categorie({ action: 'SomethingElse' })).toBe('SYSTEM');
  });

  it('builds readable titles', () => {
    expect(titre({ action: 'DeliveryAssigned' })).toBe('Livraison assignée');
    expect(titre({ action: 'POST api/auth/login' })).toBe('Connexion (étape mot de passe)');
    expect(titre({ action: 'PATCH api/livreur/deliveries/12/accept' })).toBe('Course acceptée · commande #12');
    expect(titre({ action: 'POST api/admin/products' })).toBe('Création · produit');
    expect(titre({ action: 'DELETE api/orders/9' })).toBe('Suppression · commande #9');
  });

  it('summarises payload and actor', () => {
    expect(detail({ details: { status: 201, payload: { nom: 'Riz', secret: { a: 1 }, vide: '' } } })).toBe('HTTP 201 · nom : Riz');
    expect(detail({ details: { event: 'App\\Events\\OrderStatusChanged' } })).toBe('Événement : OrderStatusChanged');
    expect(detail({})).toBe('—');
    expect(acteur(null)).toEqual({ nom: 'Système TOKPa', sous: 'Automatique' });
    expect(acteur({ user_id: 3, user: { prenom: 'Awa', nom: 'Dossou', role: { nom: 'admin' } } })).toEqual({
      nom: 'Awa Dossou',
      sous: 'admin',
    });
  });

  it('labels today and yesterday', () => {
    const now = new Date(2026, 8, 26, 15, 4);
    expect(quand(null)).toBe('—');
    expect(quand(new Date(2026, 8, 26, 9, 5).toISOString(), now)).toMatch(/^Aujourd'hui à /);
    expect(quand(new Date(2026, 8, 25, 18, 0).toISOString(), now)).toMatch(/^Hier à /);
  });
});
