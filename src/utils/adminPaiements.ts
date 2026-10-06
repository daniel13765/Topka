import { tx } from '../i18n/tx';
import type { PaymentRow } from '../types/adminRows';

/**
 * Lectures et calculs de l'écran « Paiements » de l'administration.
 *
 * Séparés de la page pour deux raisons : la règle `react-refresh` veut qu'un fichier de composant
 * n'exporte que des composants (sinon le rechargement à chaud se désactive), et ces règles se testent
 * sans DOM. Elles ne font que lire les formes que `PaymentController` renvoie réellement : le
 * `montant` « decimal:2 » envoyé en chaîne, l'enum `statut`, et le `fedapay_token` du modèle brut.
 */

/** Rien à afficher tant que GET /admin/payments n'a pas répondu : un 0 se lit comme un résultat. */
export const VIDE = '—';

export const STATUTS = ['en_attente', 'reussi', 'echoue', 'rembourse'] as const;
export type StatutPaiement = (typeof STATUTS)[number];

export const STATUT_UI: Record<string, { badge: string; icon: string; libelle: string }> = {
  en_attente: { badge: 'bg-amber-50 text-amber-800 border border-amber-200', icon: 'hourglass_top', libelle: 'En attente' },
  reussi: { badge: 'bg-emerald-50 text-emerald-800 border border-emerald-200', icon: 'check_circle', libelle: 'Réussi' },
  echoue: { badge: 'bg-red-50 text-red-700 border border-red-200', icon: 'error', libelle: 'Échoué' },
  rembourse: { badge: 'bg-blue-50 text-blue-800 border border-blue-200', icon: 'replay', libelle: 'Remboursé' },
};

/** Somme uniquement ce que la liste reçue contient : aucun chiffre n'est deviné. */
export const enAttente = (s: unknown): boolean => String(s ?? '') === 'en_attente';

export const statutDe = (p: PaymentRow): StatutPaiement | string => String(p?.statut ?? '') as StatutPaiement;

/** `decimal:2` côté Laravel → « 1500.00 » en JSON : la chaîne est parseée, sinon 0 (jamais NaN). */
export const montantDe = (p: PaymentRow): number => {
  const n = typeof p?.montant === 'string' ? parseFloat(p.montant) : p?.montant;
  return Number.isFinite(n) ? Number(n) : 0;
};

/** Le jeton est-il simplement absent côté base, ou masqué par le front ? */
export const estPurge = (token: unknown): string =>
  token === null || token === undefined || token === '' ? tx('aucun') : tx('masqué par le front');

/**
 * Copie de la ligne expurgée du jeton FedaPay. Le contrôleur renvoie le modèle brut (aucune
 * `PaymentResource`), donc le secret arrive jusqu'au navigateur : il n'est jamais montré, copié ni
 * sérialisé depuis cet écran.
 */
export function sansJeton(p: PaymentRow): Record<string, unknown> {
  const { fedapay_token: _jeton, ...reste } = p as PaymentRow & { fedapay_token?: unknown };
  void _jeton;
  return { ...reste, fedapay_token: `«${tx('masqué par le front')}»` };
}

/** Totaux calculés sur les lignes reçues : la route ne renvoie aucun agrégat. */
export const totauxDe = (rows: PaymentRow[]): { encaisse: number; enAttenteMontant: number; echoues: number } => {
  let encaisse = 0;
  let enAttenteMontant = 0;
  let echoues = 0;
  for (const p of rows) {
    const s = statutDe(p);
    if (s === 'reussi') encaisse += montantDe(p);
    else if (enAttente(s)) enAttenteMontant += montantDe(p);
    else if (s === 'echoue') echoues += 1;
  }
  return { encaisse, enAttenteMontant, echoues };
};

/** Filtrage local : `listAllPayments` n'accepte aucun paramètre, rien n'est donc renvoyé au serveur. */
export const filtrerParStatut = (rows: PaymentRow[], filtre: '' | StatutPaiement): PaymentRow[] =>
  filtre ? rows.filter((p) => statutDe(p) === filtre) : rows;
