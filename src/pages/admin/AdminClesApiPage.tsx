import EcranSansEndpoint from '../../components/shared/EcranSansEndpoint';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/**
 * AdminClesApiPage — écran que le backend ne sait pas encore nourrir.
 *
 * Aucune route correspondante dans routes/api.php (groupe role:super_admin) : la page pose le
 * cadre — routes attendues, rubriques qui se rempliront — et reste vide. Ni exemple, ni pourcentage,
 * ni nom de personne, ni faux secret : la règle du projet est qu’un écran non branché doit le dire.
 */
export default function AdminClesApiPage() {
  useLanguage();

  return (
    <AdminLayout currentPath="/admin/cles-api">
      <EcranSansEndpoint
        titre={tx("Clés d’API et webhooks")}
        chemin="/admin/cles-api"
        role={tx("Jetons d’intégration des applications partenaires, portées (scopes) et journal des appels entrants.")}
        middleware="role:super_admin"
        routes={[
          { chemin: 'GET /admin/integrations', apporte: tx("Jetons actifs, leur nom, leurs scopes, leur date de création et de dernier usage.") },
          { chemin: 'POST /admin/integrations', apporte: tx("Génération d’un jeton (Sanctum), affichée une seule fois à la création.") },
          { chemin: 'DELETE /admin/integrations/{integration}', apporte: tx("Révocation immédiate d’un jeton.") },
          { chemin: 'GET /admin/integrations/appels', apporte: tx("Journal des appels : URL du webhook, code reçu, latence, horodatage.") },
        ]}
        rubriques={[
          { titre: tx("Clés de service"), contenu: tx("Une ligne par intégration : application, jeton masqué, scopes, dernier usage.") },
          { titre: tx("Webhooks sortants"), contenu: tx("URL déclarées, événements abonnés, dernière tentative et code HTTP reçu.") },
          { titre: tx("Journal des appels"), contenu: tx("Entrées horodatées, filtrables par jeton et par code de réponse.") },
          { titre: tx("Rotations"), contenu: tx("Historique des rotations et révocations, avec l’auteur du changement.") },
        ]}
        avertissement={tx("Aucun secret d’exemple n’est affiché, même masqué : une chaîne inventée ressemblerait à une clé réelle et finirait copiée quelque part. La génération se fait côté serveur, et le secret n’est montré qu’une fois, à la création.")}
      />
    </AdminLayout>
  );
}
