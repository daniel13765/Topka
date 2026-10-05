import EcranSansEndpoint from '../../components/shared/EcranSansEndpoint';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/**
 * AdminSystemePage — écran que le backend ne sait pas encore nourrir.
 *
 * Aucune route correspondante dans routes/api.php (groupe role:super_admin) : la page pose le
 * cadre — routes attendues, rubriques qui se rempliront — et reste vide. Ni exemple, ni pourcentage,
 * ni nom de personne, ni faux secret : la règle du projet est qu’un écran non branché doit le dire.
 */
export default function AdminSystemePage() {
  useLanguage();

  return (
    <AdminLayout currentPath="/admin/systeme">
      <EcranSansEndpoint
        titre={tx("Console système et santé de l’infrastructure")}
        chemin="/admin/systeme"
        role={tx("État des services, flux de télémétrie temps réel et garde-fous d’urgence de la plateforme.")}
        middleware="role:super_admin"
        routes={[
          { chemin: 'GET /admin/systeme', apporte: tx("Liste des services surveillés, avec leur état renvoyé par le serveur.") },
          { chemin: 'GET /admin/systeme/flux', apporte: tx("Dernier échantillon de télémétrie (ou canal Reverb dédié, ex. systeme).") },
          { chemin: 'POST /admin/systeme/maintenance', apporte: tx("Bascule en mode maintenance, appliquée côté serveur et non depuis le navigateur.") },
        ]}
        rubriques={[
          { titre: tx("Services"), contenu: tx("API, file d’attente, broadcasts, base et cache : un état par service, renvoyé par le serveur.") },
          { titre: tx("Télémétrie"), contenu: tx("Lignes de journal horodatées, filtrables par service et par niveau.") },
          { titre: tx("Garde-fous d’urgence"), contenu: tx("Mode maintenance, coupure des passerelles de paiement, arrêt du dispatch des courses.") },
          { titre: tx("Fenêtre d’observation"), contenu: tx("Durée observée (1 heure, 24 heures, 7 jours) demandée au serveur, jamais simulée.") },
        ]}
        avertissement={tx("Aucun pourcentage de charge, aucun état « opérationnel » et aucun interrupteur d’urgence n’est affiché : un bouton qui ne joindrait aucun serveur donnerait un faux sentiment de contrôle sur la production.")}
      />
    </AdminLayout>
  );
}
