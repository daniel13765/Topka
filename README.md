# TOKPa Frontend

Frontend React du marché numérique TOKPa, fusionné avec la base frontend `elfred434/etokpa` et adapté au dépôt principal `daniel13765/Topka`.

Cette version conserve la direction visuelle TOKPa tout en intégrant l’architecture plus complète du dépôt Elfred : appels API Laravel, authentification Sanctum, TanStack Router, TanStack Query, Redux, Reverb, Leaflet, administration et tests métier.

## Stack

- React 19 + Vite 8
- TypeScript et JSX stricts
- TanStack Router, Query, Table, Form et Virtual
- Redux Toolkit
- Tailwind CSS 4
- Axios pour l’API Laravel
- Laravel Echo + Pusher pour Reverb
- Leaflet / React Leaflet pour les cartes
- Fontsource Inter, Material Symbols et Recharts
- Vitest, Testing Library et MSW pour les tests

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

Les clés privées ne doivent jamais être commitée dans GitHub.

## Vérifications

```bash
npm run typecheck
npm run build
npm test -- --run
```

Le build Vite peut afficher un avertissement concernant la taille du bundle, notamment à cause de Material Symbols et des bibliothèques de tableaux/cartes.

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
