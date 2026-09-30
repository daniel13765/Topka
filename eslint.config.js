import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Config ESLint du frontend TOKPa.
 *
 * Le dépôt déclarait `eslint` et `eslint-plugin-react-hooks` en dépendances de développement sans
 * jamais fournir de configuration : `npm run lint` échouait donc immédiatement. Cette reprise s'appuie
 * sur les trois ensembles recommandés — JavaScript, TypeScript, hooks React — plus la règle de
 * rechargement à chaud de Vite. Les écarts sont listés plus bas, règle par règle, avec la raison.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.vite/**'],
  },
  {
    files: ['**/*.{ts,tsx,jsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Règle rétablie en erreur partout : les 119 sites de src/pages/admin ont été typés (voir
      // src/types/adminRows.ts, miroir tolérant des ressources lues écran par écran).
      '@typescript-eslint/no-explicit-any': 'error',
      // Même arbitrage : lever un drapeau de chargement en début d'effet est le motif délibéré du projet
      // (aucun éclat de contenu avant la réponse). 36 sites. À revoir quand les écrans de données
      // passeront sur un cache de requêtes.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Les bouchons de tests décrivent exprès des réponses d'API sans forme fixe.
    files: ['tests/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // Un contexte React exporte son fournisseur ET son hook d'accès : c'est la forme usuelle, et la
    // séparer en deux fichiers ne gagnerait rien. On liste donc les deux noms plutôt que d'éteindre la
    // règle, qui continue de surveiller tout le reste du graphe de composants.
    files: ['src/context/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': ['error', { allowExportNames: ['LanguageProvider', 'useLanguage'] }],
    },
  },
);
