# Lancer TOKPa sous Windows

## Pré-requis

1. Installer **Node.js LTS** depuis [nodejs.org](https://nodejs.org).
2. Décompresser l'archive dans un dossier sans caractères spéciaux si possible.

## Installation

Double-cliquer sur :

```text
scripts\installer-tokpa.bat
```

Le script installe les dépendances avec `npm install` et crée `.env` à partir de `.env.example` si le fichier n'existe pas.

## Démarrage

Double-cliquer sur :

```text
scripts\lancer-tokpa.bat
```

Le script démarre le serveur Vite, ouvre automatiquement le navigateur et affiche l'application à l'adresse :

```text
http://localhost:5173
```

La fenêtre noire intitulée **TOKPa - serveur Vite** doit rester ouverte pendant l'utilisation.

## Arrêt

Double-cliquer sur :

```text
scripts\arreter-tokpa.bat
```

Ou fermer la fenêtre **TOKPa - serveur Vite**.

## Commandes manuelles

Dans PowerShell ou l'invite de commandes, depuis le dossier du projet :

```powershell
npm install
npm run dev
```

Pour une vérification de production :

```powershell
npm run typecheck
npm run build
```

## Configuration

La clé Google Maps ne doit pas être écrite dans le code ou commitée. Renseignez-la uniquement dans votre fichier local `.env` :

```env
VITE_GOOGLE_MAPS_API_KEY=votre_cle_locale
```

Le projet livré utilise les mocks tant que le backend Laravel n'est pas branché :

```env
VITE_USE_MOCKS=true
```
