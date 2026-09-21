# TOKPa Frontend

Socle frontend initialisé à partir de la présentation `tokpa-structure-presentation.html`.

## Stack

- Vite 8
- React 19 + TypeScript strict
- Tailwind CSS 4
- Redux Toolkit + RTK Query
- React Router
- Laravel Echo + Pusher JS préparés pour Laravel Reverb
- Font Awesome via `@fortawesome/react-fontawesome` et les icônes Solid
- Images de marché/fruits intégrées dans `public/images/` (sources Pexels repérées)
- Adaptateurs isolés pour géolocalisation et FedaPay

## Démarrage

```bash
npm install
cp .env.example .env
npm run dev
```

Le serveur écoute sur `http://localhost:5173`. L’API frontend utilise `/api`; Vite la proxyfie vers `VITE_BACKEND_URL` côté serveur de développement.

## Vérifications

```bash
npm run typecheck
npm run build
```

## Routes de démonstration

- `/` : vue d’ensemble
- `/connexion` : accès de démonstration par rôle
- `/inscription` : inscription en deux étapes (profil puis sécurité)
- `/verification-email` : vérification du code e-mail (code démo `427913`)
- `/client` : espace client
- `/client/notifications` : centre de notifications dynamique
- `/catalogue` : catalogue avec recherche, filtres et tri
- `/produit/:productId` : détail produit, panier et négociation
- `/client/negociations` : suivi des offres et contre-propositions
- `/manager/zones` : gestion des zones, tarifs et points de repère
- `/livreur` : espace livreur
- `/manager` : espace manager
- `/admin` : espace administrateur

## À brancher ensuite

1. Authentification Sanctum et 2FA côté Laravel.
2. Endpoints RTK Query dans `src/services/api/`.
3. Canaux privés Laravel Reverb dans `src/services/realtime/`.
4. Paiement FedaPay confirmé par webhook backend.
5. Écrans métier détaillés et tests unitaires/e2e.
