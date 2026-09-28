import { beforeEach, describe, expect, it, vi } from 'vitest';

// `initialsOf` vit dans routes/authGuard, qui importe react-hot-toast au chargement : gober a
// besoin d'un `document` que l'environnement node des tests ne fournit pas.
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

vi.mock('../src/services/api', () => ({
  chatApi: { getConversations: vi.fn(), getMessages: vi.fn(), sendMessage: vi.fn() },
}));

import { chatApi } from '../src/services/api';
import {
  LONGUEUR_MAX_MESSAGE,
  apercuDuFil,
  chargerFils,
  chargerMessages,
  controleMessage,
  dateSeule,
  estDeMoi,
  etatAccesChat,
  grouperParJour,
  initialesOuVide,
  libelleJour,
  nomPartenaire,
  tonStatut,
  tronquer,
  type MessageLeger,
} from '../src/pages/livreur/messagerie/messagerieData';

const midi = (jour: string) => `${jour}T12:00:00`; // heure locale : stable quelle que soit la TZ
const REF = new Date(midi('2026-09-28'));

const message = (
  id: number,
  sender_id: number,
  contenu: string,
  created_at = midi('2026-09-28'),
  sender?: MessageLeger['sender'],
): MessageLeger => ({ id, sender_id, contenu, created_at, sender });

describe('messagerie livreur : lecture des interlocuteurs', () => {
  it('distingue mes messages de ceux du client', () => {
    expect(estDeMoi({ sender_id: 7 }, 7)).toBe(true);
    expect(estDeMoi({ sender_id: 3 }, 7)).toBe(false);
    expect(estDeMoi({ sender_id: 3 }, null)).toBe(false); // session illisible : rien n'est « moi »
  });

  it('ne nomme le client que si un message le porte', () => {
    const fils = [message(1, 7, 'Bonjour'), message(2, 3, 'Bonjour aussi', midi('2026-09-28'), { nom_complet: '  Amina Lawal  ' })];
    expect(nomPartenaire(fils, 7)).toBe('Amina Lawal');
    expect(nomPartenaire([message(2, 3, 'ok', midi('2026-09-28'), { prenom: 'Koffi', nom: 'Bruno' })], 7)).toBe('Koffi Bruno');
    expect(nomPartenaire([message(1, 7, 'moi')], 7)).toBeNull();
    expect(nomPartenaire([], 7)).toBeNull();
    expect(initialesOuVide(null)).toBe('··');
    expect(initialesOuVide('Amina Lawal')).toBe('AL');
  });

  it('résume le dernier message sans jamais l’inventer', () => {
    expect(apercuDuFil([], 7)).toBeNull();
    const fils = [message(1, 3, 'J’arrive   dans 10 min'), message(2, 7, 'D’accord')];
    expect(apercuDuFil(fils, 7)).toEqual({ texte: 'Vous : D’accord', heure: expect.any(String) });
    expect(apercuDuFil([message(1, 3, 'Salut')], 7)?.texte).toBe('Salut');
    const long = tronquer('a'.repeat(90));
    expect(long).toHaveLength(60);
    expect(long.endsWith('…')).toBe(true);
    expect(tronquer('  un   deux  ')).toBe('un deux');
  });
});

describe('messagerie livreur : séparateurs de jour', () => {
  it("suit l’échelle de la maquette (Aujourd'hui, Hier, jour court, date)", () => {
    expect(libelleJour(midi('2026-09-28'), REF)).toBe("Aujourd'hui");
    expect(libelleJour(midi('2026-09-27'), REF)).toBe('Hier');
    expect(libelleJour(midi('2026-09-25'), REF)).toMatch(/^[^\d]+$/); // jour abrégé, sans chiffre
    expect(libelleJour(midi('2026-08-28'), REF)).toContain('2026');
    expect(libelleJour(null, REF)).toBe('');
    expect(libelleJour('pas-une-date', REF)).toBe(''); // date illisible : aucun séparateur faux
  });

  it('regroupe par jour dans l’ordre du serveur', () => {
    const groupes = grouperParJour(
      [message(1, 3, 'a', midi('2026-09-27')), message(2, 7, 'b', midi('2026-09-27')), message(3, 3, 'c', midi('2026-09-28'))],
      REF,
    );
    expect(groupes).toHaveLength(2);
    expect(groupes[0].jour).toBe('Hier');
    expect(groupes[0].messages.map((m) => m.id)).toEqual([1, 2]);
    expect(groupes[1].jour).toBe("Aujourd'hui");
    expect(dateSeule(midi('2026-09-28'))).toContain('2026');
    expect(dateSeule(null)).toBeNull();
    expect(dateSeule('xxxx')).toBeNull();
  });
});

describe('messagerie livreur : composeur et statuts', () => {
  it('bloque le vide et ce qui dépasse la borne du backend', () => {
    expect(controleMessage('')).toEqual({ pret: false, raison: null, excedent: 0, restant: LONGUEUR_MAX_MESSAGE });
    expect(controleMessage('   ')).toMatchObject({ pret: false, raison: null });
    expect(controleMessage('bonjour')).toMatchObject({ pret: true, raison: null, excedent: 0 });
    const trop = 'x'.repeat(LONGUEUR_MAX_MESSAGE + 5);
    const res = controleMessage(trop);
    expect(res.pret).toBe(false);
    expect(res.raison).toBe('Message trop long.');
    expect(res.excedent).toBe(5);
    expect(res.restant).toBe(-5);
  });

  it('colore la pastille d’après le statut réel de la commande', () => {
    expect(tonStatut('en_livraison')).toBe('course');
    expect(tonStatut('en_attente')).toBe('course');
    expect(tonStatut('livre')).toBe('fini');
    expect(tonStatut('annulée')).toBe('annule');
    expect(tonStatut('inconnu')).toBe('neutre');
    expect(tonStatut(null)).toBe('neutre');
  });

  it('reconnaît le 403 du middleware role:client', () => {
    expect(etatAccesChat({ response: { status: 403 } })).toEqual({ interdit: true, status: 403 });
    expect(etatAccesChat({ response: { status: 401 } })).toEqual({ interdit: true, status: 401 });
    expect(etatAccesChat({ response: { status: 422 } })).toEqual({ interdit: false, status: 422 });
    expect(etatAccesChat(new Error('Network Error'))).toEqual({ interdit: false, status: null });
  });
});

describe('messagerie livreur : appels réseau', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lit le paginateur imbriqué de GET /conversations/{id}/messages', async () => {
    vi.mocked(chatApi.getMessages).mockResolvedValue({
      data: {
        data: [
          { id: 11, conversation_id: 9, sender_id: 3, contenu: 'Bonjour', lu: false, created_at: midi('2026-09-28'), sender: { id: 3, nom: 'Lawal', prenom: 'Amina', nom_complet: 'Amina Lawal' } },
        ],
        current_page: 2,
        last_page: 3,
        total: 120,
      },
    } as never);

    const res = await chargerMessages(9);
    expect(chatApi.getMessages).toHaveBeenCalledWith(9, 1);
    expect(res).toMatchObject({ page: 2, dernierePage: 3, total: 120 });
    // seules les clés utiles à l'affichage traversent
    expect(res.messages).toEqual([
      { id: 11, sender_id: 3, contenu: 'Bonjour', created_at: midi('2026-09-28'), sender: { id: 3, nom: 'Lawal', prenom: 'Amina', nom_complet: 'Amina Lawal' } },
    ]);
  });

  it('tolère une réponse plate (pas de paginateur)', async () => {
    vi.mocked(chatApi.getMessages).mockResolvedValue({ data: [{ id: 1, sender_id: 7, contenu: 'ok', created_at: null }] } as never);
    const res = await chargerMessages(9);
    expect(res).toMatchObject({ page: 1, dernierePage: 1, total: 0 });
    expect(res.messages[0].sender_id).toBe(7);
  });

  it('enrichit les fils avec le nom et l’aperçu réels, et borne les lectures', async () => {
    const brut = (id: number, order_id: number) => ({
      id,
      order_id,
      created_at: midi('2026-09-20'),
      updated_at: midi('2026-09-28'),
      order: { id: order_id, statut: 'en_livraison', montant_total: '3980.00', description_lieu: 'portail bleu' },
    });
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: [brut(9, 4), brut(10, 5)] } as never);
    vi.mocked(chatApi.getMessages).mockResolvedValue({
      data: { data: [message(11, 3, 'Je suis au carrefour', midi('2026-09-28'), { nom_complet: 'Amina Lawal' })] },
    } as never);

    const { fils, sansApercu } = await chargerFils(7, 2);
    expect(sansApercu).toBe(0);
    expect(chatApi.getMessages).toHaveBeenCalledTimes(2);
    expect(fils[0]).toMatchObject({
      id: 9,
      orderId: 4,
      ref: '#TOK-4',
      statutBrut: 'en_livraison',
      indice: 'portail bleu',
      nom: 'Amina Lawal',
      initiales: 'AL',
      apercu: 'Je suis au carrefour',
      chargement: false,
    });
    expect(fils[0].montant).toMatch(/^3\s980 FCFA$/); // U+202F entre les milliers
    expect(fils[0].statutLabel).toBe('En livraison');
    expect(fils[0].ouvertDepuis).toContain('sept');
  });

  it('limite les aperçus et annonce le reliquat au lieu de mentir', async () => {
    vi.mocked(chatApi.getConversations).mockResolvedValue({
      data: [
        { id: 1, order_id: 11, updated_at: null, order: null },
        { id: 2, order_id: null, updated_at: null, order: null },
      ],
    } as never);
    vi.mocked(chatApi.getMessages).mockRejectedValue(new Error('boom'));

    const { fils, sansApercu } = await chargerFils(7, 1);
    expect(sansApercu).toBe(1);
    expect(chatApi.getMessages).toHaveBeenCalledTimes(1);
    // le premier fil a été tenté (échec ⇒ aucun aperçu, mais la liste vit)
    expect(fils[0]).toMatchObject({ id: 1, nom: '—', apercu: null, chargement: false });
    // le second n'a même pas été lu
    expect(fils[1]).toMatchObject({ id: 2, ref: '—', montant: '—', chargement: false });
  });

  it('liste zéro conversation sans erreur', async () => {
    vi.mocked(chatApi.getConversations).mockResolvedValue({ data: [] } as never);
    expect(await chargerFils(7)).toEqual({ fils: [], sansApercu: 0 });
  });
});
