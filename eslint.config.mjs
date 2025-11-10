import jsoncParser from 'jsonc-eslint-parser'

import { withNuxt } from './.nuxt/eslint.config.mjs'

export default withNuxt()
  .append({
    name: 'jsonc-eslint-parser',
    files: ['*.json', '*.json5'],
    ignores: [
      'server/database/migrations/',
    ],
    languageOptions: {
      parser: jsoncParser,
      parserOptions: {
        jsonSyntax: 'JSON5',
      },
    },
  })
  .overrideRules({
    // Relax recommended Typescript rules
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^(_.*|regularUser$|superAdminUser|page$|request$)', destructuredArrayIgnorePattern: '^_' }],
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',

    // Relax strict Typescript rules (if strict is enabled in nuxt.config.ts)
    // '@typescript-eslint/no-misused-spread': 'off',
    // '@typescript-eslint/no-non-null-assertion': 'off',
    // '@typescript-eslint/no-unnecessary-condition': 'off',

    // Relax style rules
    '@stylistic/arrow-parens': ['error', 'always'], // Always keep parentheses around arrow function parameters
    '@stylistic/brace-style': 'off', // Allow same-line else/catch blocks
    '@stylistic/max-statements-per-line': 'off',
    '@stylistic/quotes': ['error', 'single', { avoidEscape: true }], // Use single quotes but allow double quotes when they contain single quotes
    'import/order': 'off', // Disable enforcing import order
    'vue/attributes-order': 'off', // Disable enforcing attribute order in Vue templates
    'vue/max-attributes-per-line': 'off', // Disable breaking attributes into multiple lines
    'vue/singleline-html-element-content-newline': 'off', // Allow content on same line as tags
    'vue/multi-word-component-names': 'off', // Allow single-word component names like "General"

    // Enable TypeScript strict rules to match VS Code behavior
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',

    // These rules require type checking
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', {
      disallowTypeAnnotations: false,
      prefer: 'type-imports',
    }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',

    // Stricter rules
    // '@typescript-eslint/strict-boolean-expressions': 'error',
  })
