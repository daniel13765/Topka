import EcranSansEndpoint from '../../components/shared/EcranSansEndpoint';
import ManagerLayout from '../../components/layout/manager/ManagerLayout';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/**
 * ManagerParametresPage — écran que le backend ne sait pas encore nourrir.
 *
 * Aucune route correspondante dans routes/api.php (groupe role:manager) : la page pose le
 * cadre — routes attendues, rubriques qui se rempliront — et reste vide. Ni exemple, ni pourcentage,
 * ni nom de personne, ni faux secret : la règle du projet est qu’un écran non branché doit le dire.
 */
export default function ManagerParametresPage() {
  useLanguage();

  return (
    <ManagerLayout currentPath="/manager/parametres">
      <EcranSansEndpoint
        titre={tx("Paramètres de la zone et préférences")}
        chemin="/manager/parametres"
        role={tx("Tarification de la zone, règles d’attribution des courses, alertes et préférences du compte.")}
        middleware="role:manager"
        routes={[
          { chemin: 'GET /manager/settings', apporte: tx("Valeurs enregistrées pour la zone du manager.") },
          { chemin: 'PUT /manager/settings', apporte: tx("Enregistrement des modifications, avec contrôle du rôle et de la zone.") },
          { chemin: 'POST /manager/settings/reinitialisation', apporte: tx("Retour aux valeurs du déploiement.") },
        ]}
        rubriques={[
          { titre: tx("Zone et tarification"), contenu: tx("Rayon desservi, frais de base, complément par kilomètre.") },
          { titre: tx("Règles d’attribution"), contenu: tx("Attribution au plus proche, délai de rejet, file d’attente des courses.") },
          { titre: tx("Alertes et notifications"), contenu: tx("Seuils d’engorgement, canaux d’alerte, horaires de silence.") },
          { titre: tx("Compte et sécurité"), contenu: tx("Mot de passe, second facteur, adresses e-mail de secours.") },
        ]}
        avertissement={tx("Aucune valeur n’est préremplie et le bouton « Enregistrer » a été retiré : sans les routes ci-dessus, il afficherait une confirmation mensongère.")}
      />
    </ManagerLayout>
  );
}
