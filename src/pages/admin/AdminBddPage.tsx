import EcranSansEndpoint from '../../components/shared/EcranSansEndpoint';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/**
 * AdminBddPage — écran que le backend ne sait pas encore nourrir.
 *
 * Aucune route correspondante dans routes/api.php (groupe role:super_admin) : la page pose le
 * cadre — routes attendues, rubriques qui se rempliront — et reste vide. Ni exemple, ni pourcentage,
 * ni nom de personne, ni faux secret : la règle du projet est qu’un écran non branché doit le dire.
 */
export default function AdminBddPage() {
  useLanguage();

  return (
    <AdminLayout currentPath="/admin/bdd-jobs">
      <EcranSansEndpoint
        titre={tx("Base de données et tâches planifiées")}
        chemin="/admin/bdd-jobs"
        role={tx("Espace de stockage, santé de la réplication et file d’attente des jobs planifiés.")}
        middleware="role:super_admin"
        routes={[
          { chemin: 'GET /admin/bdd', apporte: tx("Taille des tables, espace disque utilisé, latence de réplication.") },
          { chemin: 'GET /admin/bdd/jobs', apporte: tx("Jobs en attente, en cours et en échec, avec leur dernier essai.") },
          { chemin: 'POST /admin/bdd/jobs/{job}/relance', apporte: tx("Relance d’un job échoué, décidée côté serveur.") },
        ]}
        rubriques={[
          { titre: tx("Stockage"), contenu: tx("Volume par table et par index, croissance sur 30 jours, seuils d’alerte.") },
          { titre: tx("Tâches planifiées"), contenu: tx("Fréquence réellement exécutée, dernière durée, prochaine échéance.") },
          { titre: tx("File d’attente"), contenu: tx("Connecteur, travaux en cours, taux d’échec, workers actifs.") },
          { titre: tx("Réplication"), contenu: tx("Décalage entre nœud principal et répliques, dernière bascule.") },
        ]}
        avertissement={tx("Aucune commande de maintenance (purge, VACUUM, relance de job) n’est exposée par le backend : rien n’est déclenchable depuis cet écran, et aucune statistique n’est simulée pour remplir la page.")}
      />
    </AdminLayout>
  );
}
