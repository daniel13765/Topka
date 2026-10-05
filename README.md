# TOKPa Frontend

Frontend React du marché numérique TOKPa, fusionné avec la base frontend `elfred434/etokpa` et adapté au dépôt principal `daniel13765/Topka`.

Cette version conserve la direction visuelle TOKPa tout en intégrant l’architecture plus complète du dépôt Elfred : appels API Laravel, authentification Sanctum, TanStack Router, Redux, Reverb, Leaflet, administration et tests.

## Stack

- React 19 + Vite 8
- TypeScript et JSX stricts
- TanStack Router — chaque page est chargée à la demande (`lazy`), avec préchargement à l’intention
- Redux Toolkit (panier, négociation)
- Tailwind CSS 4
- Axios pour l’API Laravel
- Laravel Echo + Pusher pour Reverb
- Leaflet / React Leaflet pour le repli cartographique, Google Maps quand une clé est fournie
- jsPDF pour le reçu de course
- Fontsource Inter ; icônes Font Awesome (`@fortawesome/react-fontawesome`) dans les espaces client, manager et livreur
- Vitest (environnement `node`) : règles métier, rendu serveur des écrans, garde de découpage du bundle, couverture du jeu d’icônes

### Aucun contenu fabriqué

Aucun écran n’affiche de donnée inventée : pas de nom d’emprunt, pas de commande d’exemple, pas de
pourcentage d’infrastructure, pas de faux secret, pas de valeur préremplie dans un formulaire que le
backend ne sait pas lire. Cinq écrans d’administration et deux écrans manager n’ont pas de route
correspondante dans `routes/api.php` (groupes `role:admin`, `role:super_admin`, `role:manager`) : ils
rendent le cadre posé par `src/components/shared/EcranSansEndpoint.tsx` — routes attendues, rubriques
qui se rempliront, et la mention « Non branché — aucune route backend (B-16) » — et restent vides.
Les tableaux branchés, eux, affichent l’état renvoyé par l’API : chargement, vide, ou erreur.

`tests/sans-contenu-fabrique.test.ts` verrouille la règle : crible des motifs qui trahissaient du
contenu inventé, rendu des sept écrans concernés, et absence de clé de traduction orpheline dans
`src/i18n/phrases.ts` (une clé morte est presque toujours le vestige d’un écran retiré).

### Icônes

TOKPa rend ses icônes par `src/components/shared/FaIcon.tsx`, qui traduit un nom de ligature
(celles de la maquette d’origine, ex. `shopping_cart`) vers une icône Font Awesome du jeu gratuit.
La table vit dans `src/components/shared/faIcones.ts` — un module de constantes, séparé du
composant pour que le composant reste le seul export du fichier (Fast Refresh) et pour que la table
ait une source unique : elle est lue aussi par `markupIcone`, la fonction qui fabrique le `<svg>` en
chaîne de caractères dont les scripts du design (`src/pages/admin/_scripts`) ont besoin pour peindre
leurs boutons. Aucun écran n’embarque la police Material Symbols : elle pesait 3 981 208 octets.

`tests/fa-icones-couvertes.test.ts` échoue dès qu’un écran d’un des quatre espaces appelle un nom
absent de la table, dès qu’une ligature `material-symbols` réapparaît quelque part dans `src`, et
dès que le script embarqué d’un écran maquette cesse d’être du JavaScript valide.

## Installation et démarrage

```bash
npm install
cp .env.example .env.local
npm run dev
```

Le serveur démarre sur :

```text
http://localhost:5173
```

Le backend Laravel doit être disponible sur l’URL configurée dans `VITE_API_BASE_URL` pour charger les données réelles.

## Variables d’environnement

Exemple de configuration locale :

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_WSS_PORT=443
VITE_REVERB_SCHEME=ws
VITE_REVERB_KEY=tokpa-key
VITE_REVERB_APP_ID=tokpa
VITE_GOOGLE_MAPS_API_KEY=
```

Les clés privées ne doivent jamais être commitées dans GitHub : `.env.local` est ignoré, seul
`.env.example` porte les noms de variables.

### Cartes (Google Maps)

`VITE_GOOGLE_MAPS_API_KEY` active l’API JavaScript Google Maps sur les deux cartes du parcours
livreur (suivi de course et « Zone & position d’intervention » des réglages) ainsi que sur le suivi
client, qui partagent le même composant. Comportement volontaire :

- clé absente → les cartes rendent Leaflet + tuiles OpenStreetMap, avec une puce
  « Google Maps non configuré — repli OpenStreetMap » ; aucune requête Google n’est émise ;
- clé présente mais SDK injoignable (réseau, clé refusée, temporisation de 8 s) → même repli, plus un
  bouton « Réessayer » ; le chargement n’est jamais relancé en boucle ;
- la clé n’est lue qu’ici (`src/utils/googleMaps.ts`) et n’apparaît dans aucun fichier du dépôt.

Côté Google Cloud : activer **Maps JavaScript API** (facturation ouverte), restreindre la clé par
référent HTTP vers votre domaine. Aucun itinéraire n’est demandé : le backend ne sert que des points
(`zones.polygone_geo`, `points_repere.latitude/longitude`, `POST /livreur/position`), la trace reste
donc une liaison droite entre ces points réels. Ce dépôt n’utilise ni Directions API ni Geocoding API,
 faute de champ d’adresse exploitable pour un livreur dans l’API.

## Vérifications

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint 10, configuration plate `eslint.config.js`
npm run test:ci       # vitest run (watch : npm test)
npm run build         # vite build
```

### Dette de lint assumée

`npm run lint` remonte **zéro erreur** et 40 avertissements non bloquants, chacun justifié dans
`eslint.config.js` :

| Règle | Sites | Pourquoi en avertissement |
| --- | --- | --- |
| `react-hooks/set-state-in-effect` | 36 | Lever un drapeau de chargement en début d'effet est le motif délibéré du projet : aucun éclat de contenu avant la réponse de l'API. |
| `react-hooks/exhaustive-deps` | 4 | Effets de branchement d'un SDK externe (`CarteGoogle`) et listes volontairement bornées (`MessagingPage`, `NegotiationsPage`, `LivreurHistoryPage`). |

`@typescript-eslint/no-explicit-any` est revenue en **erreur partout** : les 119 sites de
`src/pages/admin` ont été typés via `src/types/adminRows.ts`, miroir tolérant des ressources
`ZoneResource`, `PointRepereResource`, `ProductResource`, `CategoryResource`, `BundleResource`,
`OrderResource` et `AdminDashboardController` telles que les écrans les lisent. La règle ne doit
pas être rétrogradée : quand un champ manque, on l'ajoute à `adminRows.ts`.

## Routes principales

### Client

- `/` : accueil TOKPa connecté à l’API
- `/connexion` : connexion
- `/inscription` : inscription
- `/verification-2fa` : vérification 2FA
- `/reset-password` : réinitialisation du mot de passe
- `/catalogue` : catalogue API avec recherche et filtres
- `/produit/:productId` : fiche produit
- `/panier` : panier
- `/confirmation` : confirmation de commande
- `/commandes` : liste des commandes
- `/commandes/suivi` : suivi d’une commande
- `/negociations` : négociations et propositions de prix
- `/notifications` : notifications temps réel
- `/profil` : profil client
- `/messagerie` : messagerie

### Administration

- `/admin` : tableau de bord
- `/admin/catalogue` : produits, catégories et packs composés
- `/admin/categories` : catégories
- `/admin/commandes` : commandes
- `/admin/zones` : zones et points de repère
- `/admin/utilisateurs` : utilisateurs
- `/admin/livreurs` : livreurs
- `/admin/validations` : validations
- `/admin/logs` : audit
- `/admin/parametres` : paramètres
- `/admin/systeme` : système et services
- `/admin/bdd-jobs` : base de données et tâches
- `/admin/cles-api` : clés API
- `/admin/securite` : sécurité

### Manager

- `/manager` : tableau de bord
- `/manager/commandes` : commandes de zone
- `/manager/equipe` : équipe
- `/manager/statistiques` : statistiques
- `/manager/litiges` : litiges
- `/manager/parametres` : paramètres
- `/manager/parametres/zone` : préférences de zone

### Livreur

- `/livreur` : tableau de bord
- `/livreur/course` : course active
- `/livreur/recapitulatif` : récapitulatif de course
- `/livreur/historique` : historique
- `/livreur/parametres` : paramètres

## API Laravel attendue

Les adaptateurs se trouvent dans `src/services/api/` :

- authentification et session Sanctum ;
- catalogue et catégories ;
- packs / bundles ;
- commandes et paiements ;
- négociations ;
- notifications ;
- zones et landmarks ;
- utilisateurs, livreurs et administration ;
- messagerie et temps réel.

Les endpoints admin des packs utilisent le modèle composé : un pack possède un prix global et une liste de produits avec leurs quantités.

Le détail de l’installation Laravel et de la correspondance des endpoints est documenté dans [`docs/backend-integration.md`](docs/backend-integration.md).

## GitHub

Le projet fusionné est publié dans :

```text
https://github.com/daniel13765/Topka
```
