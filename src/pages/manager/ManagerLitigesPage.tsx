import EcranSansEndpoint from '../../components/shared/EcranSansEndpoint';
import ManagerLayout from '../../components/layout/manager/ManagerLayout';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/**
 * ManagerLitigesPage — écran que le backend ne sait pas encore nourrir.
 *
 * Aucune route correspondante dans routes/api.php (groupe role:manager) : la page pose le
 * cadre — routes attendues, rubriques qui se rempliront — et reste vide. Ni exemple, ni pourcentage,
 * ni nom de personne, ni faux secret : la règle du projet est qu’un écran non branché doit le dire.
 */
export default function ManagerLitigesPage() {
  useLanguage();

  return (
    <ManagerLayout currentPath="/manager/litiges">
      <EcranSansEndpoint
        titre={tx("Gestion des litiges et réclamations")}
        chemin="/manager/litiges"
        role={tx("Litiges ouverts entre acheteur, marchande et livreur, avec la décision du superviseur de zone.")}
        middleware="role:manager"
        routes={[
          { chemin: 'GET /manager/litiges', apporte: tx("File des litiges de la zone, avec la commande liée et son motif.") },
          { chemin: 'GET /manager/litiges/{litige}', apporte: tx("Historique de la conversation et pièces produites par chaque partie.") },
          { chemin: 'POST /manager/litiges/{litige}/decision', apporte: tx("Validation, remboursement partiel ou total, rejet — appliqué sur la commande.") },
        ]}
        rubriques={[
          { titre: tx("Litiges urgents"), contenu: tx("Ordre de priorité calculé par le serveur, avec le temps écoulé depuis l’ouverture.") },
          { titre: tx("En attente de décision"), contenu: tx("Dossiers complets, prêts à être tranchés par le superviseur.") },
          { titre: tx("Résolus"), contenu: tx("Décision retenue, montant remboursé et date du virement.") },
          { titre: tx("Commande liée"), contenu: tx("Panier, quai de retrait, livreur affecté, statuts traversés.") },
        ]}
        avertissement={tx("Aucun dossier d’exemple, aucun nom de client, de marchande ou de livreur inventé, aucun montant : la file se remplit depuis GET /manager/litiges, et les compteurs des onglets viennent du même appel.")}
      />
    </ManagerLayout>
  );
}
