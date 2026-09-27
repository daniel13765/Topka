/** Statut FedaPay (query `?status=`) ramené au vocabulaire Payment::statut. */
export function fedapayStatus(status?: string): string | null {
  const value = (status ?? '').toLowerCase();
  if (['approved', 'transferred', 'paid', 'reussi'].includes(value)) return 'reussi';
  if (['declined', 'canceled', 'cancelled', 'failed', 'echoue'].includes(value)) return 'echoue';
  if (value === 'pending' || value === 'en_attente') return 'en_attente';
  return null;
}
