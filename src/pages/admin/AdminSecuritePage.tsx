import EcranSansEndpoint from '../../components/shared/EcranSansEndpoint';
import AdminLayout from '../../components/layout/admin/AdminLayout';
import { useLanguage } from '../../context/LanguageContext';
import { tx } from '../../i18n/tx';


/**
 * AdminSecuritePage — écran que le backend ne sait pas encore nourrir.
 *
 * Aucune route correspondante dans routes/api.php (groupe role:super_admin) : la page pose le
 * cadre — routes attendues, rubriques qui se rempliront — et reste vide. Ni exemple, ni pourcentage,
 * ni nom de personne, ni faux secret : la règle du projet est qu’un écran non branché doit le dire.
 */
export default function AdminSecuritePage() {
  useLanguage();

  return (
    <AdminLayout currentPath="/admin/securite">
      <EcranSansEndpoint
        titre={tx("Sécurité, secrets et rôles")}
        chemin="/admin/securite"
        role={tx("Variables chiffrées de la plateforme, sessions d’administration, listes d’adresses IP autorisées et journal des consentements.")}
        middleware="role:super_admin"
        routes={[
          { chemin: 'GET /admin/securite', apporte: tx("État du chiffrement au repos et politique de second facteur appliquée par le serveur.") },
          { chemin: 'GET /admin/securite/sessions', apporte: tx("Sessions d’administration ouvertes : appareil, ville, dernier usage.") },
          { chemin: 'PUT /admin/securite/allowlist', apporte: tx("Ajout ou retrait d’une plage d’adresses IP autorisées.") },
          { chemin: 'GET /admin/securite/consentements', apporte: tx("Journal des consentements et des notifications de sécurité.") },
        ]}
        rubriques={[
          { titre: tx("Variables chiffrées"), contenu: tx("Noms des variables définies côté serveur, sans jamais en afficher la valeur.") },
          { titre: tx("Sessions actives"), contenu: tx("Une ligne par session ouverte, avec révocation côté serveur.") },
          { titre: tx("Adresses IP autorisées"), contenu: tx("Plages acceptées pour l’accès à l’administration, modifiables par PUT.") },
          { titre: tx("Second facteur"), contenu: tx("Nombre de comptes protégés par TOTP, lu dans la table des utilisateurs.") },
          { titre: tx("Conformité"), contenu: tx("Journal des exports et des décisions, aligné sur la loi APDP du Bénin.") },
        ]}
        avertissement={tx("Aucun taux de conformité, aucune adresse IP et aucun nom d’hébergeur ne sont affichés : le second facteur est décidé par le serveur (le champ requires_2fa à la connexion) et ne se pilote pas depuis cette page.")}
      />
    </AdminLayout>
  );
}
