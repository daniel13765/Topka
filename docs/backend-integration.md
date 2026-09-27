# Intégration avec `etokpa_back`

Le frontend TOKPa est aligné sur l'API Laravel du dépôt privé `elfred434/etokpa_back`.

## Backend attendu

- Laravel 11
- PHP 8.3
- Sanctum + vérification 2FA
- PostgreSQL
- Redis
- Laravel Reverb
- FedaPay
- Cloudinary

Le backend doit être démarré sur `http://localhost:8000` et l'API sur `http://localhost:8000/api`.

## Configuration du frontend

Créer `.env.local` à la racine du frontend à partir de `.env.example` :

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

Ne jamais committer les secrets FedaPay, Cloudinary, Reverb ou Google Maps.

## Démarrage du backend Laravel

Depuis le dossier du dépôt backend :

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --port=8000
```

Dans un autre terminal pour le temps réel et les traitements :

```bash
php artisan reverb:start
php artisan queue:work
```

Le backend doit autoriser le frontend dans `CORS_ALLOWED_ORIGINS` :

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

## Contrats utilisés par le frontend

### Authentification

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/verify-2fa
POST /api/auth/resend-2fa
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Catalogue et packs

```text
GET    /api/products
GET    /api/products/{product}
GET    /api/categories
GET    /api/bundles

GET    /api/admin/products
POST   /api/admin/products
PUT    /api/admin/products/{product}
DELETE /api/admin/products/{product}

GET    /api/admin/categories
POST   /api/admin/categories
PUT    /api/admin/categories/{category}
DELETE /api/admin/categories/{category}

GET    /api/admin/bundles
POST   /api/admin/bundles
PUT    /api/admin/bundles/{bundle}
DELETE /api/admin/bundles/{bundle}
```

Les packs suivent le modèle composé du backend : un pack possède un prix global et des produits associés avec leurs quantités.

### Client

```text
GET    /api/cart
POST   /api/cart/add
PUT    /api/cart/update
DELETE /api/cart/remove/{id}
POST   /api/orders
GET    /api/orders
GET    /api/orders/{order}
GET    /api/orders/{order}/tracking
POST   /api/budget-proposals
GET    /api/budget-proposals
PUT    /api/budget-proposals/{proposal}
POST   /api/payments/init
GET    /api/payments/{payment}
```

### Manager et livreur

```text
GET    /api/manager/orders
POST   /api/manager/assign
GET    /api/manager/livreurs
GET    /api/manager/stats

GET    /api/livreur/deliveries
PATCH  /api/livreur/deliveries/{order}/accept
PATCH  /api/livreur/deliveries/{order}/refuse
POST   /api/livreur/position
PATCH  /api/livreur/deliveries/{order}/status
GET    /api/livreur/history
```

## Vérification locale

Le frontend peut être vérifié sans le backend :

```bash
npm run typecheck
npm run build
npm test -- --run
```

Pour tester les données réelles, le backend Laravel, la base de données, Redis et les services Reverb doivent être démarrés. Le sandbox de développement actuel ne contient pas PHP, Composer, PostgreSQL ou Redis ; les tests backend doivent donc être exécutés dans l'environnement Laravel prévu.
