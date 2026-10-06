/**
 * Corps de `POST /admin/users/{user}/managers` (backend du 02/10/2026).
 *
 * Le contrôleur valide `zone_id` (`required|integer|exists:zones,id`) et deux horaires optionnelles au
 * format `H:i` ; la plage par défaut 08:00-18:00 est appliquée côté serveur. Envoyer une chaîne vide
 * ferait échouer le validateur, et préremplir 08:00-18:00 fabriquerait un choix que personne n'a fait :
 * les horaires ne partent donc que si l'agent les a saisies.
 */
export const corpsPromotion = (
  zone: string,
  debut: string,
  fin: string,
): { zone_id: number; heure_debut?: string; heure_fin?: string } => {
  const corps: { zone_id: number; heure_debut?: string; heure_fin?: string } = { zone_id: Number(zone) };
  if (debut) corps.heure_debut = debut;
  if (fin) corps.heure_fin = fin;
  return corps;
};
