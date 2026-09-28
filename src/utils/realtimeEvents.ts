/**
 * Forme des événements Reverb du backend TOKPa.
 *
 * Les événements ne se ressemblent pas (voir `app/Events/*.php`) :
 * - `order.status.changed` → `broadcastWith()` explicite : `{ order_id, statut, previous }` ;
 * - `payment.confirmed`    → modèle Payment sérialisé : `{ id, order_id, montant }` ;
 * - `delivery.assigned`    → **aucun** `broadcastWith()` → c'est le modèle Commande sérialisé,
 *   donc `{ id, user_id, livreur_id, … }` (et `order.id` quand l'événement est enveloppé).
 *
 * Les écrans ne doivent pas connaître cette dispersion : ils comparent un identifiant de commande.
 */
export function idCommandeDunEvenement(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const enveloppe = p.order && typeof p.order === 'object' ? (p.order as Record<string, unknown>) : null;
  const candidats = [p.order_id, p.id, enveloppe?.id];
  for (const c of candidats) {
    if (c === null || c === undefined || c === '') continue;
    const n = Number(c);
    // `Number(true)` vaut 1 : un booléen ou du texte ne doit jamais devenir un identifiant.
    if (typeof c !== 'boolean' && Number.isInteger(n) && n > 0) return n;
  }
  return null;
}
