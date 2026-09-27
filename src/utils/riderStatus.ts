/** Statut affiché d'un livreur : compte, course en cours, puis disponibilité. */
export function statutLivreur(
  l: { statut?: string; profil?: { disponibilite?: boolean } | null } | null | undefined,
  enCourse: boolean,
): { label: string; badge: string; dot: string } {
  const compte = String(l?.statut ?? '').toLowerCase();
  if (compte === 'suspendu') return { label: 'Suspendu', badge: 'bg-error-light text-error-dark text-micro font-bold', dot: 'bg-error' };
  if (compte === 'inactif') return { label: 'Inactif', badge: 'bg-surface-container text-text-tertiary text-micro font-bold', dot: 'bg-text-tertiary' };
  if (enCourse) return { label: 'En course', badge: 'bg-amber-light text-amber-text text-micro font-bold', dot: 'bg-amber-text' };
  return l?.profil?.disponibilite
    ? { label: 'En ligne', badge: 'bg-success-light text-success-dark text-micro font-bold', dot: 'bg-success' }
    : { label: 'Hors ligne', badge: 'bg-error-light text-error-dark text-micro font-bold', dot: 'bg-error' };
}
