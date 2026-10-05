import EcranSansEndpoint from '../../components/shared/EcranSansEndpoint';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/**
 * AdminParametresPage — écran que le backend ne sait pas encore nourrir.
 *
 * Aucune route correspondante dans routes/api.php (groupe role:admin) : la page pose le
 * cadre — routes attendues, rubriques qui se rempliront — et reste vide. Ni exemple, ni pourcentage,
 * ni nom de personne, ni faux secret : la règle du projet est qu’un écran non branché doit le dire.
 */
export default function AdminParametresPage() {
  useLanguage();

  return (
    <AdminLayout currentPath="/admin/parametres">
      <EcranSansEndpoint
        titre={tx("Paramètres généraux et métier")}
        chemin="/admin/parametres"
        role={tx("Règles commerciales du marché, horaires d’ouverture, commissions, délais de livraison, négociation et modèles de messages.")}
        middleware="role:admin"
        routes={[
          { chemin: 'GET /admin/parametres', apporte: tx("Les valeurs courantes, telles qu’elles sont stockées côté serveur.") },
          { chemin: 'PUT /admin/parametres', apporte: tx("L’enregistrement des modifications, avec la date et l’auteur du changement.") },
          { chemin: 'POST /admin/parametres/defauts', apporte: tx("Le retour aux valeurs par défaut du déploiement.") },
        ]}
        rubriques={[
          { titre: tx("Marché et horaires"), contenu: tx("Ouverture des commandes en ligne, plage horaire du marché, jours de fermeture.") },
          { titre: tx("Commissions et tarifs"), contenu: tx("Taux par catégorie, frais de service, seuil de gratuité.") },
          { titre: tx("Livraison et délais"), contenu: tx("Frais de course, temps estimé, zone desservie, attribution aux livreurs.") },
          { titre: tx("Négociation et budgets"), contenu: tx("Décote maximale acceptée, expiration d’une offre, validation automatique.") },
          { titre: tx("Alertes et messages"), contenu: tx("Modèles de SMS aux acheteurs, bandeau d’engorgement, numéro d’assistance.") },
          { titre: tx("Historique des modifications"), contenu: tx("Qui a changé quoi et quand, depuis la table d’audit.") },
        ]}
        avertissement={tx("Aucun champ n’est prérempli avec une valeur d’exemple et aucun bouton « Enregistrer » n’apparaît : sans les routes ci-dessus, il écrirait dans le vide. Les valeurs par défaut se lisent dans la configuration du serveur (config/*.php, table settings).")}
      />
    </AdminLayout>
  );
}
