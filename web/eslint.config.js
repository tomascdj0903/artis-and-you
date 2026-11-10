// Vérificateur de code : repère les erreurs courantes (variable inconnue, import inutilisé, règles des hooks React).
// Lancé par GitHub à chaque envoi (.github/workflows/web.yml). En local : npx eslint src
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/i18n/*.js'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'build.mjs', 'public/sw.js'],
    languageOptions: {
      ecmaVersion: 2023, sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, ...globals.serviceworker, __ENV__: 'readonly' },
    },
    plugins: { react, 'react-hooks': hooks },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
      'react/jsx-key': 'error',
      'react/jsx-no-undef': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-irregular-whitespace': 'off',
    },
  },
];
