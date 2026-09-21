# TOKPa Frontend

Application React responsive et dynamique pour TOKPa, le marché de proximité béninois. Les écrans sont alignés sur les maquettes fournies : accueil, authentification, catalogue, produit, négociation, panier/commande, confirmation, notifications, espaces client/livreur/manager/admin, gestion des zones, équipe et console système.

## Stack

- Vite 8
- React 19 + TypeScript strict
- Tailwind CSS 4
- Redux Toolkit + RTK Query
- React Router
- Laravel Echo + Pusher JS préparés pour Laravel Reverb
- Font Awesome via `@fortawesome/react-fontawesome` et les icônes Solid
- Images de marché et assets visuels TOKPa intégrés dans `public/images/`
- Adaptateurs isolés pour géolocalisation et FedaPay

## Démarrage macOS, Linux ou terminal Windows

```bash
npm install
cp .env.example .env
npm run dev
```

Le serveur écoute sur `http://localhost:5173`. L’API frontend utilise `/api`; Vite la proxyfie vers `VITE_BACKEND_URL` côté serveur de développement.

### Démarrage Windows en double-clic

Depuis l’archive du projet :

1. `scripts\\installer-tokpa.bat` installe les dépendances.
2. `scripts\\lancer-tokpa.bat` démarre Vite et ouvre le navigateur.
3. `scripts\\arreter-tokpa.bat` arrête la fenêtre serveur.

Les instructions détaillées sont dans [`README-WINDOWS.md`](README-WINDOWS.md).

## Vérifications

```bash
npm run typecheck
npm run build
```

## Routes de démonstration

- `/` : accueil TOKPa et sélection du marché
- `/connexion` : accès de démonstration par rôle
- `/inscription` : inscription en deux étapes (profil puis sécurité)
- `/verification-email` : vérification du code e-mail (code démo `427913`)
- `/catalogue` : catalogue avec recherche, filtres et tri
- `/produit/:productId` : détail produit, panier et négociation
- `/commande` : panier, adresse de livraison et paiement FedaPay mocké
- `/commande/succes` : confirmation de commande
- `/client` : espace client
- `/client/notifications` : centre de notifications dynamique
- `/client/negociations` : suivi des offres et contre-propositions
- `/livreur` : espace livreur
- `/manager` : tableau de bord manager
- `/manager/equipe` : équipe, ajout de livreur et attribution de course
- `/manager/zones` : gestion des zones, tarifs et points de repère
- `/admin` : espace administrateur
- `/admin/console` : santé des services, trafic API et journal admin

Les espaces protégés utilisent la connexion de démonstration et les rôles `client`, `livreur`, `manager` et `admin`.

## Configuration et sécurité

Le projet utilise les mocks lorsque le backend Laravel n’est pas disponible :

```env
VITE_USE_MOCKS=true
```

La clé Google Maps ne doit jamais être commitée. Renseignez-la uniquement dans un fichier local `.env` ou `.env.local` :

```env
VITE_GOOGLE_MAPS_API_KEY=votre_cle_locale
```

## À brancher ensuite

1. Authentification Sanctum et 2FA côté Laravel.
2. Endpoints RTK Query dans `src/services/api/`.
3. Canaux privés Laravel Reverb dans `src/services/realtime/`.
4. Paiement FedaPay confirmé par webhook backend.
5. Google Maps réel via la variable d’environnement.
6. Tests unitaires et e2e des parcours de commande et de livraison.
