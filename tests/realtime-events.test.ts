import { describe, expect, it } from 'vitest';

import { idCommandeDunEvenement } from '../src/utils/realtimeEvents';

describe('idCommandeDunEvenement', () => {
  it('lit order_id quand broadcastWith fournit un payload normalisé', () => {
    expect(idCommandeDunEvenement({ order_id: 12, statut: 'livre', previous: 'en_livraison' })).toBe(12);
  });

  it('retombe sur id pour le modèle Commande cru de DeliveryAssigned', () => {
    expect(idCommandeDunEvenement({ id: 7, user_id: 3, livreur_id: 9, statut: 'en_livraison' })).toBe(7);
  });

  it('tolère une enveloppe { order: {...} }', () => {
    expect(idCommandeDunEvenement({ order: { id: 21 } })).toBe(21);
  });

  it('préfère order_id à id quand les deux existent', () => {
    expect(idCommandeDunEvenement({ id: 99, order_id: 4 })).toBe(4);
  });

  it('accepte un identifiant chiffré reçu en texte', () => {
    expect(idCommandeDunEvenement({ order_id: '42' })).toBe(42);
  });

  it('renvoie null sur tout ce qui ne peut pas être un identifiant', () => {
    expect(idCommandeDunEvenement(undefined)).toBeNull();
    expect(idCommandeDunEvenement(null)).toBeNull();
    expect(idCommandeDunEvenement('commande 12')).toBeNull();
    expect(idCommandeDunEvenement(12)).toBeNull();
    expect(idCommandeDunEvenement({})).toBeNull();
    expect(idCommandeDunEvenement({ id: null })).toBeNull();
    expect(idCommandeDunEvenement({ id: '' })).toBeNull();
    expect(idCommandeDunEvenement({ id: 0 })).toBeNull();
    expect(idCommandeDunEvenement({ id: -3 })).toBeNull();
    expect(idCommandeDunEvenement({ id: 1.5 })).toBeNull();
    expect(idCommandeDunEvenement({ id: true })).toBeNull();
    expect(idCommandeDunEvenement({ payment_id: 5 })).toBeNull();
  });

  it('ignore un order_id faux même si id est valide', () => {
    expect(idCommandeDunEvenement({ order_id: 'abc', id: 66 })).toBe(66);
  });
});
